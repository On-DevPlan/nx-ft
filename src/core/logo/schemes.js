// LOGO 撞色方案表 + 自定义色校验。
//
// 经典撞色短名单原则：一冷一暖 / 一深一浅，保证 16px favicon 下字母仍然跳得出来。
// 前 7 套承袭自 nx 家族模板（与模板 tools/logo-gen 的表一致）；
// 其余为常用场景补充（暗底/亮底/高饱和），用于给旧项目补 LOGO 时挑配色。
import { badInput } from '../errors/index.js';

export const SCHEMES = {
  // —— 家族原表（与模板保持一致，勿改色值）——
  klein: { name: '克莱因蓝', bg: '#002EA6', fg: '#FFE76F' },
  mars: { name: '马尔斯绿', bg: '#01847F', fg: '#F9D2E4' },
  hermes: { name: '爱马仕橙', bg: '#FF770F', fg: '#000026' },
  tiffany: { name: '蒂芙尼蓝', bg: '#80D1C8', fg: '#F8F5D6' },
  red: { name: '中国红', bg: '#FF0000', fg: '#FAEAD3' },
  vandyke: { name: '凡戴克棕', bg: '#492D22', fg: '#D8C7B5' },
  prussian: { name: '普鲁士蓝', bg: '#003153', fg: '#E5DDD7' },

  // —— 暗底（现代工具感，适合深色主题项目）——
  ink: { name: '墨黑', bg: '#14161A', fg: '#F5F6F7' },
  gold: { name: '黑金', bg: '#1C1B17', fg: '#E8C768' },
  royal: { name: '帝王紫', bg: '#4B2E83', fg: '#F2E9FF' },
  forest: { name: '森林绿', bg: '#0B3D2E', fg: '#D9F2C9' },

  // —— 亮底（适合浅色主题项目）——
  ash: { name: '雾灰', bg: '#E7E9EC', fg: '#3A4046' },
  lemon: { name: '柠檬黄', bg: '#FFE76F', fg: '#1C1B17' },

  // —— 高饱和（公告/活动位，远看醒目）——
  coral: { name: '珊瑚橘', bg: '#FF6B5B', fg: '#FFF3E0' },
};

export const DEFAULT_SCHEME = 'mars';

const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

export function normalizeHex(input, label = '颜色') {
  const s = String(input ?? '').trim();
  if (!HEX_RE.test(s)) {
    throw badInput(`${label}需为 6 位十六进制（如 #14161A），收到: ${input || '(空)'}`);
  }
  return ('#' + s.replace('#', '')).toUpperCase();
}

/**
 * 把「方案名 + 可选自定义 bg/fg」解析成一份确定的三元组。
 * 自定义色可只给一个（另一个沿用方案色）；方案名缺省用 DEFAULT_SCHEME。
 */
export function resolveScheme(name, { bg, fg } = {}) {
  const key = String(name ?? '').trim() || DEFAULT_SCHEME;
  const base = SCHEMES[key];
  if (!base) {
    throw badInput(`撞色方案不存在: ${key}（可选: ${Object.keys(SCHEMES).join(' / ')}）`);
  }
  const out = { key, name: base.name, bg: base.bg, fg: base.fg };
  if (bg !== undefined && bg !== '') out.bg = normalizeHex(bg, '--bg');
  if (fg !== undefined && fg !== '') out.fg = normalizeHex(fg, '--fg');
  if (out.bg !== base.bg || out.fg !== base.fg) out.name = base.name + '+自定义';
  return out;
}

export function listSchemes() {
  return Object.entries(SCHEMES).map(([key, s]) => ({ key, name: s.name, bg: s.bg, fg: s.fg }));
}
