// SVG 颜色变量的引擎：解析声明、把硬编码字面量迁移成 var() 用法、生成预览覆盖样式。
//
// 为什么独立成文件：这套规则要被单测钉死（tests/unit/svg-color-vars.test.mjs），
// 而面板组件（color-panel.jsx）只该管「画」。前端不能 import core（lint 分层规则），
// 引擎放这里（与 color-panel 复刻 COLOR_RE 同一先例）。
//
// 模板化后的形态（自包含——变量声明失效时每处用法还有 fallback 兜底）：
//   <svg ...>
//     <style>svg{--c-1:#2B3445;--c-2:#FFB0A5}</style>   ← 主题层：一处声明
//     <path style="fill:var(--c-1,#2B3445)" .../>        ← 用法：字面量迁进 inline style
//   </svg>
// 走 inline style 与 <style> 块是因为 var() 在这两处全环境可用；展现属性
// （fill="var(--x)"）浏览器实现不一，不采用。

// 颜色属性取值（与 core/svg/spec.js 的 COLOR_PROP 同口径，前端不引 Node 模块，复刻一份）。
const COLOR_RE = /(?<![-\w])(?:fill|stroke|color)\s*[:=]\s*("[^"]*"|'[^']*'|[^"';\s>}]+)/gi;
const SKIP = new Set(['none', 'currentcolor', 'inherit', 'transparent', 'context-fill', 'context-stroke']);
// 托管声明块：一个 <style>，内容形如 svg{--c-1:...;--c-2:...}
const DECL_BLOCK_RE = /<style>\s*(svg\{[^<]*\})\s*<\/style>/;
const DECL_ITEM_RE = /(--c-[a-z0-9-]+)\s*:\s*([^;}]+)/gi;
// 开标签（属性值里允许带引号与 >）；标签内属性段单抓，便于 style 合并
const OPEN_TAG_RE = /<([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>])*)>/g;
const ATTR_RE = /\s(fill|stroke|color)\s*=\s*("([^"]*)"|'([^']*)')/gi;
const STYLE_ATTR_RE = /\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i;

const isColorable = (value) =>
  !!value && !SKIP.has(value.toLowerCase()) && !value.startsWith('url(') && !value.startsWith('var(');

// 收集 SVG 里的硬编码颜色字面量（排除跟随语义），去重保序。
export function collectHardcoded(svg) {
  const found = new Set();
  let m;
  COLOR_RE.lastIndex = 0;
  while ((m = COLOR_RE.exec(String(svg || '')))) {
    const raw = m[1];
    const quote = /^["']/.test(raw) ? raw[0] : '';
    const v = (quote ? raw.slice(1, -1) : raw).trim();
    if (isColorable(v)) found.add(v);
  }
  return [...found];
}

// 读托管声明块里的变量（{name, value}，按声明序）。
export function parseVarDecls(svg) {
  const out = [];
  const block = DECL_BLOCK_RE.exec(String(svg || ''));
  if (!block) return out;
  let m;
  DECL_ITEM_RE.lastIndex = 0;
  while ((m = DECL_ITEM_RE.exec(block[1]))) out.push({ name: m[1], value: m[2].trim() });
  return out;
}

// 生成/更新托管声明块（幂等：已有块整体替换，没有则插到 <svg …> 开标签之后）。
export function upsertDeclBlock(svg, vars) {
  if (!vars.length) return svg;
  const block = `<style>svg{${vars.map((v) => `${v.name}:${v.value}`).join(';')}}</style>`;
  const s = String(svg || '');
  if (DECL_BLOCK_RE.test(s)) return s.replace(DECL_BLOCK_RE, block);
  const open = /<svg\b[^>]*>/i.exec(s);
  if (!open) return s;
  const at = open.index + open[0].length;
  return s.slice(0, at) + block + s.slice(at);
}

// 预览覆盖样式：追加到 iframe 文档尾（同 svg 选择器、后来居上），不碰源码。
export function varOverrideCss(vars) {
  const entries = Object.entries(vars || {}).filter(([, v]) => v);
  if (!entries.length) return '';
  return `svg{${entries.map(([name, value]) => `${name}:${value}`).join(';')}}`;
}

// 迁移：硬编码字面量 → var() 用法 + 托管声明块。同值共用一个变量（按首次出现序编号）。
//   开标签里的 fill/stroke/color 属性 → 并进该元素的 style（渲染语义保持：style 里
//   已声明同属性时，那个属性本来就是死值——直接删属性、不建变量）；
//   <style> 块 CSS 里的字面量 → 原地换成 var(--c-N,value)。
// 返回 { svg, vars, count }；无可迁移项时 count=0、svg 原样（迁完再迁不再变化 = 幂等）。
export function migrateToVars(svg) {
  const src = String(svg || '');
  const byValue = new Map(); // 规范化值 → 变量名
  const decls = [];          // 按首次出现序
  let count = 0;
  const nameOf = (value) => {
    const key = value.toLowerCase();
    if (!byValue.has(key)) {
      const name = `--c-${byValue.size + 1}`;
      byValue.set(key, name);
      decls.push({ name, value });
    }
    return byValue.get(key);
  };

  // 1) 开标签属性：fill/stroke/color="字面量" → style="…:var(--c-N,value)"
  let out = src.replace(OPEN_TAG_RE, (whole, tag, attrs) => {
    let add = '';
    const selfClose = /\/\s*$/.test(attrs) ? ' /' : '';
    const body = attrs.replace(/\/\s*$/, '');
    const stripped = body.replace(ATTR_RE, (aw, prop, aq, dq, sq) => {
      const value = (dq ?? sq ?? '').trim();
      if (!isColorable(value)) return aw;
      const sm = body.match(STYLE_ATTR_RE);
      const existing = sm ? (sm[1] ?? sm[2] ?? '') : '';
      if (new RegExp(`(?:^|;)\\s*${prop}\\s*:`, 'i').test(existing)) return ''; // 死值：删掉即可
      const name = nameOf(value);
      count += 1;
      add += `${prop.toLowerCase()}:var(${name},${value});`;
      return '';
    });
    // 没动过任何属性（没有迁移项、也没有死值要删）→ 原样返回，保持字节不变
    if (!add && stripped === body) return whole;
    // 只有死值被删（add 为空）：按 stripped 重建即可
    if (!add) return `<${tag}${stripped}${selfClose}>`;
    const sm = stripped.match(STYLE_ATTR_RE);
    if (sm) {
      // 已有 style：迁移值放前面（后声明的原 style 仍赢，渲染语义不变）
      const existing = sm[1] ?? sm[2] ?? '';
      const merged = ` style="${add}${existing}"`;
      return `<${tag}${stripped.replace(STYLE_ATTR_RE, merged)}${selfClose}>`;
    }
    return `<${tag}${stripped} style="${add.slice(0, -1)}"${selfClose}>`;
  });

  // 2) <style> 块 CSS：fill/stroke/color: 字面量 → var(--c-N,value)
  out = out.replace(/(<style[\s\S]*?<\/style>)/gi, (block) =>
    block.replace(COLOR_RE, (whole, raw) => {
      const quote = /^["']/.test(raw) ? raw[0] : '';
      const value = (quote ? raw.slice(1, -1) : raw).trim();
      if (!isColorable(value)) return whole;
      const name = nameOf(value);
      count += 1;
      return whole.replace(raw, `${quote}var(${name},${value})${quote}`);
    })
  );

  // 声明块最后统一插（等所有变量收齐）
  out = upsertDeclBlock(out, decls);
  return { svg: out, vars: decls, count };
}
