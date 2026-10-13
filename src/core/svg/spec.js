// 图标规范：一套「优雅且一致」的 SVG 图标集，靠的不是审美，而是**可校验的约束**。
//
// 本文件是这套约束的唯一定义处，也是「解析 / 审计 / 归一化」三件事的实现：
//   parseSvg   —— 把一个 SVG 字符串拆成结构信息（viewBox / 尺寸 / 颜色 / 图元数）
//   auditSvg   —— 拿结构与规范比对，逐条给出「哪里不合规、为什么、怎么改」
//   normalize  —— 按规范就地改写（统一 viewBox、去掉写死的宽高、颜色换成 currentColor）
//
// 为什么这些必须是**纯函数**：面板的看板要对上百个图标实时做审计，CLI 要能批量跑，
// 两边必须得出完全一样的结果。放进 core（无业务语义、无 IO）是唯一能保证这点的位置。
//
// 关于实现：这里用正则解析而不是引入 DOM 库。理由是本项目只依赖 react，
// 而图标级 SVG 的结构简单（单根 + 少量图元），正则足够；
// 换成重量级解析器会让「装完包就能跑」这个前提变脆。代价是不支持任意畸形 SVG——
// 遇到解析不了的输入一律报 ok:false，而不是猜。

// ---- 规范本身 ----
//
// 24pt 网格 / 1.8pt 线宽 / round 线帽与连接 / 颜色一律 currentColor。
// 这几条就是「看起来齐」的全部来源：几何落在整数网格上，线宽全组一致，
// 颜色不写死所以在任何主题下都能换肤。
export const ICON_SPEC = {
  viewBox: '0 0 24 24',
  grid: 24,
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  color: 'currentColor',
};

// 归一化档位：
//   auto    —— **默认**：按资源的实际形态自动判档（见 detectProfile）。
//              用图标尺子量动画/插画会报一堆改不掉的问题，所以默认不套图标那套。
//   line    —— 单色线性图标：全部颜色 → currentColor + 补齐描边根属性
//   duotone —— 双色图标：**其中一个色是主题色**（换成 currentColor，跟着主题切换），
//              其余色值是有意的点缀色，保留不动。用 --accent 指定哪个色值是主题色。
//   color   —— 插画 / 品牌标 / 带动画的图形：颜色与线宽全部保留，只统一几何容器
export const PROFILES = ['auto', 'line', 'duotone', 'color'];

// 把档位落到具体一档：auto 交给 detectProfile（定义在下方，这里只做字符串归一）
function resolveProfile(profile, src) {
  const p = String(profile ?? 'auto');
  if (p === 'auto') return detectProfile(src);
  return PROFILES.includes(p) ? p : 'auto';
}

// 这些颜色值不算「写死」——它们本身就是「跟随外部/无填充」的意思。
const INHERENT_COLORS = new Set([
  'none',
  'currentcolor',
  'inherit',
  'transparent',
  'context-fill',
  'context-stroke',
]);

// ---- 「属性写在哪」的定义只此一处 ----
//
// 审计（collect*）与归一化（unify*）必须用同一套正则，否则会出现
// 「fix 悄悄改了一个 check 从没报过的东西」这种不对称。真实踩过两次：
//
//   1. 取值模式里没有引号分支，于是 `stroke="#2B3445"`（最常见的写法！）
//      从来没被报成 hardcoded-color，而 unifyColors 照改不误。
//   2. 收集线宽时不跳过 `var(...)`，而改写时会跳过——于是一个用了 CSS 变量的图标
//      会永远显示「待规范」，且 `spec fix` 报「改动 0 个」，怎么修都清不掉。
//
// 属性名用否定环视而不是 \b：`background-color` / `flood-color` 里也含 `color`，
// `\b` 会把它们一并算进来，既会误报也会被误改成 currentColor。
const COLOR_PROP = '(?<![-\\w])(?:fill|stroke|color)';
const STROKE_WIDTH_PROP = '(?<![-\\w])stroke-width';
const VALUE = '("[^"]*"|\'[^\']*\'|[^"\';;\\s>}]+)';

// 这两类值改写会破坏设计意图，收集与改写都必须一致地跳过。
function isInherentValue(v) {
  const s = String(v || '').trim();
  return !s || INHERENT_COLORS.has(s.toLowerCase()) || s.startsWith('url(') || s.startsWith('var(');
}

