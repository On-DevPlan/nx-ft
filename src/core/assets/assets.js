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
