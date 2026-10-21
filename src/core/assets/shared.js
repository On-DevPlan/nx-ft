// 资源定位与共享工具：assets.js（资源 CRUD）与 styles.js（风格/历史）都从这里取。
// 单独一层的原因：两边都需要「找资源 + 断言存在」，写在任一侧都会形成循环依赖。
//
// 每个入口都带 kind——它既决定去**哪棵分组树**里找，也决定这些路径怎么拼。
import { randomBytes } from 'node:crypto';
import { notFound } from '../errors/index.js';
import { assertSafeName } from '../paths.js';
import { assertKind, nowIso, parseGroupPathOrRoot, toTag } from './constants.js';
import * as st from './storage.js';

export function locate(kind, groupPath, name) {
  const manifest = st.loadGroup(kind, groupPath);
  if (!manifest) throw notFound(`分组不存在: ${groupPath}（先用 group add 建组）`);
  const entry = manifest.assets[name];
  if (!entry) throw notFound(`资源不存在: ${groupPath}/${name}`);
  return { manifest, entry };
}

export function assertStyle(entry, styleName) {
  if (!entry.styles[styleName]) {
    throw notFound(`风格不存在: ${styleName}（现有: ${Object.keys(entry.styles).join(', ') || '无'}）`);
  }
}

// 某个 kind 全库「实际用到的槽位」并集：空槽位的编辑框在面板上隐藏。
export function usedSlots(kind) {
  const used = new Set();
  for (const { manifest } of st.scanGroups(kind)) {
    for (const a of Object.values(manifest.assets)) {
      for (const s of Object.values(a.styles)) used.add(s.slot);
    }
  }
  return used;
}

export function newTag() {
  // 同一秒内多次保存也要拿到不同目录（快速连续保存是常态）
  return toTag(nowIso()) + '-' + randomBytes(2).toString('hex');
}

export function styleMeta(s) {
  return {
    name: s.name,
    slot: s.slot,
    desc: s.desc || '',
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    historyCount: Array.isArray(s.history) ? s.history.length : 0,
  };
}

// 供 actions 层复用的资源定位（返回写入用上下文）。group 允许空串 = 根
//（assets.js 的 desc/rename/remove/tags 与 styles.js 全部经这里放行根资源）。
export function resolveAsset(kind, group, name) {
  assertKind(kind);
  const groupPath = parseGroupPathOrRoot(group);
  const entryName = assertSafeName(String(name ?? '').trim(), '资源名');
  const { manifest, entry } = locate(kind, groupPath, entryName);
  return { groupPath, entryName, manifest, entry };
}
