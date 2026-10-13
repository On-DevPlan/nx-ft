// 风格与编辑历史业务：风格的增删切换、代码保存（自动进历史）、历史读取与恢复。
//
// 两种「回退」的层次（别混）：
//   风格 = 并存的整套实现（不限数量，用于对比验证）
//   历史 = 单个风格的保存快照（每风格滚动保留最近 5 条，用于改坏回滚）
import { badInput, notFound } from '../errors/index.js';
import { assertSafeName } from '../paths.js';
import { ASSET_KINDS, HISTORY_KEEP, assertKind, nowIso } from './constants.js';
import { assertStyle, newTag, resolveAsset, styleMeta } from './shared.js';
import * as st from './storage.js';

// ---- 风格（不限数量） ----

export const DESC_MAX = 200;

// 风格描述：一句话说明这套实现的特征（对比多套风格时扫一眼就懂）。
// 空串是合法输入——表示清除描述。
export function normalizeDesc(text) {
  const d = String(text ?? '').trim();
  if (d.length > DESC_MAX) throw badInput(`风格描述最长 ${DESC_MAX} 字符（当前 ${d.length}）`);
  return d;
}

export function setStyleDesc({ kind, group, name, style, text }) {
  const { groupPath, entryName, entry, manifest } = resolveAsset(kind, group, name);
  const styleName = assertSafeName(String(style ?? '').trim(), '风格名');
  assertStyle(entry, styleName);
  const desc = normalizeDesc(text);
  entry.styles[styleName].desc = desc;
  entry.updatedAt = nowIso();
  st.saveGroup(kind, groupPath, manifest);
  return { status: 'ok', group: groupPath, name: entryName, style: styleName, desc };
}

