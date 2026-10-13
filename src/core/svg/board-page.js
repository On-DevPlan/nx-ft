// 导出的独立看板页：把一批 SVG 渲染成一张可以双击打开、也可以直接分享的 HTML。
//
// 为什么要有这个：`svg export` 光导出一堆 .svg 文件，人接手时还是得一个个点开看。
// 附一张自包含的看板页（图标全部内联，无外部依赖、无网络请求），
// 拿到目录的人双击就能纵览整组图标，这是「批量图标集」交付物的一半。
//
// 安全边界：内联的是**用户自己本机的 SVG 源码**，与面板预览同一信任级别（本地资源就该正常渲染）。
// 只有标签文本走 HTML 转义——那是文件名/展示名，可能含尖括号。
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function card(a) {
  const issues = a.issues || [];
  const badge = issues.length
    ? `<span class="badge warn" title="${esc(issues.map((i) => i.message).join('；'))}">${issues.length}</span>`
    : `<span class="badge ok">规范</span>`;
  return `      <figure class="cell">
        <div class="box">${a.svg}</div>
        <figcaption>
          <b>${esc(a.label)}</b>
          <span class="fname">${esc(a.file)}</span>
          <span class="tags">${badge}${(a.tags || []).map((t) => `<i>#${esc(t)}</i>`).join('')}</span>
        </figcaption>
      </figure>`;
}

export function renderBoardHtml({ title, subtitle, groups, spec }) {
  const total = groups.reduce((n, g) => n + g.assets.length, 0);
  const flagged = groups.reduce(
    (n, g) => n + g.assets.filter((a) => (a.issues || []).length).length,
    0
  );
  const sections = groups
    .map(
      (g) => `  <section>
    <h2>${esc(g.label)} <em>${g.assets.length}</em><code>${esc(g.path)}</code></h2>
    <div class="grid">
${g.assets.map(card).join('\n')}
    </div>
  </section>`
    )
    .join('\n');

  const specLine = spec
    ? `viewBox ${spec.viewBox} · 线宽 ${spec.strokeWidth} · ${spec.color}`
    : '';

  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { --ink:#14161a; --paper:#fff; --soft:#f5f6f7; --soft-2:#ebedf0; --mid:#8b9096; --bad:#b3261e; --ok:#2f7d4f; }
  * { box-sizing:border-box; }
  body { margin:0; padding:40px 44px 60px; background:var(--soft); color:var(--ink);
         font-family:system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif; font-size:14px; }
  header { margin-bottom:34px; }
  h1 { font-size:26px; margin:0 0 6px; font-weight:700; letter-spacing:.3px; }
  header p { margin:0; color:var(--mid); font-size:12px; font-family:ui-monospace,Consolas,monospace; }
  header .stat { margin-top:10px; display:flex; gap:8px; flex-wrap:wrap; }
  header .stat span { font-size:11px; padding:3px 9px; border-radius:999px; background:var(--soft-2); color:var(--mid); }
  header .stat span.bad { background:#fdecea; color:var(--bad); }
  section { margin-bottom:38px; }
  h2 { font-size:14px; font-weight:600; margin:0 0 14px; display:flex; align-items:center; gap:10px; }
  h2::after { content:""; flex:1; height:1px; background:var(--soft-2); }
  h2 em { font-style:normal; font-size:11px; color:var(--mid); background:var(--soft-2); padding:2px 7px; border-radius:999px; }
  h2 code { font-size:11px; color:var(--mid); font-weight:400; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(118px,1fr)); gap:14px; }
  .cell { margin:0; background:var(--paper); border:1px solid var(--soft-2); border-radius:12px;
          padding:16px 10px 12px; display:flex; flex-direction:column; align-items:center; gap:10px;
          transition:border-color .15s, box-shadow .15s, transform .15s; }
  .cell:hover { border-color:#c9ced6; box-shadow:0 6px 18px rgba(20,22,26,.07); transform:translateY(-2px); }
  .box { width:32px; height:32px; display:grid; place-items:center; color:#14161a; }
  .box svg { width:32px; height:32px; display:block; }
  figcaption { text-align:center; line-height:1.5; width:100%; min-width:0; }
  figcaption b { display:block; font-size:12px; font-weight:600;
                 overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .fname { display:block; font-size:10px; color:var(--mid); font-family:ui-monospace,Consolas,monospace;
           overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .tags { display:flex; gap:4px; justify-content:center; flex-wrap:wrap; margin-top:4px; }
  .tags i { font-style:normal; font-size:9px; color:var(--mid); }
  .badge { font-size:9px; padding:1px 6px; border-radius:999px; background:var(--soft-2); color:var(--mid); }
  .badge.ok { background:#eaf5ee; color:var(--ok); }
  .badge.warn { background:#fdf2e9; color:#a35b12; cursor:help; }
  footer { color:var(--mid); font-size:11px; border-top:1px solid var(--soft-2); padding-top:14px;
           font-family:ui-monospace,Consolas,monospace; }
</style></head>
<body>
<header>
  <h1>${esc(title)}</h1>
  <p>${esc(subtitle || '')}</p>
  <div class="stat">
    <span>${groups.length} 组</span>
    <span>${total} 枚</span>
    ${flagged ? `<span class="bad">${flagged} 枚待规范</span>` : '<span>全部符合规范</span>'}
    ${specLine ? `<span>${esc(specLine)}</span>` : ''}
  </div>
</header>
${sections}
<footer>由 nx-ft svg export 生成 · 图标为内联 SVG，可直接复制 .box 内的 &lt;svg&gt;</footer>
</body></html>
`;
}
