// 分组业务：列出某一 kind 的全库树、建分组、改名/移动、删分组。
// 失败 throw；「已存在」这类调用方可决策的返回 {status:'skipped'/'blocked'}。
//
// 分组按 kind 分成两棵树（storage 的 groups/<kind>/…）：svg 的目录不会出现在 html 里，
// 反之亦然。所以这里每个入口都要 kind——它同时是「哪棵树」和「看哪些资源」。
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { badInput, notFound } from '../errors/index.js';
import { assertKind, parseGroupPath, normalizeTags } from './constants.js';
import * as st from './storage.js';

export function labelOf(label, fallback) {
  const v = String(label ?? '').trim();
  if (!v) return fallback;
  if (v.length > 60) throw badInput('标签最长 60 字符');
  // Windows shell 会把命令行里的中文转成 GBK 再交给调用方，按 UTF-8 解不出就变成
  // U+FFFD（�）。这种字符串入库后无法再还原，必须在入口拒掉——
  // 用户看到「展示名含乱码字符」就知道是终端编码问题，而不是存了一堆坏数据。
  if (v.includes('�')) throw badInput('展示名含乱码字符（�）——Windows 终端编码问题，请改用 UTF-8 客户端或纯 ASCII 名称');
  return v;
}

// 某一 kind 的整棵树：groups: [{ path, label, assets: [...] }]
//
// 筛选语义（CLI --search/--tags 与面板筛选共用同一套，不许两端分叉）：
//   tags   多选为 AND——资源必须包含全部选中标签（100+ 资源用「逐层收窄」找得快）
//   search 大小写不敏感子串，匹配 名称 / 展示名 / 分组路径 / 标签 / 风格名
// availableTags 基于「该 kind 的全部资源」统计（不受筛选影响），筛选时标签云不跳变。
export function listTree(kind, { search = '', tags = [] } = {}) {
  assertKind(kind);
  const scanned = st.scanGroups(kind);
  const wantTags = normalizeTags(tags);
  const q = String(search || '').trim().toLowerCase();
  // 「有没有在筛选」决定空分组是留还是丢，见下面的 .filter 注释
  const filtering = !!q || wantTags.length > 0;
  const tagCounts = new Map();
  let kindTotal = 0;

  const groups = scanned
    .map(({ groupPath, manifest }) => {
      const assets = Object.values(manifest.assets);
      kindTotal += assets.length;
      for (const a of assets) {
        for (const t of a.tags || []) tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
      }
      return {
        path: groupPath,
        label: manifest.group.label || manifest.group.name,
        order: manifest.group.order,
        assets: assets
          .filter((a) => {
            const at = a.tags || [];
            if (wantTags.length && !wantTags.every((t) => at.includes(t))) return false;
            if (!q) return true;
            const hay = [a.name, a.label || '', a.desc || '', groupPath, ...at, ...Object.keys(a.styles || {})]
              .join(' ')
              .toLowerCase();
            return hay.includes(q);
          })
          .map((a) => ({
            name: a.name,
            label: a.label || a.name,
            desc: a.desc || '',
            styles: a.styleCount ?? Object.keys(a.styles || {}).length,
            activeStyle: a.activeStyle || null,
            tags: a.tags || [],
            updatedAt: a.updatedAt || null,
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      };
    })
    // 无筛选时**不丢空分组**。刚建好的分组本来就没有资源，丢掉它等于「建完就消失」——
    // 面板上什么都看不到，用户只会认为创建失败了，而「先建目录、再往里放资源」
    // 正是这个工具最基本的用法（真实踩过：建了分组却怎么都不显示）。
    // 只有带搜索/标签条件时才隐藏：一个没有任何命中资源的分组出现在结果里是噪音。
    .filter((g) => !filtering || g.assets.length > 0);

  const availableTags = [...tagCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return {
    root: st.groupsRoot(kind),
    count: { groups: groups.length, assets: groups.reduce((n, g) => n + g.assets.length, 0) },
    total: { assets: kindTotal },
    filter: { search: String(search || ''), tags: wantTags },
    availableTags,
    groups,
  };
}

export function addGroup({ kind, group, label }) {
  assertKind(kind);
  const groupPath = parseGroupPath(group);
  if (st.loadGroup(kind, groupPath)) return { status: 'skipped', path: groupPath, reason: '已存在' };
  const manifest = st.newManifest(groupPath, labelOf(label, undefined));
  st.saveGroup(kind, groupPath, manifest);
  return { status: 'ok', path: groupPath, label: manifest.group.label };
}

// 分组改名 / 移动：同一操作——把目录挪到新路径，再把清单里的 path/name 对齐。
//
// 两个必须拦住的情况：
//   1. 挪进自己的子树（ui → ui/icons）会把目录搬进它自己里面，直接损坏
//   2. 目标已存在——不覆盖别人的分组，宁可报错让调用方决定
// 子分组的清单也要跟着改 path，否则它们的路径还指着旧位置。
export function renameGroup({ kind, group, to, label }) {
  assertKind(kind);
  const from = parseGroupPath(group);
  const target = parseGroupPath(to);
  if (from === target && label === undefined) return { status: 'skipped', path: from };
  if (target === from) {
    const manifest = st.loadGroup(kind, from);
    if (!manifest) throw notFound(`分组不存在: ${from}`);
    manifest.group.label = labelOf(label, manifest.group.label);
    st.saveGroup(kind, from, manifest);
    return { status: 'ok', path: from, renamed: false, label: manifest.group.label };
  }
  if (target.startsWith(from + '/')) {
    throw badInput(`不能把分组移进它自己的子树: ${from} → ${target}`);
  }
  const manifest = st.loadGroup(kind, from);
  if (!manifest) throw notFound(`分组不存在: ${from}`);
  if (st.loadGroup(kind, target)) {
    return { status: 'blocked', path: target, reason: '目标分组已存在' };
  }

  st.renameGroupDir(kind, from, target);
  // 目录已挪走，清单跟着挪：自己 + 所有子分组的 path 前缀替换
  rewritePathsUnder(kind, target, (p) => target + p.slice(from.length));
  const next = st.loadGroup(kind, target);
  if (label !== undefined) next.group.label = labelOf(label, next.group.label);
  st.saveGroup(kind, target, next);
  return { status: 'ok', path: target, renamed: true, label: next.group.label };
}

// 把 path 以 fromPath 开头的所有分组的清单路径重写成 mapPath(p)
function rewritePathsUnder(kind, fromPath, mapPath) {
  for (const { groupPath, manifest } of st.scanGroups(kind)) {
    if (groupPath !== fromPath && !groupPath.startsWith(fromPath + '/')) continue;
    const np = mapPath(groupPath);
    manifest.group.path = np;
    manifest.group.name = np.split('/').pop();
    st.saveGroup(kind, groupPath, manifest);
  }
}

// 同级排序：order 是「该父分组下全部子分组的完整新顺序」。
// 校验是同一集合的重排（不多不少、不重复），然后按数组序写 group.order = 0..n-1。
// 排序规则（buildTree/listTree 两侧一致）：有 order 的按序在前，没有的按名字垫底——
// 老分组不迁移也天然成立，拖过一次就有了序号。
export function reorderSiblings({ kind, parent, order }) {
  assertKind(kind);
  // 最外层的 parent 是空串——parseGroupPath 会拒收空路径（1~8 段），这里先兜住
  const parentPath = parent ? parseGroupPath(parent) : '';
  if (!Array.isArray(order) || !order.length) throw badInput('需要 --order <逗号分隔的完整顺序>');
  const paths = order.map((p) => parseGroupPath(p));
  if (new Set(paths).size !== paths.length) throw badInput('order 里有重复的分组路径');

  const depth = parentPath ? parentPath.split('/').length + 1 : 1;
  const direct = st
    .scanGroups(kind)
    .map((s) => s.groupPath)
    .filter((p) => p.split('/').length === depth);
  const missing = direct.filter((p) => !paths.includes(p));
  if (missing.length) throw badInput(`order 缺少这些同级分组: ${missing.join(', ')}`);

  direct.sort().forEach((p) => {
    const manifest = st.loadGroup(kind, p);
    if (!manifest) return;
    manifest.group.order = paths.indexOf(p);
    st.saveGroup(kind, p, manifest);
  });
  return { status: 'ok', parent: parentPath || '(最外层)', order: paths };
}

export function removeGroup({ kind, group, force }) {
  assertKind(kind);
  const groupPath = parseGroupPath(group);
  const dir = st.groupDir(kind, groupPath);
  const manifest = st.loadGroup(kind, groupPath);
  const dirExists = existsSync(dir);
  // 无 group.json、只有目录的「纯路径容器」（如建 abc/da 时自动生成的 abc）在面板上
  // 就是一层普通文件夹，必须能删——早期只认清单，点删除一律 404「分组不存在」，
  // 用户看到的是「点了没反应 + 一句莫名其妙的错」。
  if (!manifest && !dirExists) throw notFound(`分组不存在: ${groupPath}`);
  const assetCount = manifest ? Object.keys(manifest.assets).length : 0;
  const nested = dirExists ? listDirs(dir).filter((n) => n !== st.ASSETS_SUBDIR).length : 0;
  if ((assetCount || nested) && !force) {
    return {
      status: 'blocked',
      path: groupPath,
      assets: assetCount,
      groups: nested,
      reason: '分组非空，加 --force 连同内容一起删除',
    };
  }
  rmSync(dir, { recursive: true, force: true });
  // 顺带清掉被删空的父目录链。判定「空壳」必须是真容器：既没有子目录、
  // 也没有自己的 group.json——只看子目录会误删「资源还没落盘成文件」的父分组
  // （它的 assets/ 目录尚未创建，但 group.json 里清清楚楚有一堆资源）。
  const segs = groupPath.split('/');
  for (let i = segs.length - 1; i >= 1; i--) {
    const p = join(st.groupsRoot(kind), ...segs.slice(0, i));
    const isEmptyShell = existsSync(p) && listDirs(p).length === 0 && !existsSync(join(p, st.GROUP_FILE));
    if (isEmptyShell) rmSync(p, { recursive: true, force: true });
  }
  return { status: 'ok', path: groupPath, removed: { assets: assetCount, groups: nested } };
}

function listDirs(dir) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names.filter((n) => {
    try {
      return statSync(join(dir, n)).isDirectory();
    } catch {
      return false;
    }
  });
}
