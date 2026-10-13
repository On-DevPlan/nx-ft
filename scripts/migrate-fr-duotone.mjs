// 一次性迁移：把 fr 的 48 枚图标从「被压成单色」恢复成正确档位。
//
// 背景：之前用默认 line 档跑了一遍 spec fix，把双色图标的点缀色也换成了 currentColor，
// 双色层次被抹平。原始代码还在编辑历史里，这里读回来按正确档位重做：
//   双色（含 #5B7CFA 主题蓝）→ duotone：蓝 → currentColor（跟主题走），深色保留
//   单色                     → line：全部 → currentColor
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { normalizeSvg } from '../src/core/svg/spec.js';
import * as styles from '../src/core/assets/styles.js';

const GROUP = 'fr';
const ACCENT = '#5B7CFA'; // 这批图标的设计里，蓝是主题色、深色是固定的底
const root = path.join(os.homedir(), '.nx-ft/assets/groups/svg', GROUP, 'assets');

const report = { duotone: [], line: [], skipped: [] };

for (const name of fs.readdirSync(root)) {
  const styleDir = path.join(root, name, 'styles', 'default');
  if (!fs.existsSync(styleDir)) {
    report.skipped.push(`${name}（无 default 风格）`);
    continue;
  }
  // 取最近一条历史快照 = 修复前的原始代码
  const histDir = path.join(styleDir, 'history');
  const entries = fs.existsSync(histDir)
    ? fs.readdirSync(histDir).sort()
    : [];
  if (!entries.length) {
    report.skipped.push(`${name}（无历史）`);
    continue;
  }
  const svgFile = path.join(histDir, entries[entries.length - 1], 'svg');
  if (!fs.existsSync(svgFile)) {
    report.skipped.push(`${name}（历史里没有 svg）`);
    continue;
  }
  const original = fs.readFileSync(svgFile, 'utf8');

  const colors = new Set();
  for (const m of original.matchAll(/#[0-9a-fA-F]{6}/g)) colors.add(m[0].toUpperCase());
  const hasAccent = colors.has(ACCENT);
  const profile = colors.size > 1 && hasAccent ? 'duotone' : 'line';

  const norm = normalizeSvg(original, { profile, accent: profile === 'duotone' ? ACCENT : undefined });
  if (!norm.ok) {
    report.skipped.push(`${name}（归一化失败: ${norm.error}）`);
    continue;
  }
  const r = styles.saveCode({
    kind: 'svg',
    group: GROUP,
    name,
    style: 'default',
    files: { svg: norm.code },
  });
  (profile === 'duotone' ? report.duotone : report.line).push(`${name} [${r.status}]`);
}

console.log(`双色档 ${report.duotone.length} 枚:`);
report.duotone.slice(0, 3).forEach((x) => console.log('  ', x));
console.log(`单色档 ${report.line.length} 枚:`, report.line.join(', '));
if (report.skipped.length) console.log('跳过:', report.skipped.join('; '));
