// 资源业务：创建/读取/改名/删除 + 标签（检索轴）。
//
// 数据模型（与用户约定的口径一致）：
//   分组（面包屑）→ 资源（如「登录按钮」，带多个标签）→ 风格（不限数量）→ 编辑历史（每风格最近 5 条）
// 风格的增删切换与编辑历史在 styles.js。
import { badInput, notFound } from '../errors/index.js';
import { assertSafeName } from '../paths.js';
import { ASSET_KINDS, assertKind, normalizeTags, nowIso, parseGroupPath } from './constants.js';
import { labelOf } from './groups.js';
import { locate, resolveAsset, styleMeta, usedSlots } from './shared.js';
import { addStyle } from './styles.js';
import * as st from './storage.js';

// ---- 资源 CRUD ----

export function createAsset({ kind, group, name, label, style, code, tags }) {
  assertKind(kind);
  const groupPath = parseGroupPath(group);
  const entryName = assertSafeName(String(name ?? '').trim(), '资源名');
  const manifest = st.loadGroup(kind, groupPath);
  if (!manifest) throw notFound(`分组不存在: ${groupPath}（先用 group add 建组）`);
  if (manifest.assets[entryName]) return { status: 'skipped', group: groupPath, name: entryName, reason: '已存在' };

  const entry = {
    name: entryName,
    kind, // 冗余但留证：目录树已经按 kind 分开，这里再记一份便于清单自解释与排查
    label: labelOf(label, entryName),
    tags: normalizeTags(tags),
    activeStyle: null,
    styleCount: 0,
    styles: {},
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  manifest.assets[entryName] = entry;
  st.saveGroup(kind, groupPath, manifest);

  let styleStatus = 'none';
  if (style) {
    const r = addStyle({ kind, group: groupPath, name: entryName, style, code });
    styleStatus = r.style ? `ok:${r.style}` : 'skipped';
  }
  return {
    status: 'ok',
    kind,
    group: groupPath,
    name: entryName,
    label: entry.label,
    tags: entry.tags,
    style: styleStatus,
  };
}

export function loadAsset({ kind, group, name, code = false }) {
  assertKind(kind);
  const groupPath = parseGroupPath(group);
  const entryName = assertSafeName(String(name ?? '').trim(), '资源名');
  const { entry } = locate(kind, groupPath, entryName);
  const slots = ASSET_KINDS[kind].slots;
  const styles = Object.values(entry.styles)
    .map(styleMeta)
    .sort((a, b) => a.name.localeCompare(b.name));
  const out = {
    kind,
    group: groupPath,
    name: entryName,
    label: entry.label || entryName,
    desc: entry.desc || '',
    tags: entry.tags || [],
    activeStyle: entry.activeStyle,
    styles,
    updatedAt: entry.updatedAt,
  };
  if (code) {
    const map = {};
    for (const s of Object.values(entry.styles)) {
      map[s.name] = st.readCodeFiles(kind, groupPath, entryName, s.name, slots);
    }
    out.code = map;
  }
  return { ...out, usedSlots: [...usedSlots(kind)] };
}

// 资源级「主描述」：一句话说清这个资源是干什么的（与风格描述分工——
// 主描述回答「这是什么场景」，风格描述回答「这一套实现的特征」）。
// 两者都是给人和 agent 检索用的元信息：资源多了以后，靠名字找不回来，
// 靠描述才召回得准（CLI 侧配合 tree --search 一起用）。传空串即清除。
export function setAssetDesc({ kind, group, name, desc }) {
  assertKind(kind);
  const { groupPath, entryName, entry, manifest } = resolveAsset(kind, group, name);
  const text = String(desc ?? '').trim();
  if (text.length > 200) throw badInput('描述最长 200 字符');
  entry.desc = text;
  entry.updatedAt = nowIso();
  st.saveGroup(kind, groupPath, manifest);
  return { status: 'ok', group: groupPath, name: entryName, desc: text };
}

// 资源改名：label 改展示名、to 改目录名（两者可单独或同时给）。
// 改名**不动内容**——目录整体挪过去，风格与编辑历史原样跟着走。
//
// 展示名的归属：只有「当初没起名」（label 恰好等于目录名，即自动派生的那种）
// 才跟着目录名走；用户自己起过的展示名一律保留——改个目录名顺手把人家起的名字
// 抹掉，是没人要求过的副作用。
export function renameAsset({ kind, group, name, label, to }) {
  assertKind(kind);
  const { groupPath, entryName, entry, manifest } = resolveAsset(kind, group, name);
  const target = to === undefined ? entryName : assertSafeName(String(to).trim(), '资源名');
  const autoLabel = (entry.label || entryName) === entryName;
  let renamed = false;

  if (target !== entryName) {
    if (manifest.assets[target]) {
      return { status: 'blocked', group: groupPath, name: entryName, to: target, reason: '目标名已存在' };
    }
    st.renameAssetDir(kind, groupPath, entryName, target);
    delete manifest.assets[entryName];
    entry.name = target;
    manifest.assets[target] = entry;
    renamed = true;
  }

  if (label !== undefined) entry.label = labelOf(label, target);
  else if (renamed && autoLabel) entry.label = target;
  else if (!entry.label) entry.label = target;

  entry.updatedAt = nowIso();
  st.saveGroup(kind, groupPath, manifest);
  return { status: 'ok', group: groupPath, name: target, label: entry.label, renamed };
}

// 资源搬家：跨分组移动（清单键迁移，代码目录整搬——风格与历史一起走）。
// 与 renameAsset 的分工：rename 只在同分组内改键与目录；move 换分组。
// 两种正常情况：源与目标同分组（原地不动，返回 skipped）；
// 源资源还没有目录（没写过代码——只动清单键，目录无从搬起）。
export function moveAsset({ kind, from, name, to }) {
  assertKind(kind);
  const fromPath = parseGroupPath(from);
  const toPath = parseGroupPath(to);
  if (fromPath === toPath) {
    return { status: 'skipped', group: fromPath, name, reason: '源与目标是同一分组' };
  }
  const src = resolveAsset(kind, fromPath, name);
  const targetManifest = st.loadGroup(kind, toPath);
  if (!targetManifest) throw notFound(`目标分组不存在: ${toPath}（先用 group add 建组）`);
  if (targetManifest.assets[src.entryName]) {
    return { status: 'blocked', group: toPath, name: src.entryName, reason: '目标分组已有同名资源' };
  }
  if (st.assetExists(kind, toPath, src.entryName)) {
    return { status: 'blocked', group: toPath, name: src.entryName, reason: '目标位置已有同名资源目录' };
  }

  st.moveAssetDir(kind, fromPath, toPath, src.entryName);
  delete src.manifest.assets[src.entryName];
  targetManifest.assets[src.entryName] = src.entry;
  st.saveGroup(kind, fromPath, src.manifest);
  st.saveGroup(kind, toPath, targetManifest);
  return { status: 'ok', from: fromPath, to: toPath, name: src.entryName };
}

// 同组资源排序：order 是「该分组全部资源名的新顺序」——与 groups.reorderSiblings
// 同一套约定：同集合重排校验（不多不少、不重复），然后写每个资源条目的 order = 0..n-1。
// 排序语义与目录一致：有 order 的按序在前，没有的按名字垫底（树两侧同规则）。
export function reorderAssets({ kind, group, order }) {
  assertKind(kind);
  const groupPath = parseGroupPath(group);
  if (!Array.isArray(order) || !order.length) throw badInput('需要 --order <资源名的完整新顺序>');
  const names = order.map(String);
  if (new Set(names).size !== names.length) throw badInput('order 里有重复的资源名');
  const manifest = st.loadGroup(kind, groupPath);
  if (!manifest) throw notFound(`分组不存在: ${groupPath}`);
  const missing = Object.keys(manifest.assets).filter((n) => !names.includes(n));
  if (missing.length) throw badInput(`order 缺少这些资源: ${missing.join(', ')}`);
  const unknown = names.filter((n) => !manifest.assets[n]);
  if (unknown.length) throw badInput(`order 里有不存在的资源: ${unknown.join(', ')}`);
  names.forEach((n, i) => {
    manifest.assets[n].order = i;
  });
  st.saveGroup(kind, groupPath, manifest);
  return { status: 'ok', group: groupPath, order: names };
}

export function removeAsset({ kind, group, name, force }) {
  assertKind(kind);
  const { groupPath, entryName, entry, manifest } = resolveAsset(kind, group, name);
  const styleNames = Object.keys(entry.styles);
  if (styleNames.length && !force) {
    return {
      status: 'blocked',
      group: groupPath,
      name: entryName,
      styles: styleNames.length,
      reason: '资源含风格，加 --force 连同风格与历史一起删除',
    };
  }
  delete manifest.assets[entryName];
  st.saveGroup(kind, groupPath, manifest);
  st.removeAssetDir(kind, groupPath, entryName);
  return { status: 'ok', group: groupPath, name: entryName, removed: { styles: styleNames.length } };
}

// ---- 标签（资源的检索轴，供 tree 筛选与搜索） ----

export function addTags({ kind, group, name, tags }) {
  const { groupPath, entryName, entry, manifest } = resolveAsset(kind, group, name);
  const incoming = normalizeTags(tags);
  if (!incoming.length) throw badInput('没有要添加的标签');
  const current = new Set(entry.tags || []);
  const added = incoming.filter((t) => !current.has(t));
  if (!added.length) {
    return { status: 'skipped', group: groupPath, name: entryName, tags: [...current], reason: '标签已存在' };
  }
  entry.tags = [...current, ...added];
  entry.updatedAt = nowIso();
  st.saveGroup(kind, groupPath, manifest);
  return { status: 'ok', group: groupPath, name: entryName, added, tags: entry.tags };
}

export function removeTags({ kind, group, name, tags }) {
  const { groupPath, entryName, entry, manifest } = resolveAsset(kind, group, name);
  const incoming = normalizeTags(tags);
  if (!incoming.length) throw badInput('没有要移除的标签');
  const current = new Set(entry.tags || []);
  const removed = incoming.filter((t) => current.has(t));
  if (!removed.length) {
    return { status: 'skipped', group: groupPath, name: entryName, tags: [...current], reason: '标签不存在' };
  }
  for (const t of removed) current.delete(t);
  entry.tags = [...current];
  entry.updatedAt = nowIso();
  st.saveGroup(kind, groupPath, manifest);
  return { status: 'ok', group: groupPath, name: entryName, removed, tags: entry.tags };
}
