// 资产落盘层：分组 = 目录 + group.json；资源 = assets/<资源>/styles/<风格>/ 里的代码文件。
//
// 布局（~/.nx-ft/assets/，可用 NX_FT_DATA 覆盖——测试必须指到临时目录）：
//   groups/<kind>/<分组路径>/                 # kind = html | svg，两棵树互不相干
//     group.json                              # 分组标签 + 该组全部资源的清单（原子写）
//     assets/<资源名>/
//       styles/<风格名>/
//         html  css  js  svg                  # 当前代码（普通文本文件）
//         history/<tag>/html …                # 最近 5 条保存历史快照
//
// **为什么 kind 进路径**：html 与 svg 是两个世界——组件和图标不会互相引用，
// 分组的组织方式也天然不同（buttons/login vs icons/nav）。共用一棵树的代价是
// 「在 SVG 下建的目录会出现在 HTML 里」，两边都得在自己的列表里过滤掉对方的东西。
// 分成两棵树之后，各自的目录就是各自的，不需要任何过滤。
//
// 清单集中在 group.json：一次读写拿到整组状态，写操作只有一个原子落点。
// 历史快照按目录区分（history/<标签>/），恢复历史 = 把快照写回当前 + 当前推入历史。
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { assetsDirFromEnv } from '../paths.js';
import { specError } from '../errors/index.js';
import { ASSET_KINDS } from './constants.js';

export const GROUPS_DIR = 'groups';
export const GROUP_FILE = 'group.json';
export const ASSETS_SUBDIR = 'assets';
export const STYLES_SUBDIR = 'styles';
export const HISTORY_SUBDIR = 'history';

// 路径构造函数一律走 assertKind：漏传 kind 时**立刻报错**，
// 而不是静默拼出一个 groups/undefined/… 然后写进去再读不出来。
function assertKind(kind) {
  if (!ASSET_KINDS[kind]) {
    throw specError(`存储层收到未知 kind: ${kind}（应为 ${Object.keys(ASSET_KINDS).join(' | ')}）`);
  }
  return kind;
}

export function groupsRoot(kind) {
  return join(assetsDirFromEnv(), GROUPS_DIR, assertKind(kind));
}

