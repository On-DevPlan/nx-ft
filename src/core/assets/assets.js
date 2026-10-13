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
  const manifest = st.loadGroup(groupPath);
  if (!manifest) throw notFound(`分组不存在: ${groupPath}（先用 group add 建组）`);
  if (manifest.assets[entryName]) return { status: 'skipped', group: groupPath, name: entryName, reason: '已存在' };

  const entry = {
    name: entryName,
    kind, // 资源属于哪个渲染类型（html|svg）——同一分组下两种资源互不串树
    label: labelOf(label, entryName),
    tags: normalizeTags(tags),
    activeStyle: null,
    styleCount: 0,
    styles: {},
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  manifest.assets[entryName] = entry;
  st.saveGroup(groupPath, manifest);

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
  const { entry } = locate(groupPath, entryName);
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
      map[s.name] = st.readCodeFiles(groupPath, entryName, s.name, slots);
    }
    out.code = map;
  }
  return { ...out, usedSlots: [...usedSlots()] };
}

export function renameAsset({ kind, group, name, label }) {
  assertKind(kind);
  const { groupPath, entryName, entry, manifest } = resolveAsset(kind, group, name);
  entry.label = labelOf(label, entryName);
  entry.updatedAt = nowIso();
  st.saveGroup(groupPath, manifest);
  return { status: 'ok', group: groupPath, name: entryName, label: entry.label };
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
  st.saveGroup(groupPath, manifest);
  st.removeAssetDir(groupPath, entryName);
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
  st.saveGroup(groupPath, manifest);
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
  st.saveGroup(groupPath, manifest);
  return { status: 'ok', group: groupPath, name: entryName, removed, tags: entry.tags };
}