// var(--x) 这类主题变量引用：解析不出最终值，所以既不能改、也不该报。
// 三处（收集 / 改写 / 根元素检查）共用这一个判据——早期三处各写一遍，
// 结果是「报得出来但修不掉」，图标会永远挂着「待规范」。
function isVarRef(v) {
  return String(v ?? '').trim().startsWith('var(');
}

function unquote(raw) {
  return String(/^["']/.test(raw) ? raw.slice(1, -1) : raw).trim();
}

function propRe(prop) {
  return new RegExp(prop + '\\s*[:=]\\s*' + VALUE, 'gi');
}

// 扫描整份源码里出现的**颜色字面量**（含 <style> 内的 CSS 声明）。
// 判定口径：fill / stroke / color 三处的取值，排除 none / currentColor / url() / var() 这类「跟随」语义。
export function collectColors(src) {
  const found = new Set();
  const re = propRe(COLOR_PROP);
  let m;
  while ((m = re.exec(src))) {
    const v = unquote(m[1]);
    if (isInherentValue(v)) continue;
    found.add(v);
  }
  return [...found];
}

// 扫描整份源码里声明过的 stroke-width（含子图元与 <style> 内的 CSS）。
//
// 只检查根元素是不够的：一个把 stroke-width 写在 <circle> 上的图标，
// 根上可能完全合规，但实际渲染出来比同组其他图标粗一圈——「看起来不齐」就是这么来的。
export function collectStrokeWidths(src) {
  const found = new Set();
  const re = propRe(STROKE_WIDTH_PROP);
  let m;
  while ((m = re.exec(src))) {
    const v = unquote(m[1]);
    // var(--x) 是刻意的主题变量，不该被算作「不规范」
    if (!v || v.startsWith('var(')) continue;
    found.add(v);
  }
  return [...found];
}

// ---- 解析 ----

function readAttrs(tag) {
  const out = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(tag))) out[m[1].toLowerCase()] = m[3] !== undefined ? m[3] : m[4];
  return out;
}

const ELEMENT_KINDS = ['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse'];

export function parseSvg(code) {
  const src = String(code ?? '');
  const bytes = Buffer.byteLength(src, 'utf8');
  const m = src.match(/<svg\b[^>]*>/i);
  if (!m) {
    return {
      ok: false,
      error: '缺少 <svg> 根元素',
      bytes,
      root: null,
      stats: { elements: 0, groups: 0 },
      colors: [],
      strokeWidths: [],
    };
  }
  const root = readAttrs(m[0]);
  const stats = { elements: 0, groups: 0 };
  for (const kind of ELEMENT_KINDS) {
    const n = (src.match(new RegExp('<' + kind + '\\b', 'gi')) || []).length;
    stats[kind] = n;
    stats.elements += n;
  }
  stats.groups = (src.match(/<g\b/gi) || []).length;
  return {
    ok: true,
    error: null,
    bytes,
    root,
    stats,
    colors: collectColors(src),
    strokeWidths: collectStrokeWidths(src),
    viewBox: root.viewbox || null,
    hasSize: root.width !== undefined || root.height !== undefined,
  };
}

