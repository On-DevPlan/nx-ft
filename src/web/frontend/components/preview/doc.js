// 预览文档组装：把编辑框里的代码拼成 iframe 能渲染的一页。纯函数，与 UI 无关——
// html / svg / color 三种 kind 只有拼法不同。
//
// 这里是**唯一**一份拼法。早先 svg 的拼法在 asset/preview.jsx 与 svg/detail.jsx
// 各写了一份，内边距一个 16px、一个 6%，已经漂移到「同一枚图标在两个页面里大小不同」。
import { varOverrideCss } from '../svg/color-vars.js';

function skin(css, js) {
  const s = String(css || '').trim();
  const j = String(js || '').trim();
  return {
    style: s ? `<style>\n${css}\n</style>` : '',
    script: j ? `<script>\n${js}\n</script>` : '',
    extra: s ? css : '',
    scriptText: j ? js : '',
  };
}

// html：用户给什么渲染什么；没有 <html> 时补一个壳。
export function buildHtmlDoc(code) {
  const { style, script } = skin(code.css, code.js);
  const raw = String(code.html || '');
  const inject = /<html[\s>]/i.test(raw);
  if (!inject) {
    return [
      '<!doctype html><html><head><meta charset="utf-8">',
      '<style>html,body{margin:0;min-height:100vh}body{display:grid;place-items:center}</style>',
      style,
      '</head><body>',
      raw,
      script,
      '</body></html>',
    ].join('\n');
  }
  // 用户写了完整文档：只补缺失的部分
  let doc = raw;
  if (style && !doc.includes('</head>')) doc = doc.replace(/<html([^>]*)>/i, `<html$1><head>${style}</head>`);
  else if (style) doc = doc.replace('</head>', style + '\n</head>');
  if (script && !doc.includes('</body>')) doc = doc + script;
  else if (script) doc = doc.replace('</body>', script + '\n</body>');
  return doc;
}

// svg：把用户写的 <svg> 放进一个「撑满预览帧」的壳里，css/js 照常注入。
//
// 图形要**随预览区一起变大变小**。早先写的是 max-width/max-height:70vw/70vh + height:auto
// ——那让图形只占帧的 70%，而且完全不吃预览区的高度（把预览拉大它也不动，用户原话
// 「预览的高度不变」）。现在让 svg 填满 #app 的内容盒，靠默认的
// preserveAspectRatio="xMidYMid meet" 保持长宽比：图标与 800×600 的动画都能放大到
// 看得清，且永不变形。用户自己的 css 排在最后，同特异度下覆盖上面这几条。
const SVG_PAD = 16;

// 颜色属性取值（属性名用否定环视，避免 background-color / flood-color 被误算）。
// 与 core/svg/spec.js 的 COLOR_PROP 同口径——前端预览不能引 Node 模块，这里复刻一份。
const SVG_COLOR_RE = /(?<![-\w])(?:fill|stroke|color)\s*[:=]\s*("[^"]*"|'[^']*'|[^"';\s>}]+)/gi;

// 局部颜色替换：只在预览文档里把「原颜色字面量」换成新色，不改用户源码。
// slots = { 原颜色（去引号、trim）: 新 hex }。
function applySvgSlots(svg, slots) {
  if (!slots || !Object.keys(slots).length) return svg;
  return svg.replace(SVG_COLOR_RE, (whole, raw) => {
    const quote = /^["']/.test(raw) ? raw[0] : '';
    const val = quote ? raw.slice(1, -1).trim() : raw.trim();
    const next = slots[val];
    if (!next) return whole;
    return whole.replace(raw, `${quote}${next}${quote}`);
  });
}

// theme（仅预览层）：
//   main  → 注入 #app 的 color，驱动 currentColor（图标主题色实时响应）
//   slots → 替换硬编码颜色字面量（遗留资源的局部颜色控制）
//   vars  → CSS 变量覆盖（--c-N），追加到文档尾的同名声明覆盖源码主题层
//     （同选择器后来居上）——模板化资源（plan/18）的调色不碰源码字符串
export function buildSvgDoc(code, theme) {
  const { extra, scriptText } = skin(code.css, code.js);
  const themedSvg = applySvgSlots(String(code.svg || ''), theme?.slots);
  const override = varOverrideCss(theme?.vars);
  const appColor = theme?.main ? `;color:${theme.main}` : '';
  const style = [
    'html,body{margin:0;height:100%}',
    'body{background:#fff}',
    `#app{width:100%;height:100%;box-sizing:border-box;padding:${SVG_PAD}px;display:grid;place-items:center${appColor}}`,
    // 只管直接子节点：资源内部若还有嵌套 <svg>（use/symbol 场景），它的几何由自己说了算
    '#app>svg{width:100%;height:100%;display:block}',
    extra,
  ]
    .filter(Boolean)
    .join('\n');
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    `<style>\n${style}\n</style>`,
    '</head><body>',
    `<div id="app">${themedSvg}</div>`,
    override ? `<style>${override}</style>` : '',
    scriptText ? `<script>\n${scriptText}\n</script>` : '',
    '</body></html>',
  ].join('\n');
}

