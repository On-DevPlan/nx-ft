// SVG 编辑页「颜色」面板的纯函数层：颜色解析与格式化、和声派生、对比度、
// 最近使用色。与 color-vars.js 同一套规矩——引擎独立成纯函数文件，供 node
// 单测钉死（tests/unit/svg-color-utils.test.mjs）；面板组件只该管「画」。
//
// 前端不能 import core（lint 分层规则），颜色数学走 culori（已在依赖里，
// color-studio 也用它）。
import { converter, wcagContrast } from 'culori';

const toRgb = converter('rgb');
const toHsl = converter('hsl');

// 最近使用色最多留多少个（面板上一行放得下的量级）。
export const MAX_RECENT = 16;

// 和声派生规则：每档给出一组色相偏移（度）。单色不走色相，走明度。
export const HARMONY_TYPES = [
  { id: 'complementary', label: '互补', offsets: [180] },
  { id: 'triadic', label: '三角', offsets: [120, 240] },
  { id: 'analogous', label: '类似', offsets: [-30, 30] },
  { id: 'split', label: '分裂互补', offsets: [150, 210] },
  { id: 'monochrome', label: '单色', offsets: [] },
];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v) => clamp(Number(v) || 0, 0, 1);
const byte = (v) => clamp(Math.round(Number(v) || 0), 0, 255);
const hex2 = (v) => byte(v).toString(16).padStart(2, '0').toUpperCase();
const round3 = (n) => Math.round(Number(n) * 1000) / 1000;

// 规范化颜色输入 → #RRGGBB / #RRGGBBAA（大写）。
// 认得 #rgb / #rgba / #rrggbb / #rrggbbaa、无 # 前缀、0x 前缀；认不得返回 null。
export function normalizeHex(input) {
  let s = String(input ?? '').trim();
  if (!s) return null;
  if (/^0x/i.test(s)) s = '#' + s.slice(2);
  if (s[0] !== '#') s = '#' + s;
  const body = s.slice(1);
  if (!/^[0-9a-fA-F]+$/.test(body)) return null;
  if (body.length === 3 || body.length === 4) {
    return '#' + body.split('').map((c) => c + c).join('').toUpperCase();
  }
  if (body.length === 6 || body.length === 8) return '#' + body.toUpperCase();
  return null;
}

// hex → { r, g, b (0-255), a (0-1) }；认不得返回 null。
export function hexToRgb(hex) {
  const norm = normalizeHex(hex);
  if (!norm) return null;
  const body = norm.slice(1);
  return {
    r: parseInt(body.slice(0, 2), 16),
    g: parseInt(body.slice(2, 4), 16),
    b: parseInt(body.slice(4, 6), 16),
    a: body.length === 8 ? parseInt(body.slice(6, 8), 16) / 255 : 1,
  };
}

// rgb → hex（a < 1 时给 8 位带透明度的形式）。
export function rgbToHex({ r, g, b, a = 1 }) {
  const base = '#' + hex2(r) + hex2(g) + hex2(b);
  if (!Number.isFinite(Number(a)) || Number(a) >= 1) return base;
  return base + hex2(Math.round(clamp01(a) * 255));
}

// 规范形：把任意输入收敛成面板内部唯一存放的形式（大写、alpha < 1 才带 8 位）。
export function canonicalHex(hex) {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHex(rgb) : null;
}

// hex → { h (0-360), s (0-1), l (0-1), a }。
export function hexToHsl(hex) {
  const norm = normalizeHex(hex);
  if (!norm) return null;
  const c = toHsl(norm);
  if (!c) return null;
  return {
    h: ((Number(c.h) || 0) % 360 + 360) % 360,
    s: clamp01(c.s),
    l: clamp01(c.l),
    a: c.alpha ?? 1,
  };
}

// hsl → hex（h 度 / s、l 取 0-1）。
export function hslToHex({ h, s, l, a = 1 }) {
  const rgb = toRgb({
    mode: 'hsl',
    h: ((Number(h) || 0) % 360 + 360) % 360,
    s: clamp01(s),
    l: clamp01(l),
  });
  if (!rgb) return null;
  return rgbToHex({ r: rgb.r * 255, g: rgb.g * 255, b: rgb.b * 255, a });
}

// 展示串：'hex' | 'rgb' | 'hsl'。
export function formatAs(hex, format) {
  const norm = canonicalHex(hex);
  if (!norm) return '';
  const { r, g, b, a } = hexToRgb(norm);
  if (format === 'rgb') {
    return a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${round3(a)})`;
  }
  if (format === 'hsl') {
    const { h, s, l } = hexToHsl(norm);
    const parts = `${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%`;
    return a >= 1 ? `hsl(${parts})` : `hsla(${parts}, ${round3(a)})`;
  }
  return norm;
}

// RGB 数值输入（0-255）+ 透明度（0-1）→ hex。
export function rgbInputToHex(r, g, b, a = 1) {
  return rgbToHex({ r, g, b, a });
}

// HSL 数值输入（h 度 / s、l 取 0-100）+ 透明度（0-1）→ hex。
export function hslInputToHex(h, s, l, a = 1) {
  return hslToHex({ h, s: clamp01(Number(s) / 100), l: clamp01(Number(l) / 100), a });
}

// 和声派生：从基准色生出一组配套色（点一下就能套到当前槽）。
export function harmonyColors(hex, type) {
  const base = hexToHsl(hex);
  if (!base) return [];
  if (type === 'monochrome') {
    return [0.22, -0.22]
      .map((d) => hslToHex({ ...base, l: clamp01(base.l + d) }))
      .filter(Boolean);
  }
  const spec = HARMONY_TYPES.find((t) => t.id === type);
  if (!spec) return [];
  return spec.offsets.map((d) => hslToHex({ ...base, h: base.h + d })).filter(Boolean);
}

// 对比度：这个色块上该压黑字还是白字；顺带给与白 / 黑的对比度数值。
export function contrastInfo(hex) {
  const norm = canonicalHex(hex);
  if (!norm) return null;
  const onWhite = wcagContrast(norm, '#ffffff');
  const onBlack = wcagContrast(norm, '#000000');
  return {
    onWhite: round3(onWhite),
    onBlack: round3(onBlack),
    ink: onWhite >= onBlack ? '#ffffff' : '#14161a',
  };
}

// 最近使用色：新的排最前，同色去重，最多 max 个。
export function pushRecent(list, hex, max = MAX_RECENT) {
  const norm = canonicalHex(hex);
  const old = Array.isArray(list) ? list : [];
  if (!norm) return old.slice(0, max);
  const rest = old.filter((h) => canonicalHex(h) !== norm);
  return [norm, ...rest].slice(0, max);
}

export const RECENT_KEY = 'nx-ft:svg-color-recent';

// 读最近使用色（localStorage）。隐私模式 / 读失败 → 空列表，不影响调色本身。
export function loadRecent() {
  try {
    const arr = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    if (!Array.isArray(arr)) return [];
    return arr.map(canonicalHex).filter(Boolean).slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

// 存最近使用色。写失败（配额满）静默——这是锦上添花，不该打断调色。
export function saveRecent(list) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify((Array.isArray(list) ? list : []).slice(0, MAX_RECENT)));
  } catch {
    /* 忽略 */
  }
}