// ---- 审计 ----
//
// 每条 issue 都带 code（机器分支用）、level（error 阻断 / warn 提示）、
// message（人读）与 hint（怎么改）。看板与 CLI 都只渲染这三样，不各自拼文案。
export function auditSvg(code, { spec = ICON_SPEC, profile = 'auto' } = {}) {
  const meta = parseSvg(code);
  profile = resolveProfile(profile, code);
  const issues = [];
  const add = (level, code, message, hint) => issues.push({ level, code, message, hint });
  // 线宽按「属性值 × 内容缩放」判定：32pt 网格迁到 24pt 时内容包在 scale(0.75) 里，
  // 里面写 2.4 渲染出来才是规范的 1.8。
  const wrapK = wrapScaleOf(code);
  const effSw = (v) => round4(Number(v) * wrapK);
  const isSwOk = (v) => Math.abs(effSw(v) - spec.strokeWidth) < 1e-3;

  if (!meta.ok) {
    add('error', 'no-root', meta.error, '确保源码里有一个 <svg …> 根元素');
    return { ok: false, issues, meta };
  }

  // 几何容器：图标要求「24pt 网格」；color 档（插画 / 动画）只要求**有** viewBox
  // ——800×600 是画面尺寸，不是「没对齐的图标网格」，拿 24 去比就是莫名其妙的提醒。
  const vbRequired = profile !== 'color';
  if (vbRequired) {
    if (meta.viewBox !== spec.viewBox) {
      add(
        'warn',
        'viewbox',
        meta.viewBox ? `viewBox 是 "${meta.viewBox}"，规范为 "${spec.viewBox}"` : '缺少 viewBox',
        `svg spec fix 可批量补齐为 viewBox="${spec.viewBox}"`
      );
    }
  } else if (!meta.viewBox) {
    add(
      'warn',
      'viewbox',
      '缺少 viewBox，图形无法按容器缩放',
      `补一个 viewBox="0 0 <内容宽> <内容高>"`
    );
  }

  if (meta.hasSize) {
    add(
      'warn',
      'fixed-size',
      '根元素写死了 width/height，外部无法按容器缩放',
      '交给 CSS 控制尺寸（归一化会移除这两个属性）'
    );
  }

  if (profile === 'duotone') {
    // 双色档：点缀色是有意保留的，不再报 hardcoded-color；
    // 但**必须有一处 currentColor**——那是「主题色」，没有它这枚图标不会跟主题走。
    const hasThemeColor = propHasCurrentColor(code);
    if (!hasThemeColor) {
      add(
        'warn',
        'no-theme-color',
        '双色图标里没有 currentColor，主题色无处可跟',
        `把作为主题色的那一色改成 ${spec.color}（svg spec fix --profile duotone --accent "#xxxxxx"）`
      );
    }
  } else if (profile === 'line' && meta.colors.length) {
    // 只有 line 档把「写死颜色」当问题：color 档（插画 / 品牌标 / 带动画的图形）
    // 配色就是内容，报它等于让用户反复点一个修不掉的「待规范」。
    add(
      'warn',
      'hardcoded-color',
      `出现写死的颜色 ${meta.colors.slice(0, 4).join(' / ')}${meta.colors.length > 4 ? ' 等' : ''}`,
      `改成 ${spec.color}，颜色由外层 CSS 驱动（--code-css 'svg{color:#…}'）`
    );
  }

  if (!meta.stats.elements) {
    add('error', 'empty', '没有任何图元（只有空壳 <svg>）', '确认源码内容是完整的图形');
  }

  if (profile === 'line') {
    // 根元素上的 fill/stroke/线宽同样跳过 var() 引用：
    // 「报得出来修不掉」比不报更糟——用户会反复点修复，每次都被告知「已合规」。
    const fill = String(meta.root.fill || '').toLowerCase();
    if (fill !== 'none' && !isVarRef(meta.root.fill)) {
      add('warn', 'fill', `线性图标根元素应有 fill="none"（当前 ${meta.root.fill ?? '未设置'}）`, '归一化会补上');
    }
    const stroke = String(meta.root.stroke || '').toLowerCase();
    if (stroke !== spec.color.toLowerCase() && !isVarRef(meta.root.stroke)) {
      add('warn', 'stroke', `根元素 stroke 应为 ${spec.color}（当前 ${meta.root.stroke ?? '未设置'}）`, '归一化会补上');
    }
    const sw = meta.root['stroke-width'];
    if (sw !== undefined && !isVarRef(sw) && !isSwOk(sw)) {
      add('warn', 'stroke-width', `stroke-width 是 ${sw}，规范为 ${spec.strokeWidth}`, '统一线宽是全组「看起来齐」的关键');
    }
  }

  // 线宽检查是全文档的，不属于任何档位：只要哪个图元比规范粗/细，
  // 放回一组图标里就会显出来——哪怕根元素写得完全合规。
  // 但**只对线性档有意义**：color 档（插画 / 动画）的线宽是画面的一部分，不是「齐不齐」的问题。
  const offSpec = profile === 'color' ? [] : (meta.strokeWidths || []).filter((v) => !isSwOk(v));
  if (offSpec.length) {
    add(
      'warn',
      'stroke-width',
      wrapK === 1
        ? `有图元线宽为 ${offSpec.join(' / ')}，规范为 ${spec.strokeWidth}`
        : `有图元线宽为 ${offSpec.join(' / ')}（内容 ×${wrapK} 后渲染为 ${round4(Number(offSpec[0]) * wrapK)}），规范为 ${spec.strokeWidth}`,
      'svg spec fix 会把全文档的 stroke-width 统一为规范值'
    );
  }

  return { ok: !issues.some((i) => i.level === 'error'), issues, meta };
}

// ---- 归一化 ----

