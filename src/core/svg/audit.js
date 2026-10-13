// 全库规范审计与批量归一化。
//
// 与 spec.js 的分工：spec.js 处理「一个 SVG 字符串」，本文件处理「整个资源库」——
// 遍历、限定范围、汇总，以及**通过 styles.saveCode 写回**。
//
// 为什么修复必须走 saveCode 而不是直接覆盖文件：批量改上百个图标是不可逆操作，
// 而 saveCode 会把「改动前」推入该风格的编辑历史（每风格留最近 5 条），
// 用户改坏了能用 `svg history restore` 逐条退回。绕过它做批量写 = 一次性摧毁可回退性。
import { saveCode } from '../assets/styles.js';
import { assertKind } from '../assets/constants.js';
import { badInput } from '../errors/index.js';
import * as st from '../assets/storage.js';
import { ICON_SPEC, PROFILES, auditSvg, normalizeSvg } from './spec.js';

const SLOTS = ['svg', 'css', 'js'];

function targetGroups(kind, group) {
  const all = st.scanGroups(kind);
  const scoped = group ? all.filter((g) => g.groupPath === group) : all;
  if (group && !scoped.length) {
    const similar = all.map((g) => g.groupPath).filter((p) => p.includes(group));
    return { groups: [], hint: similar.length ? `你是不是想找：${similar.join(' / ')}` : '用 svg tree 看现有分组' };
  }
  return {
    groups: scoped.map((g) => ({
      path: g.groupPath,
      label: g.manifest.group.label || g.groupPath,
      assets: Object.values(g.manifest.assets).filter((a) => a.kind === kind),
    })),
    hint: null,
  };
}

export function checkLibrary(kind, { group, profile = 'line' } = {}) {
  assertKind(kind);
  if (!PROFILES.includes(profile)) throw badInput(`未知档位: ${profile}（可用: ${PROFILES.join(' | ')}）`);
  const { groups, hint } = targetGroups(kind, group);
  if (hint) return { status: 'ok', group, hint, groups: [], stats: emptyStats() };
  const out = [];
  const stats = emptyStats();
  for (const g of groups) {
    for (const a of g.assets) {
      const style = a.activeStyle || Object.keys(a.styles)[0];
      const svg = style ? st.readCodeFiles(kind, g.path, a.name, style, SLOTS).svg || '' : '';
      const audit = auditSvg(svg, { profile });
      stats.assets++;
      stats.issues += audit.issues.length;
      if (audit.issues.length) stats.flagged++;
      else stats.compliant++;
      if (audit.issues.length || !svg) {
        out.push({
          group: g.path,
          groupLabel: g.label,
          name: a.name,
          label: a.label || a.name,
          style: style || null,
          bytes: audit.meta ? audit.meta.bytes : 0,
          issues: audit.issues,
        });
      }
    }
  }
  return { status: 'ok', group: group || null, profile, spec: ICON_SPEC, stats, flagged: out };
}

export function fixLibrary(kind, { group, style, profile = 'line', dryRun = false } = {}) {
  assertKind(kind);
  const { groups, hint } = targetGroups(kind, group);
  if (hint) return { status: 'ok', group, hint, changed: [], unchanged: 0, skipped: 0 };

  const changed = [];
  const unchanged = [];
  const failed = [];
  const touched = [];

  for (const g of groups) {
    for (const a of g.assets) {
      // 指定了 style 就只修那个；否则修「当前风格」。全库批量修复是有破坏性的，
      // 所以不提供「修所有风格」——那等于把一套设计稿里刻意保留的对比版本一起抹平。
      const targetStyle = style || a.activeStyle || Object.keys(a.styles)[0];
      if (!targetStyle || !a.styles[targetStyle]) {
        failed.push({ group: g.path, name: a.name, reason: '没有可修复的风格' });
        continue;
      }
      const before = st.readCodeFiles(kind, g.path, a.name, targetStyle, SLOTS).svg || '';
      const norm = normalizeSvg(before, { profile });
      if (!norm.ok) {
        failed.push({ group: g.path, name: a.name, reason: norm.error });
        continue;
      }
      if (!norm.changed.length) {
        unchanged.push({ group: g.path, name: a.name, style: targetStyle });
        continue;
      }
      const rec = { group: g.path, groupLabel: g.label, name: a.name, label: a.label || a.name, style: targetStyle, changed: norm.changed };
      if (dryRun) {
        changed.push(rec);
        continue;
      }
      const r = saveCode({ kind, group: g.path, name: a.name, style: targetStyle, files: { svg: norm.code } });
      if (r.status === 'skipped') unchanged.push({ group: g.path, name: a.name, style: targetStyle });
      else {
        changed.push({ ...rec, historyCount: r.historyCount });
        touched.push(`${g.path}/${a.name}@${targetStyle}`);
      }
    }
  }

  return {
    status: 'ok',
    dryRun,
    profile,
    changed,
    unchanged: unchanged.length,
    failed,
    history: touched.length,
  };
}

function emptyStats() {
  return { groups: 0, assets: 0, compliant: 0, flagged: 0, issues: 0 };
}

export function renderCheck(r) {
  if (r.hint) return `没有匹配的分组。${r.hint}`;
  const { stats } = r;
  if (!stats.assets) return '库里还没有可审计的资源（先 svg add 或 svg import）';
  const lines = [
    `审计 ${stats.assets} 个资源 · 合规 ${stats.compliant} · 待规范 ${stats.flagged} · 共 ${stats.issues} 条问题`,
  ];
  for (const f of r.flagged.slice(0, 30)) {
    lines.push(`  ${f.group}/${f.name}${f.style ? '@' + f.style : ''}`);
    for (const i of f.issues) lines.push(`      [${i.level}] ${i.code}: ${i.message}`);
  }
  if (r.flagged.length > 30) lines.push(`  …… 还有 ${r.flagged.length - 30} 个未列出（--json 取全量）`);
  lines.push('', '用 svg spec fix <分组> 批量归一化');
  return lines.join('\n');
}

export function renderFix(r) {
  if (r.hint) return `没有匹配的分组。${r.hint}`;
  const head = r.dryRun ? '将要修复（--dry-run，未写入）' : `已修复（历史 ${r.history} 条）`;
  const lines = [`${head} · 改动 ${r.changed.length} 个 · 已合规 ${r.unchanged} 个`];
  for (const c of r.changed.slice(0, 30)) {
    lines.push(`  ${c.group}/${c.name}@${c.style}  → ${c.changed.join('，')}`);
  }
  if (r.changed.length > 30) lines.push(`  …… 还有 ${r.changed.length - 30} 个未列出（--json 取全量）`);
  if (r.failed.length) {
    lines.push('', `失败 ${r.failed.length} 个：`);
    for (const f of r.failed) lines.push(`  ${f.group}/${f.name} —— ${f.reason}`);
  }
  if (r.dryRun && r.changed.length) lines.push('', '去掉 --dry-run 即写入（改动前进编辑历史，可 history restore 回退）');
  return lines.join('\n');
}