export function listStyles({ kind, group, name }) {
  const { groupPath, entryName, entry } = resolveAsset(kind, group, name);
  return {
    group: groupPath,
    name: entryName,
    activeStyle: entry.activeStyle,
    styles: Object.values(entry.styles)
      .map(styleMeta)
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export function addStyle({ kind, group, name, style, copyFrom, code, desc }) {
  const kindDef = ASSET_KINDS[assertKind(kind)];
  const { groupPath, entryName, entry, manifest } = resolveAsset(kind, group, name);
  const styleName = assertSafeName(String(style ?? '').trim(), '风格名');
  if (entry.styles[styleName]) {
    return { status: 'skipped', group: groupPath, name: entryName, style: styleName, reason: '已存在' };
  }
  if (code && copyFrom) throw badInput('--code 与 --copy-from 互斥，只能给一个');

  let files = null;
  let from = null;
  if (copyFrom) {
    const fromName = assertSafeName(String(copyFrom).trim(), '来源风格名');
    assertStyle(entry, fromName);
    from = fromName;
    files = st.readCodeFiles(kind, groupPath, entryName, fromName, kindDef.slots);
  } else if (code) {
    files = {};
    for (const slot of kindDef.slots) {
      if (code[slot] !== undefined) files[slot] = String(code[slot]);
    }
  }

  const slot = files ? kindDef.slots.find((s) => !!(files[s] || '').trim()) || kindDef.slots[0] : null;
  entry.styles[styleName] = {
    name: styleName,
    slot,
    desc: normalizeDesc(desc),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    history: [],
  };
  if (files) st.writeCodeFiles(kind, groupPath, entryName, styleName, files);
  entry.activeStyle = styleName;
  entry.styleCount = Object.keys(entry.styles).length;
  entry.updatedAt = nowIso();
  st.saveGroup(kind, groupPath, manifest);
  return { status: 'ok', group: groupPath, name: entryName, style: styleName, from, active: true };
}

export function setActiveStyle({ kind, group, name, style }) {
  const { groupPath, entryName, entry, manifest } = resolveAsset(kind, group, name);
  const styleName = assertSafeName(String(style ?? '').trim(), '风格名');
  assertStyle(entry, styleName);
  entry.activeStyle = styleName;
  entry.updatedAt = nowIso();
  st.saveGroup(kind, groupPath, manifest);
  return { status: 'ok', group: groupPath, name: entryName, activeStyle: styleName };
}

export function removeStyle({ kind, group, name, style }) {
  const { groupPath, entryName, entry, manifest } = resolveAsset(kind, group, name);
  const styleName = assertSafeName(String(style ?? '').trim(), '风格名');
  assertStyle(entry, styleName);
  delete entry.styles[styleName];
  if (entry.activeStyle === styleName) {
    entry.activeStyle = Object.keys(entry.styles)[0] || null;
  }
  entry.styleCount = Object.keys(entry.styles).length;
  entry.updatedAt = nowIso();
  st.saveGroup(kind, groupPath, manifest);
  st.removeStyleDir(kind, groupPath, entryName, styleName);
  return { status: 'ok', group: groupPath, name: entryName, style: styleName, activeStyle: entry.activeStyle };
}

// ---- 保存（每次保存把「改动前」推入编辑历史，最多留 HISTORY_KEEP 条） ----

export function saveCode({ kind, group, name, style, files }) {
  const kindDef = ASSET_KINDS[assertKind(kind)];
  const { groupPath, entryName, entry, manifest } = resolveAsset(kind, group, name);
  const styleName = assertSafeName(String(style ?? '').trim(), '风格名');
  assertStyle(entry, styleName);
  const meta = entry.styles[styleName];

  const incoming = {};
  for (const [slot, content] of Object.entries(files || {})) {
    if (!kindDef.slots.includes(slot)) throw badInput(`未知代码槽位: ${slot}（可用: ${kindDef.slots.join(' | ')}）`);
    incoming[slot] = String(content ?? '');
  }
  if (!Object.keys(incoming).length) throw badInput('没有要保存的内容（用 --code-html/--code-css/--code-js 或 --code 提供）');

  const before = st.readCodeFiles(kind, groupPath, entryName, styleName, kindDef.slots);
  const changed = Object.keys(incoming).some((s) => incoming[s] !== before[s]);
  if (!changed) {
    return { status: 'skipped', group: groupPath, name: entryName, style: styleName, reason: '内容无变化' };
  }

  const tag = newTag();
  st.snapshotStyle(kind, groupPath, entryName, styleName, tag, kindDef.slots);
  const history = Array.isArray(meta.history) ? meta.history : [];
  history.unshift({ id: tag, at: nowIso() });
  while (history.length > HISTORY_KEEP) {
    st.removeHistoryTag(kind, groupPath, entryName, styleName, history.pop().id);
  }
  meta.history = history;

  st.writeCodeFiles(kind, groupPath, entryName, styleName, incoming);
  meta.updatedAt = nowIso();
  const touched = Object.keys(incoming);
  if (!meta.slot || !(before[meta.slot] || '').trim()) {
    meta.slot = touched.find((s) => (incoming[s] || '').trim()) || meta.slot;
  }
  entry.updatedAt = nowIso();
  st.saveGroup(kind, groupPath, manifest);
  return {
    status: 'ok',
    group: groupPath,
    name: entryName,
    style: styleName,
    changed: touched,
    historyCount: history.length,
  };
}

// ---- 编辑历史 ----

export function listHistory({ kind, group, name, style }) {
  const { groupPath, entryName, entry } = resolveAsset(kind, group, name);
  const styleName = assertSafeName(String(style ?? '').trim(), '风格名');
  assertStyle(entry, styleName);
  return {
    group: groupPath,
    name: entryName,
    style: styleName,
    keep: HISTORY_KEEP,
    history: (entry.styles[styleName].history || []).map((h) => ({ id: h.id, at: h.at })),
  };
}

export function readHistory({ kind, group, name, style, entry: entryId }) {
  const kindDef = ASSET_KINDS[assertKind(kind)];
  const { groupPath, entryName, entry } = resolveAsset(kind, group, name);
  const styleName = assertSafeName(String(style ?? '').trim(), '风格名');
  assertStyle(entry, styleName);
  const id = String(entryId ?? '').trim();
  const hit = (entry.styles[styleName].history || []).find((h) => h.id === id);
  if (!hit) throw notFound(`历史不存在: ${id == null ? '(空)' : id}`);
  return {
    group: groupPath,
    name: entryName,
    style: styleName,
    entry: hit.id,
    at: hit.at,
    code: st.readCodeFiles(kind, groupPath, entryName, styleName, kindDef.slots, hit.id),
  };
}

export function restoreHistory({ kind, group, name, style, entry: entryId }) {
  const kindDef = ASSET_KINDS[assertKind(kind)];
  const { groupPath, entryName, entry, manifest } = resolveAsset(kind, group, name);
  const styleName = assertSafeName(String(style ?? '').trim(), '风格名');
  assertStyle(entry, styleName);
  const meta = entry.styles[styleName];
  const id = String(entryId ?? '').trim();
  const idx = (meta.history || []).findIndex((h) => h.id === id);
  if (idx < 0) throw notFound(`历史不存在: ${id == null ? '(空)' : id}`);

  // 恢复 = 把「当前」先推入历史（可再回滚到恢复前），再把快照写回当前。
  const tag = newTag();
  st.snapshotStyle(kind, groupPath, entryName, styleName, tag, kindDef.slots);

  const restored = {};
  for (const slot of kindDef.slots) {
    restored[slot] = st.readCodeFiles(kind, groupPath, entryName, styleName, kindDef.slots, id)[slot];
  }
  st.writeCodeFiles(kind, groupPath, entryName, styleName, restored);

  meta.history = [{ id: tag, at: nowIso() }, ...(meta.history || [])];
  while (meta.history.length > HISTORY_KEEP) {
    st.removeHistoryTag(kind, groupPath, entryName, styleName, meta.history.pop().id);
  }
  meta.updatedAt = nowIso();
  entry.updatedAt = nowIso();
  st.saveGroup(kind, groupPath, manifest);
  return { status: 'ok', group: groupPath, name: entryName, style: styleName, restored: id, historyCount: meta.history.length };
}
