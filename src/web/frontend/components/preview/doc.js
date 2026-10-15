// 预览文档组装：把编辑框里的代码拼成 iframe 能渲染的一页。纯函数，与 UI 无关——
// html / svg / color 三种 kind 只有拼法不同。
//
// 这里是**唯一**一份拼法。早先 svg 的拼法在 asset/preview.jsx 与 svg/detail.jsx
// 各写了一份，内边距一个 16px、一个 6%，已经漂移到「同一枚图标在两个页面里大小不同」。

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

export function buildSvgDoc(code) {
  const { extra, scriptText } = skin(code.css, code.js);
  const style = [
    'html,body{margin:0;height:100%}',
    'body{background:#fff}',
    `#app{width:100%;height:100%;box-sizing:border-box;padding:${SVG_PAD}px;display:grid;place-items:center}`,
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
    `<div id="app">${String(code.svg || '')}</div>`,
    scriptText ? `<script>\n${scriptText}\n</script>` : '',
    '</body></html>',
  ].join('\n');
}

// color：把 data JSON 解析后渲染成色板墙。每个 Palette 是一行 swatch 列表。
// 这是「色板资源的裸预览」——完整的编辑体验在 ColorStudio 全屏页里。
export function buildColorDoc(code) {
  let data = {};
  try {
    data = JSON.parse(String(code?.data || '{}'));
  } catch {
    data = { _error: 'DATA 槽位的 JSON 无法解析' };
  }
  const palettes = Array.isArray(data.palettes) ? data.palettes : [data];
  const swatches = (entry) => {
    const hex = (entry?.hex || '').toString().toUpperCase();
    return `<div class="sw"><div class="chip" style="background:${hex}"></div><div class="meta"><b>${hex || '—'}</b><span>${entry?.note || ''}</span></div></div>`;
  };
  const palettesHtml = palettes
    .map(
      (p) => `
      <section class="palette">
        <h2>${p.name || '未命名调色板'}</h2>
        <div class="grid">${(p.colors || []).map(swatches).join('')}</div>
      </section>`,
    )
    .join('');
  const style = `
    html,body{margin:0;font:13px/1.4 system-ui;background:#f5f6f7;color:#14161a}
    .palette{padding:16px}
    .palette h2{margin:0 0 12px;font-size:14px}
    .grid{display:flex;flex-wrap:wrap;gap:8px}
    .sw{width:120px;background:#fff;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden}
    .chip{height:56px}
    .meta{padding:6px 8px;font-size:11px;display:flex;flex-direction:column;gap:2px}
    .meta b{font-family:ui-monospace,monospace;color:#14161a}
    .meta span{color:#6b7280}
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