export function groupDir(kind, groupPath) {
  return join(groupsRoot(kind), ...String(groupPath).split('/'));
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

export function loadGroup(kind, groupPath) {
  const p = join(groupDir(kind, groupPath), GROUP_FILE);
  const raw = readJsonSafe(p);
  if (!raw) return null;
  if (raw.version !== 1 || !raw.group || typeof raw.assets !== 'object' || raw.assets === null) {
    throw specError(`分组清单损坏（${p}）：期望 {version:1, group, assets}`);
  }
  return raw;
}

export function saveGroup(kind, groupPath, manifest) {
  writeJsonAtomic(join(groupDir(kind, groupPath), GROUP_FILE), manifest);
}

export function newManifest(groupPath, label) {
  const name = String(groupPath).split('/').pop();
  return {
    version: 1,
    group: { path: groupPath, name, label: label || name, createdAt: new Date().toISOString() },
    assets: {},
  };
}

// 根清单（groups/<kind>/group.json）：根是一等分组，资源可以直接住这儿。
// 惰性创建——第一个根级写入口（建资源 / 导入 / 移到根）才落盘；没根资源时
// 盘上不多一个空清单（scanGroups 也不会多出空根条目，存量行为零变化）。
export function ensureRootManifest(kind) {
  const existing = loadGroup(kind, '');
  if (existing) return existing;
  const manifest = newManifest('', '全部');
  saveGroup(kind, '', manifest);
  return manifest;
}

// 分组改名/移动 = 目录改名 + 清单里的 path/name 跟着改（子分组的 path 也要改）。
// 返回重命名后的新路径，供调用方回填。
export function renameGroupDir(kind, fromPath, toPath) {
  const from = groupDir(kind, fromPath);
  if (!existsSync(from)) throw specError(`分组目录不存在: ${fromPath}`);
  const to = groupDir(kind, toPath);
  if (existsSync(to)) throw specError(`目标分组已存在: ${toPath}`);
  mkdirSync(dirname(to), { recursive: true });
  renameSync(from, to);
  return toPath;
}

// ---- 资源 / 风格 / 历史的文件位置 ----

export function assetBaseDir(kind, groupPath, name) {
  return join(groupDir(kind, groupPath), ASSETS_SUBDIR, name);
}

export function styleBaseDir(kind, groupPath, name, styleName) {
  return join(assetBaseDir(kind, groupPath, name), STYLES_SUBDIR, styleName);
}

export function codeFilePath(kind, groupPath, name, styleName, slot) {
  return join(styleBaseDir(kind, groupPath, name, styleName), slot);
}

export function historyRoot(kind, groupPath, name, styleName) {
  return join(styleBaseDir(kind, groupPath, name, styleName), HISTORY_SUBDIR);
}

export function historyTagDir(kind, groupPath, name, styleName, tag) {
  return join(historyRoot(kind, groupPath, name, styleName), tag);
}

export function removeStyleDir(kind, groupPath, name, styleName) {
  rmSync(styleBaseDir(kind, groupPath, name, styleName), { recursive: true, force: true });
}

export function removeAssetDir(kind, groupPath, name) {
  rmSync(assetBaseDir(kind, groupPath, name), { recursive: true, force: true });
}

export function assetExists(kind, groupPath, name) {
  return existsSync(assetBaseDir(kind, groupPath, name));
}

// 资源目录跨分组整搬（风格与历史随目录）。源不存在返回 false（与 renameAssetDir
// 同口径：还没写过代码的资源只动清单键）；目标已有目录是真冲突，必须拒绝。
export function moveAssetDir(kind, fromGroup, toGroup, name) {
  const src = assetBaseDir(kind, fromGroup, name);
  const dst = assetBaseDir(kind, toGroup, name);
  if (existsSync(dst)) throw specError(`目标资源已存在: ${toGroup}/${name}`);
  if (!existsSync(src)) return false;
  mkdirSync(dirname(dst), { recursive: true });
  renameSync(src, dst);
  return true;
}

export function listStyleDirs(kind, groupPath, name) {
  return listSubdirs(join(assetBaseDir(kind, groupPath, name), STYLES_SUBDIR));
}

// 资源改名 = 目录改名（清单里的键同步改由调用方负责）。
//
// 注意：**新建但还没加风格的资源是没有目录的**（assets/<名>/ 是在第一次写代码时才建），
// 所以源目录不存在是正常情况，不是错误——这时改名只是改清单里的键，
// 返回 false 让调用方知道没有文件要挪。目标已有目录才必须拒绝（那是真冲突）。
export function renameAssetDir(kind, groupPath, from, to) {
  const src = assetBaseDir(kind, groupPath, from);
  const dst = assetBaseDir(kind, groupPath, to);
  if (existsSync(dst)) throw specError(`目标资源已存在: ${groupPath}/${to}`);
  if (!existsSync(src)) return false;
  mkdirSync(dirname(dst), { recursive: true });
  renameSync(src, dst);
  return true;
}

// ---- 代码文件读写 ----
// historyTag 给出时读的是某条历史快照而不是当前代码。

export function readCodeFiles(kind, groupPath, name, styleName, slots, historyTag) {
  const base = historyTag
    ? historyTagDir(kind, groupPath, name, styleName, historyTag)
    : styleBaseDir(kind, groupPath, name, styleName);
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

export function writeCodeFiles(kind, groupPath, name, styleName, files) {
  for (const [slot, content] of Object.entries(files)) {
    writeTextAtomic(codeFilePath(kind, groupPath, name, styleName, slot), String(content ?? ''));
  }
}

// 把风格的当前代码快照到 history/<tag>/（保存前调用，保存的是「改动前」的状态）。
export function snapshotStyle(kind, groupPath, name, styleName, tag, slots) {
  const cur = readCodeFiles(kind, groupPath, name, styleName, slots);
  for (const slot of slots) {
    writeTextAtomic(join(historyTagDir(kind, groupPath, name, styleName, tag), slot), cur[slot]);
  }
}

export function removeHistoryTag(kind, groupPath, name, styleName, tag) {
  rmSync(historyTagDir(kind, groupPath, name, styleName, tag), { recursive: true, force: true });
}

// ---- 全库扫描（只给树总览用） ----

// 递归遍历某一 kind 下的所有分组清单（分组可多层套嵌：每层目录 = 一个分组，
// 目录下既可有自己的 group.json + assets/，也可有更深一层的子分组）。
// 坏清单跳过——树是总览，不该因一个损坏分组整体打不开；详情接口会给到具体报错。
// 深度护栏（遍历上限，比 GROUP_DEPTH_MAX 宽）只防病态目录环，不参与业务校验。
const WALK_DEPTH_GUARD = 12;

export function scanGroups(kind) {
  const out = [];
  const root = groupsRoot(kind);
  if (!existsSync(root)) return out;

  // 根条目：根清单存在才收录（groups/<kind>/group.json 本身不是子目录，
  // 下面的 walk 看不到它）。根资源住在 assets/ 子目录里，与子分组天然隔离。
  if (existsSync(join(root, GROUP_FILE))) {
    try {
      const manifest = loadGroup(kind, '');
      if (manifest) out.push({ groupPath: '', manifest });
    } catch {
      /* 跳过损坏的根清单 */
    }
  }

  const walk = (absDir, relPath, depth) => {
    for (const name of listSubdirs(absDir)) {
      if (name === ASSETS_SUBDIR) continue; // assets/ 里是代码文件，不是分组
      const groupPath = relPath ? relPath + '/' + name : name;
      const abs = join(absDir, name);
      if (existsSync(join(abs, GROUP_FILE))) {
        try {
          const manifest = loadGroup(kind, groupPath);
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

// ---- 一次性迁移：共用一棵树 → 按 kind 分成两棵 ----
//
// 老布局：groups/<组路径>/{group.json, assets/<资源>/…}（资源靠清单里的 kind 字段区分）
// 新布局：groups/<kind>/<组路径>/…
//
// 判据：groups/ 下存在「既不是 html 也不是 svg」的目录 = 还没迁过。
//
// 三条硬要求：
//   1. **不删老数据**——迁完把老树整体改名留档（.legacy-<时间戳>），出问题还能人工捞。
//   2. **幂等**——迁过一次就不再触发（老树已经不在原位了）。
//   3. **按 kind 分流**——老分组可能同时含两类资源，各自只带走属于自己那类的资源目录，
//      不留重复副本。**完全没有资源的空分组则两边各留一份**：老清单里没有任何
//      能判断归属的信息，两棵都留着至少不会让用户「我的目录不见了」。
const KIND_DIRS = Object.keys(ASSET_KINDS);

export function migrateLegacyLayout() {
  const base = join(assetsDirFromEnv(), GROUPS_DIR);
  if (!existsSync(base)) return { migrated: false };

  // 排除两样东西：
  //   已知 kind 目录（html/svg）= 新布局，不是老数据
  //   点开头的目录 = 本函数自己留下的留档（.legacy-*）。
  //     **漏掉这条会破坏幂等**：留档目录看起来和老分组一模一样，
  //     第二遍迁移会把它再迁一次、再留一档，无限套娃。（分组名本来就不允许点开头。）
  const legacyNames = listSubdirs(base).filter(
    (n) => !KIND_DIRS.includes(n) && !n.startsWith('.')
  );
  if (!legacyNames.length) return { migrated: false };

  const moved = [];
  for (const kind of KIND_DIRS) {
    for (const name of legacyNames) {
      copyLegacyGroupTree(join(base, name), join(base, kind, name), kind);
    }
  }

  // 留档而不是删除：迁移是有损判断（空分组靠猜），留一份原始数据是唯一的安全网
  const archive = join(base, '.legacy-' + new Date().toISOString().replace(/[-:.]/g, ''));
  mkdirSync(archive, { recursive: true });
  for (const name of legacyNames) {
    renameSync(join(base, name), join(archive, name));
    moved.push(name);
  }

  return { migrated: true, groups: moved, kinds: KIND_DIRS, archive };
}

// 把老树里的一棵子树按 kind 拷进新树：只带该 kind 的资源目录。
// 判定很直白——按清单里每条资源的 kind 分流；
//   有资源但一条都不属于本 kind → 本树里不建这个分组（下探子分组，它们可能属于本 kind）
//   一条资源都没有（空分组）     → 两边都建（老清单没有任何归属信息，两棵都留着最不惊吓）
function copyLegacyGroupTree(srcAbs, dstAbs, kind) {
  const manifestPath = join(srcAbs, GROUP_FILE);

  if (existsSync(manifestPath)) {
    const raw = readJsonSafe(manifestPath);
    if (raw && raw.assets && typeof raw.assets === 'object') {
      const all = Object.entries(raw.assets);
      const kept = all.filter(([, a]) => a && a.kind === kind);
      const isEmpty = all.length === 0;

      if (isEmpty || kept.length) {
        writeJsonAtomic(join(dstAbs, GROUP_FILE), { ...raw, assets: Object.fromEntries(kept) });
        for (const [assetName] of kept) {
          const from = join(srcAbs, ASSETS_SUBDIR, assetName);
          if (existsSync(from)) {
            cpSync(from, join(dstAbs, ASSETS_SUBDIR, assetName), { recursive: true });
          }
        }
      }
    }
  }

  for (const child of listSubdirs(srcAbs)) {
    if (child === ASSETS_SUBDIR) continue;
    copyLegacyGroupTree(join(srcAbs, child), join(dstAbs, child), kind);
  }
}
