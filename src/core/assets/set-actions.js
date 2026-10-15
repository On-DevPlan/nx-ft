// html 资源的批量导入 / 导出命令声明（CLI + HTTP 双声明，一源两派生）。
//
// 与 core/svg/actions.js 里的 svg.import / svg.export 是并列的两条专属能力：
// 命令名相同、语义按各自的约定走（svg 平铺 .svg 文件；html 一资源一目录三件套）。
// 「面板有按钮必有命令」是硬规矩——面板上的「导入 zip / 导出 zip」按钮背后
// 就是这两条 action，所以它们必须存在。
//
// 为什么单独一个文件而不是塞进 makeActions：那个文件是 html/svg 的**共用**
// CRUD，两边必须逐条同构（tests/unit/registry.test.mjs 钉着）；导入导出是
// 各域自己的约定，放进共用层就会把「同构」破坏掉。
import * as set from './set.js';

const MAIN = 'index.html';

function renderImport(r) {
  if (r.dryRun) {
    return [
      `将要导入 ${r.total} 个（--dry-run，未写入） → ${r.group}`,
      ...r.plan.map((p) => `  ${p.name.padEnd(20)} ${p.file}   [${p.slots.join(',')}]`),
    ].join('\n');
  }
  const lines = [`已导入 ${r.imported.length} 个到 ${r.group}（风格 ${r.style}）` + (r.groupCreated ? ' · 分组为本次新建' : '')];
  for (const i of r.imported.slice(0, 20)) lines.push(`  + ${i.name.padEnd(20)} [${i.slots.join(',')}]  ${i.bytes} B`);
  if (r.imported.length > 20) lines.push(`  …… 还有 ${r.imported.length - 20} 个`);
  if (r.skipped.length) {
    lines.push('', `跳过 ${r.skipped.length} 个：`);
    for (const s of r.skipped) lines.push(`  = ${s.name} —— ${s.reason}`);
  }
  return lines.join('\n');
}

function renderExport(r) {
  const lines = [`已导出 ${r.exported.length} 个 → ${r.to}` + (r.style ? `（统一风格 ${r.style}）` : '（各取当前风格）')];
  for (const e of r.exported.slice(0, 20)) lines.push(`  → ${e.group}/${e.name}/  [${e.slots.join(',')}]`);
  if (r.exported.length > 20) lines.push(`  …… 还有 ${r.exported.length - 20} 个`);
  if (r.skipped.length) {
    lines.push('', `跳过 ${r.skipped.length} 个：`);
    for (const s of r.skipped) lines.push(`  = ${s.group}/${s.name} —— ${s.reason}`);
  }
  return lines.join('\n');
}

export function setActions(kind) {
  return [
    {
      id: kind + '.import',
      cli: [kind, 'import'],
      http: ['POST', '/api/' + kind + '/import'],
      summary: `批量导入：把目录（或 .zip 包）里的资源目录建成资源（一资源一目录，内含 ${MAIN} / style.css / script.js；--dry-run 先看计划）`,
      args: ['group'],
      flags: {
        from: { type: 'string', required: true, hint: '目录或 .zip 文件' },
        style: { type: 'string', hint: '默认 default' },
        tags: { type: 'array', hint: 'button,login' },
        'label-from': { type: 'string', enum: ['filename', 'title'], default: 'filename' },
        'dry-run': { type: 'boolean' },
      },
      run: (ctx) =>
        set.importDir({
          kind,
          group: ctx.group,
          from: ctx.from,
          style: ctx.style || 'default',
          tags: ctx.tags,
          labelFrom: ctx['label-from'],
          dryRun: ctx['dry-run'],
        }),
      render: renderImport,
    },
    {
      id: kind + '.export',
      cli: [kind, 'export'],
      http: ['POST', '/api/' + kind + '/export'],
      summary: `批量导出：把分组写成目录（<分组>/<资源>/{${MAIN},style.css,script.js}；只取当前风格）`,
      args: [{ name: 'group', required: false }],
      flags: {
        to: { type: 'string', required: true, hint: '目录' },
        style: { type: 'string', hint: '不传则各取当前风格' },
        force: { type: 'boolean' },
      },
      run: (ctx) => set.exportDir({ kind, group: ctx.group, to: ctx.to, style: ctx.style, force: ctx.force }),
      render: renderExport,
    },
  ];
}
