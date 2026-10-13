// 预览文档组装：把「三个编辑框的内容」拼成 iframe 可渲染的一页。
// 纯函数，与 UI 无关——html / svg 两种 kind 只有拼法不同。
import { useEffect } from 'react';

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

// svg：把用户写的 <svg> 放进居中壳里，css/js 照常注入。
export function buildSvgDoc(code) {
  const { extra, scriptText } = skin(code.css, code.js);
  const svg = String(code.svg || '');
  const style = [
    'html,body{margin:0;min-height:100vh}',
    'body{display:grid;place-items:center;background:#fff}',
    'svg{max-width:70vw;max-height:70vh;height:auto}',
    extra,
  ]
    .filter(Boolean)
    .join('\n');
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    `<style>\n${style}\n</style>`,
    '</head><body>',
    `<div id="app">${svg}</div>`,
    scriptText ? `<script>\n${scriptText}\n</script>` : '',
    '</body></html>',
  ].join('\n');
}

export function buildPreviewDoc(kind, code) {
  return kind === 'svg' ? buildSvgDoc(code) : buildHtmlDoc(code);
}

// 预览面板：srcDoc 一有变化就重挂载 iframe。
//
// key 必须由「内容本身」派生——只用长度会让「换风格但长度恰好相同」时
// 不重挂载，iframe 会继续渲染上一份代码（真实踩过：minimal 与 dark 的
// CSS 长度相同，切换后预览不更新）。
function docHash(doc) {
  const s = String(doc || '');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return s.length + '.' + (h >>> 0).toString(36);
}

export function PreviewPane({ doc, full, tick = 0, onToggleFull }) {
  useEffect(() => {
    if (!full) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onToggleFull();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [full, onToggleFull]);

  const frame = (
    <iframe
      key={docHash(doc) + ':' + tick}
      className="asset-frame"
      title="预览"
      // 不设 sandbox：预览内容是用户自己写的本机资源，脚本就该正常跑
      // （sandbox 无 allow-same-origin 时 alert 会被静默拦截，也读不到内容做断言）
      srcDoc={doc}
      onLoad={(e) => {
        // 预览里的链接点击不该把 iframe 导航走（会丢预览），直接拦住
        const d = e.target.contentDocument;
        if (d)
          d.addEventListener('click', (ev) => {
            const a = ev.target.closest && ev.target.closest('a');
            if (a) ev.preventDefault();
          });
      }}
    />
  );
  if (!full) {
    return (
      <div className="asset-preview">
        <div className="asset-preview-head">
          <span className="muted">实时预览</span>
          <button className="btn small ghost" onClick={onToggleFull}>全屏展开</button>
        </div>
        <div className="asset-frame-wrap">{frame}</div>
      </div>
    );
  }
  return (
    <div className="asset-full">
      <div className="asset-full-head">
        <span>预览（全屏）</span>
        <button className="btn small ghost" onClick={onToggleFull}>退出全屏 (Esc)</button>
      </div>
      <div className="asset-frame-wrap">{frame}</div>
    </div>
  );
}