function setAttr(tag, name, value) {
  const re = new RegExp('\\s' + name + '\\s*=\\s*("[^"]*"|\'[^\']*\')', 'i');
  if (re.test(tag)) return tag.replace(re, ` ${name}="${value}"`);
  return tag.replace(/\s*\/?>$/, (end) => ` ${name}="${value}"${end}`);
}

function delAttr(tag, name) {
  return tag.replace(new RegExp('\\s' + name + '\\s*=\\s*("[^"]*"|\'[^\']*\')', 'gi'), '');
}

// 文档里是否有任何一处用了 currentColor（双色档的「主题色」判据）。
function propHasCurrentColor(src) {
  let hit = false;
  String(src).replace(propRe(COLOR_PROP), (whole, raw) => {
    if (unquote(raw).toLowerCase() === 'currentcolor') hit = true;
    return whole;
  });
  return hit;
}

// 自动识别一枚资源属于哪个档位——面板/看板不能要求用户每次手动指定：
//   duotone  有 currentColor（主题色）**且**还留着点缀色 → 双色图标，点缀色是有意的
//   color    只有写死的色值 / 带 SMIL 或脚本驱动的动画 → 纯配色图形或动效，配色是内容
//   line     颜色全走 currentColor（或压根没写颜色）→ 单色线性图标
//
// 动画类必须归到 color：图标那套「线宽 1.8 / 一律 currentColor」会把动画改坏
// （关键帧与线宽都是动画的一部分），而归到 line 会让看板永远显示「待规范」。
const MOTION_RE = /<\s*(animate|animateTransform|animateMotion|set|script)\b/i;

export function detectProfile(src) {
  const text = String(src ?? '');
  if (MOTION_RE.test(text)) return 'color';
  const colors = collectColors(text);
  const hasTheme = propHasCurrentColor(text);
  if (colors.length && hasTheme) return 'duotone';
  if (colors.length) return 'color';
  return 'line';
}

