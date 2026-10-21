// 资产类型的公共常量与共享工具：html / svg / color 三个渲染模块共用。
import { badInput } from '../errors/index.js';
import { assertSafeName } from '../paths.js';

// slots 是每种类型当前的代码文件槽位——顺序即面板编辑框的展示顺序。
// 换类型的差异只有这张表：存储 / 分组 / 风格 / 历史逻辑完全共用。
//
// color 与 html/svg 形态不同：它存的是结构化 JSON（一个 Palette），不是源码。
// 槽位用单文件 'data'，复用 100% 的 saveCode / history / preview 管线。
export const ASSET_KINDS = {
  html: { label: 'HTML 资源', slots: ['html', 'css', 'js'] },
  svg: { label: 'SVG 资源', slots: ['svg', 'css', 'js'] },
  color: { label: '色彩资源', slots: ['data'] },
};

// 风格不限数量；每个风格只保留最近 5 条「保存历史」快照。
export const HISTORY_KEEP = 5;

export function assertKind(kind) {
  if (!ASSET_KINDS[kind]) {
    throw badInput(`未知资源类型: ${kind}（可用: ${Object.keys(ASSET_KINDS).join(' | ')}）`);
  }
  return kind;
}

// 分组路径：最多 8 段（支持多层目录树），段内用 assertSafeName 的同一套规则。
// 前导/尾随斜杠直接拒绝而不是静默归一——「/x」几乎总是写错的绝对路径。
export const GROUP_DEPTH_MAX = 8;

export function parseGroupPath(input) {
  const raw = String(input ?? '').trim();
  if (!raw) throw badInput('分组路径不能为空');
  if (/^[\\/]|[\\/]$/.test(raw)) throw badInput(`非法 分组路径（不要前导/尾随斜杠）: ${raw}`);
  const segs = raw.split(/[\\/]+/).filter(Boolean);
  if (!segs.length || segs.length > GROUP_DEPTH_MAX) {
    throw badInput(`分组路径需要 1~${GROUP_DEPTH_MAX} 段（如 ui/buttons/primary），收到: ${input || '(空)'}`);
  }
  for (const s of segs) assertSafeName(s, '分组名');
  return segs.join('/');
}

// 「根」是一等分组：空路径 = groups/<kind>/ 本身（根清单 group.json 就在那里，
// 根资源在 groups/<kind>/assets/<名>/）。**资源级**入口用它；
// 分组级入口（建/改名/删分组）仍走 parseGroupPath——根不可创建、不可删除。
export function parseGroupPathOrRoot(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return '';
  return parseGroupPath(raw);
}

// 2-slot 命令（group/name）的 CLI 左移：`html add btn` → group=''、name='btn'。
//
// 只在「恰好给了一个位置参数」时左移（name 缺、group 有）。3-slot 命令
// （style.* / history.* / move）**不做**这种推断：`style add ui x` 既可能指
// 「组 ui 的资源 x（缺 style）」也可能指「根资源 ui 的风格 x」——静默二选一
// 必然有人中招，那里保持 group 位置参数必填（根变体走 HTTP / 面板）。
export function shiftGroupName(ctx) {
  if (ctx.name !== undefined) return ctx; // 两段齐全（HTTP 恒走这里）：原样放行
  if (ctx.group === undefined) return ctx; // 全缺：后续必填校验会报缺参
  return { ...ctx, group: '', name: ctx.group };
}

export const nowIso = () => new Date().toISOString();

export const toTag = (iso) => String(iso || '').replace(/[-:]/g, '').replace(/\..*$/, '').replace('T', '-');

// ---- 标签 ----
//
// 标签是「100+ 资源怎么找得回来」的检索轴：小写存储、空白转 -、允许汉字。
// 归一化在入口做一次，之后比较全部按归一化后的字符串，不再有隐性差异。
export const TAG_MAX = 24;

export function normalizeTag(input) {
  const t = String(input ?? '').trim().toLowerCase().replace(/\s+/g, '-');
  if (!t) throw badInput('标签不能为空');
  if (t.length > TAG_MAX) throw badInput(`标签最长 ${TAG_MAX} 字符: ${t}`);
  if (!/^[\p{L}\p{N}][\p{L}\p{N}_.-]*$/u.test(t)) {
    throw badInput(`非法标签: ${t}（可用字母 / 数字 / 汉字 / - _ .）`);
  }
  return t;
}

export function normalizeTags(list) {
  return [...new Set((list || []).map(normalizeTag))];
}