// color：把 data JSON 解析后渲染成一整面「撞色色块墙」——大色块铺满整个预览、
// gap 0 让颜色直接碰撞，文字叠在色块上（按明度自动黑/白）。完整编辑体验在 ColorStudio 全屏页。
//
// 按色块感知明度返回文字色：浅色块用墨色、深色块用白字，保证叠在强色块上仍可读。
const inkOnColor = (hex) => {
  const h = String(hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? '#14161a' : '#ffffff';
};

export function buildColorDoc(code) {
  let data = {};
  try {
    data = JSON.parse(String(code?.data || '{}'));
  } catch {
    data = { _error: 'DATA 槽位的 JSON 无法解析' };
  }
  const palettes = Array.isArray(data.palettes) ? data.palettes : [data];

  // 一个色块：顶部 note（hero 块顶部放调色板名）、底部 hex。
  // hero=主色占满整行；最后一个落单（n 为偶数）也占满整行。
  const blocksOf = (p) => {
    const colors = p.colors || [];
    return colors
      .map((entry, i) => {
        const hex = (entry?.hex || '').toString().toUpperCase();
        const ink = inkOnColor(hex);
        let cls = 'blk';
        if (i === 0) cls += ' hero';
        else if (i === colors.length - 1 && colors.length % 2 === 0) cls += ' wide';
        const top =
          i === 0
            ? `<div class="pname">${p.name || '未命名调色板'}</div>`
            : entry?.note
              ? `<div class="note">${entry.note}</div>`
              : '<div></div>';
        return `<div class="${cls}" style="background:${hex || '#ebedf0'};color:${ink}">${top}<div class="code">${hex || '—'}</div></div>`;
      })
      .join('');
  };

  const palettesHtml = palettes
    .map((p) => {
      const colors = p.colors || [];
      if (!colors.length) {
        const msg = data._error || '这个调色板还没有颜色';
        return `<section class="wall"><div class="blk hero" style="background:#ebedf0;color:#14161a"><div class="pname">${p.name || '未命名调色板'}</div><div class="code">${msg}</div></div></section>`;
      }
      return `<section class="wall">${blocksOf(p)}</section>`;
    })
    .join('');

  const style = `
    html,body{margin:0;min-height:100%;font-family:system-ui}
    .wall{display:grid;grid-template-columns:1fr 1fr;gap:0;min-height:100vh}
    .blk{display:flex;flex-direction:column;justify-content:space-between;min-height:124px;padding:14px}
    .blk.hero{grid-column:1/-1;min-height:158px}
    .blk.wide{grid-column:1/-1}
    .pname{font-size:17px;font-weight:700;letter-spacing:.01em}
    .code{font-family:ui-monospace,monospace;font-size:13px;font-weight:600;letter-spacing:.05em}
    .note{font-size:11px;opacity:.85}
  `;
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    `<style>${style}</style>`,
    '</head><body>',
    palettesHtml,
    '</body></html>',
  ].join('\n');
}

export function buildPreviewDoc(kind, code) {
  if (kind === 'svg') return buildSvgDoc(code);
  if (kind === 'color') return buildColorDoc(code);
  return buildHtmlDoc(code);
}