// 把写死的颜色统一换成 currentColor。只动 fill / stroke / color 三处，
// 且跳过 none / currentColor / url(#grad) / var(...) —— 误改这几类会直接改变图形语义。
// 属性名与取值的模式与 collectColors 共用（见文件上方「定义只此一处」）。
//
// only：只替换等于这个值的颜色（双色档用——主题色换成 currentColor，点缀色原样保留）。
function unifyColors(src, target, { only } = {}) {
  let hits = 0;
  const want = only ? String(only).trim().toLowerCase() : null;
  const out = src.replace(propRe(COLOR_PROP), (whole, raw) => {
    const quote = /^["']/.test(raw) ? raw[0] : '';
    const v = unquote(raw);
    if (isInherentValue(v)) return whole;
    if (want && v.toLowerCase() !== want) return whole; // 非主题色：保留
    hits++;
    return whole.replace(raw, `${quote}${target}${quote}`);
  });
  return { src: out, hits };
}

// 把全文档的 stroke-width 统一为规范值（含子图元与内联 style）。
// 跳过 var(…) —— 那是刻意的主题变量引用，改写会破坏设计意图（collect 侧同样跳过）。
function unifyStrokeWidth(src, target) {
  let hits = 0;
  const out = src.replace(propRe(STROKE_WIDTH_PROP), (whole, raw) => {
    const quote = /^["']/.test(raw) ? raw[0] : '';
    const v = unquote(raw);
    if (!v || v === String(target) || v.startsWith('var(')) return whole;
    hits++;
    return whole.replace(raw, `${quote}${target}${quote}`);
  });
  return { src: out, hits };
}

// viewBox 字符串 → 数值矩形。约定与 SVG 一致：允许空格或逗号分隔。
export function parseViewBox(str) {
  const parts = String(str ?? '')
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [x, y, w, h] = parts;
  if (w <= 0 || h <= 0) return null;
  return { x, y, w, h };
}

// 把根元素内的全部内容包进一个 <g transform>。
// 这是「换 viewBox 而不改画」的正确做法：坐标系改了，所以必须对内容做等效变换，
// 否则原来画在 32 网格上的图形塞进 24 网格就会整体放大 33% 甚至溢出。
function wrapContent(svg, transform) {
  const open = svg.match(/<svg\b[^>]*>/i);
  const closeIdx = svg.lastIndexOf('</svg>');
  if (!open || closeIdx < 0) return svg;
  const cut = open.index + open[0].length;
  return `${svg.slice(0, cut)}<g transform="${transform}">${svg.slice(cut, closeIdx)}</g>${svg.slice(closeIdx)}`;
}

// 推出「内容当前所在的坐标系」：优先 viewBox；没有 viewBox 时退回 width/height
// （尺寸写死但没 viewBox 的图标很常见，此时 width/height 就是它的网格大小）。
function sourceRect(meta) {
  const fromVb = parseViewBox(meta.viewBox);
  if (fromVb) return fromVb;
  const w = Number(meta.root.width);
  const h = Number(meta.root.height);
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return { x: 0, y: 0, w, h };
  return null;
}

function transformBetween(from, to) {
  const sx = to.w / from.w;
  const sy = to.h / from.h;
  // 长宽比不一致时无法用均匀缩放映射过去——宁可不动，也不要把图形压扁。
  if (Math.abs(sx - sy) > 1e-3) return null;
  const tx = to.x - from.x * sx;
  const ty = to.y - from.y * sy;
  const same = Math.abs(sx - 1) < 1e-9 && Math.abs(tx) < 1e-9 && Math.abs(ty) < 1e-9;
  if (same) return { scale: sx, transform: null };
  const round = (n) => Number(n.toFixed(4));
  const parts = [];
  if (round(tx) !== 0 || round(ty) !== 0) parts.push(`translate(${round(tx)} ${round(ty)})`);
  if (round(sx) !== 1) parts.push(`scale(${round(sx)})`);
  return { scale: sx, transform: parts.join(' ') || null };
}

// 归一化会把内容包进 `<g transform="scale(k)">`（32pt 网格 → 24pt 时 k=0.75）。
// 这个缩放同时作用在**线宽**上：里面写 2.4、渲染出来才是 1.8。
// 所以「线宽是否合规」必须按「属性值 × 缩放」判定，否则会出现
// 审计说合规、归一化却把它改细（真实踩过：29 枚图标渲染线宽只有 1.35）。
export function wrapScaleOf(src) {
  const m = String(src).match(/<svg\b[^>]*>\s*<g[^>]*transform\s*=\s*"[^"]*scale\(\s*([\d.]+)\s*\)/i);
  const k = m ? Number(m[1]) : 1;
  return Number.isFinite(k) && k > 0 ? k : 1;
}

const round4 = (n) => Number(Number(n).toFixed(4));

export function normalizeSvg(code, { spec = ICON_SPEC, profile = 'auto', accent } = {}) {
  const src = String(code ?? '');
  const before = parseSvg(src);
  if (!before.ok) {
    return { ok: false, error: before.error, code: src, changed: [] };
  }
  const explicitProfile = String(profile ?? 'auto');
  profile = resolveProfile(explicitProfile, src);
  // 双色档要指定主题色才改得动；auto 判出双色却没给 accent 时**不改颜色**——
  // 工具无从判断该换哪一色，猜就是破坏（明确传 --profile duotone 才是调用方要它改）。
  const duotoneNeedsAccent = profile === 'duotone' && !accent;
  if (duotoneNeedsAccent && explicitProfile === 'duotone') {
    return {
      ok: false,
      error: '双色档需要 --accent 指定哪个色值是主题色（例：--accent "#5B7CFA"）',
      code: src,
      changed: [],
    };
  }
  const changed = [];
  let out = src;

  // 0) 坐标系先算：缩放同时作用在线宽上，所以线宽目标要除以总缩放。
  //    总缩放 = 已有的 scale 包裹（重复归一化）× 本次映射（换 viewBox）。
  //    color 档（插画 / 动画）**不迁 viewBox**：800×600 是画面尺寸，不是待对齐的图标网格。
  const target = parseViewBox(spec.viewBox);
  const from = sourceRect(before);
  let mapping = null;
  const vbDiffers = profile !== 'color' && before.viewBox !== spec.viewBox;
  if (target && from && vbDiffers) mapping = transformBetween(from, target);
  const k = round4(wrapScaleOf(out) * (mapping ? mapping.scale : 1));
  const swTarget = round4(spec.strokeWidth / k);

  // 1) 颜色
  if (profile === 'duotone') {
    if (accent) {
      const c = unifyColors(out, spec.color, { only: accent });
      if (c.hits) {
        out = c.src;
        changed.push(`主题色 ${accent} → ${spec.color}（${c.hits} 处，其余配色保留）`);
      }
    }
    // 没给 accent：不动颜色（不知道哪一色是主题色，猜就是破坏）
  } else if (profile === 'line') {
    const c = unifyColors(out, spec.color);
    if (c.hits) {
      out = c.src;
      changed.push(`颜色 → ${spec.color}（${c.hits} 处）`);
    }
  }
  // color 档：颜色一律保留（插画 / 品牌标 / 带动画的图形，配色就是内容）

  // 2) 线宽（全文档，含子图元）：line / duotone 都统一，目标值按缩放折算
  if (profile === 'line' || profile === 'duotone') {
    const sw = unifyStrokeWidth(out, swTarget);
    if (sw.hits) {
      out = sw.src;
      changed.push(
        k === 1
          ? `stroke-width → ${swTarget}（${sw.hits} 处）`
          : `stroke-width → ${swTarget}（${sw.hits} 处，内容 ×${k} 折算后渲染为 ${spec.strokeWidth}）`
      );
    }
  }

  // 3) viewBox 变更记录
  if (mapping) {
    const label = before.viewBox
      ? `viewBox ${before.viewBox} → ${spec.viewBox}`
      : `补 viewBox ${spec.viewBox}`;
    changed.push(
      mapping.scale === 1
        ? `${label}（尺寸一致，无需缩放）`
        : `${label}（内容整体 ×${Number(mapping.scale.toFixed(4))}）`
    );
  } else if (vbDiffers) {
    changed.push(`viewBox 保持 ${before.viewBox}（长宽比与规范不一致，强行替换会把图形压扁）`);
  }
  // 4) 根元素属性
  out = out.replace(/<svg\b[^>]*>/i, (tag) => {
    let t = tag;
    const cur = readAttrs(t);
    const nextVb = mapping ? spec.viewBox : cur.viewbox || spec.viewBox;
    if (cur.viewbox !== nextVb) t = setAttr(t, 'viewBox', nextVb);
    if (cur.width !== undefined || cur.height !== undefined) {
      t = delAttr(delAttr(t, 'width'), 'height');
      changed.push('移除写死的 width/height');
    }
    if (profile === 'line') {
      // 与 auditSvg 的根元素检查保持同一判据（跳过 var() 引用），否则会出现
      // 「审计说合规、但归一化还是把它改掉了」的反向不对称。
      if (String(cur.fill || '').toLowerCase() !== 'none' && !isVarRef(cur.fill)) {
        t = setAttr(t, 'fill', 'none');
        changed.push('fill="none"');
      }
      if (String(cur.stroke || '') !== spec.color && !isVarRef(cur.stroke)) {
        t = setAttr(t, 'stroke', spec.color);
        changed.push(`stroke="${spec.color}"`);
      }
      if (cur['stroke-width'] === undefined) {
        t = setAttr(t, 'stroke-width', String(swTarget));
        changed.push(`stroke-width="${swTarget}"`);
      }
      if (cur['stroke-linecap'] === undefined) t = setAttr(t, 'stroke-linecap', spec.strokeLinecap);
      if (cur['stroke-linejoin'] === undefined) t = setAttr(t, 'stroke-linejoin', spec.strokeLinejoin);
      if (cur['stroke-linecap'] === undefined || cur['stroke-linejoin'] === undefined) {
        changed.push('补齐 linecap/linejoin');
      }
    } else if (profile === 'duotone') {
      // 双色档**不强制根元素的 fill/stroke**：这类图标常是填充式的，
      // 给根挂上 stroke 会让每个没写 stroke 的图元都多出一圈描边。
      // 只把已存在的 stroke-width 折算到目标值（有描边的图元才受影响）。
      if (cur['stroke-width'] !== undefined && String(cur['stroke-width']) !== String(swTarget)) {
        t = setAttr(t, 'stroke-width', String(swTarget));
        changed.push(`根元素 stroke-width → ${swTarget}`);
      }
    }
    return t;
  });

  // 5) 内容变换：只在「坐标系确实变了」时包一层 <g>
  if (mapping && mapping.transform) out = wrapContent(out, mapping.transform);

  return { ok: true, error: null, code: out, changed };
}

// 给 agent 用的合规起点：24 网格上的空图标骨架。
// 与其让模型从零编一个 SVG（很容易写出非整数坐标、写死颜色），
// 不如让它拿这份骨架往里填路径。
export const ICON_SKELETON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ICON_SPEC.viewBox}" fill="none" stroke="${ICON_SPEC.color}" stroke-width="${ICON_SPEC.strokeWidth}" stroke-linecap="${ICON_SPEC.strokeLinecap}" stroke-linejoin="${ICON_SPEC.strokeLinejoin}">
  <path d="M0 0" />
</svg>`;
