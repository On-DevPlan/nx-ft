// 资产落盘层：分组 = 目录 + group.json；资源 = assets/<资源>/styles/<风格>/ 里的代码文件。
//
// 布局（~/.nx-ft/assets/，可用 NX_FT_DATA 覆盖——测试必须指到临时目录）：
//   groups/<分组路径>/
//     group.json                          # 分组标签 + 该组全部资源的清单（原子写）
//     assets/<资源名>/
//       styles/<风格名>/
//         html  css  js                   # 当前代码（普通文本文件）
//         history/<tag>/html …            # 最近 5 条保存历史快照
//
// 清单集中在 group.json：一次读写拿到整组状态，写操作只有一个原子落点。
// 历史快照按目录区分（history/<标签>/），恢复历史 = 把快照写回当前 + 当前推入历史。
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { assetsDirFromEnv } from '../paths.js';
import { specError } from '../errors/index.js';

export const GROUPS_DIR = 'groups';
export const GROUP_FILE = 'group.json';
export const ASSETS_SUBDIR = 'assets';
export const STYLES_SUBDIR = 'styles';
export const HISTORY_SUBDIR = 'history';

export function groupsRoot() {
  return join(assetsDirFromEnv(), GROUPS_DIR);
}

export function groupDir(groupPath) {
  return join(groupsRoot(), ...groupPath.split('/'));
}

// 原子写：先写临时文件再 rename，进程被杀时不会留下半截文件。
// 资产操作串行经过这里，不存在并发写同一文件的情况。
export function writeTextAtomic(absPath, text) {
  mkdirSync(dirname(absPath), { recursive: true });
  const tmp = absPath + '.tmp';
  writeFileSync(tmp, text, 'utf8');
  renameSync(tmp, absPath);
}

export function writeJsonAtomic(absPath, obj) {
  writeTextAtomic(absPath, JSON.stringify(obj, null, 2) + '\n');
}

export function readJsonSafe(absPath) {
  try {
    return JSON.parse(readFileSync(absPath, 'utf8'));
  } catch {
    return null;
  }
}

// ---- 分组清单 ----

export function loadGroup(groupPath) {
  const p = join(groupDir(groupPath), GROUP_FILE);
  const raw = readJsonSafe(p);
  if (!raw) return null;
  if (raw.version !== 1 || !raw.group || typeof raw.assets !== 'object' || raw.assets === null) {
    throw specError(`分组清单损坏（${p}）：期望 {version:1, group, assets}`);
  }
  return raw;
}

export function saveGroup(groupPath, manifest) {
  writeJsonAtomic(join(groupDir(groupPath), GROUP_FILE), manifest);
}

export function newManifest(groupPath, label) {
  const name = groupPath.split('/').pop();
  return {
    version: 1,
    group: { path: groupPath, name, label: label || name, createdAt: new Date().toISOString() },
    assets: {},
  };
}

// ---- 资源 / 风格 / 历史的文件位置 ----

export function assetBaseDir(groupPath, name) {
  return join(groupDir(groupPath), ASSETS_SUBDIR, name);
}

export function styleBaseDir(groupPath, name, styleName) {
  return join(assetBaseDir(groupPath, name), STYLES_SUBDIR, styleName);
}

export function codeFilePath(groupPath, name, styleName, slot) {
  return join(styleBaseDir(groupPath, name, styleName), slot);
}

export function historyRoot(groupPath, name, styleName) {
  return join(styleBaseDir(groupPath, name, styleName), HISTORY_SUBDIR);
}

export function historyTagDir(groupPath, name, styleName, tag) {
  return join(historyRoot(groupPath, name, styleName), tag);
}

export function removeStyleDir(groupPath, name, styleName) {
  rmSync(styleBaseDir(groupPath, name, styleName), { recursive: true, force: true });
}

export function removeAssetDir(groupPath, name) {
  rmSync(assetBaseDir(groupPath, name), { recursive: true, force: true });
}

export function assetExists(groupPath, name) {
  return existsSync(assetBaseDir(groupPath, name));
}

export function listStyleDirs(groupPath, name) {
  return listSubdirs(join(assetBaseDir(groupPath, name), STYLES_SUBDIR));
}

// ---- 代码文件读写 ----
// historyTag 给出时读的是某条历史快照而不是当前代码。

export function readCodeFiles(groupPath, name, styleName, slots, historyTag) {
  const base = historyTag
    ? historyTagDir(groupPath, name, styleName, historyTag)
    : styleBaseDir(groupPath, name, styleName);
  const out = {};
  for (const slot of slots) {
    try {
      out[slot] = readFileSync(join(base, slot), 'utf8');
    } catch {
      out[slot] = '';
    }
  }
  return out;
}

export function writeCodeFiles(groupPath, name, styleName, files) {
  for (const [slot, content] of Object.entries(files)) {
    writeTextAtomic(codeFilePath(groupPath, name, styleName, slot), String(content ?? ''));
  }
}

// 把风格的当前代码快照到 history/<tag>/（保存前调用，保存的是「改动前」的状态）。
export function snapshotStyle(groupPath, name, styleName, tag, slots) {
  const cur = readCodeFiles(groupPath, name, styleName, slots);
  for (const slot of slots) {
    writeTextAtomic(join(historyTagDir(groupPath, name, styleName, tag), slot), cur[slot]);
  }
}

export function removeHistoryTag(groupPath, name, styleName, tag) {
  rmSync(historyTagDir(groupPath, name, styleName, tag), { recursive: true, force: true });
}

// ---- 全库扫描（只给树总览用） ----

// 递归遍历所有分组的清单（分组可多层套嵌：每层目录 = 一个分组，
// 目录下既可有自己的 group.json + assets/，也可有更深一层的子分组）。
// 坏清单跳过——树是总览，不该因一个损坏分组整体打不开；详情接口会给到具体报错。
// 深度护栏（遍历上限，比 GROUP_DEPTH_MAX 宽）只防病态目录环，不参与业务校验。
const WALK_DEPTH_GUARD = 12;

export function scanGroups() {
  const out = [];
  const root = groupsRoot();
  if (!existsSync(root)) return out;

  const walk = (absDir, relPath, depth) => {
    for (const name of listSubdirs(absDir)) {
      if (name === ASSETS_SUBDIR) continue; // assets/ 里是代码文件，不是分组
      const groupPath = relPath ? relPath + '/' + name : name;
      const abs = join(absDir, name);
      if (existsSync(join(abs, GROUP_FILE))) {
        try {
          const manifest = loadGroup(groupPath);
          if (manifest) out.push({ groupPath, manifest });
        } catch {
          /* 跳过损坏分组 */
        }
      }
      if (depth < WALK_DEPTH_GUARD) walk(abs, groupPath, depth + 1);
    }
  };
  walk(root, '', 0);
  return out.sort((a, b) => a.groupPath.localeCompare(b.groupPath));
}

function listSubdirs(dir) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((n) => {
      try {
        return statSync(join(dir, n)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();
}
