// svg 模块**专属**的 action（html 模块没有这些）。
//
// 与 core/assets/actions.js 的关系：那边是 html / svg 共用的「资源 CRUD + 风格 + 历史」，
// 这里是 SVG 作为「图标集」才需要的能力——看板、批量导入导出、规范审计与归一化、取源码。
//
// 为什么单独成文件而不是往共用表里塞：共用表要维持 html/svg 同构（registry 测试会断言），
// 一旦把 svg 独有的东西混进去，html 那边就要靠 `if (kind==='svg')` 打洞，
// 同构保证立刻失效。分开就没有这个诱惑。
import { loadAsset } from '../assets/assets.js';
import { notFound } from '../errors/index.js';
import * as st from '../assets/storage.js';
import { ICON_SPEC, ICON_SKELETON, PROFILES } from './spec.js';
import * as audit from './audit.js';
import * as board from './board.js';
import * as set from './set.js';

const SLOTS = ['svg', 'css', 'js'];

// 取单个槽位的源码：`svg cat` 是「agent 读 → 改 → 写回」这条闭环的读端。
// 输出是**裸源码**（不经 JSON 引号包裹），这样才能直接管道：cat > f.svg。
function catSlot({ group, name, style, slot }) {
  const a = loadAsset({ kind: 'svg', group, name, code: false });
  const use = style || a.activeStyle || (a.styles[0] && a.styles[0].name);
  if (!use || !a.styles.some((s) => s.name === use)) {
    throw notFound(`风格不存在: ${use || '(无)'}（该资源现有: ${a.styles.map((s) => s.name).join(', ') || '无'}）`);
  }
  const code = st.readCodeFiles('svg', a.group, a.name, use, SLOTS);
  return { status: 'ok', group: a.group, name: a.name, label: a.label, style: use, slot, code: code[slot] ?? '' };
}

function renderBoard(r) {
  const s = r.stats;
  if (!s.icons) return '库里还没有 svg 资源（先 svg import 或 svg add）';
  const lines = [`${r.count.groups} 组 / ${s.icons} 枚图标 · 合规 ${s.compliant} · 待规范 ${s.flagged}`];
  for (const g of r.groups) lines.push(`  ${g.path}/  (${g.label})  ${g.assets.length} 枚`);
  lines.push('', '面板: nx-ft serve → SVG 看板');
  return lines.join('\n');
}

function renderImport(r) {
  if (r.dryRun) {
    return [`将要导入 ${r.total} 个（--dry-run，未写入） → ${r.group}`, ...r.plan.map((p) => `  ${p.name}   ${p.file}`)].join('\n');
  }
  const lines = [`已导入 ${r.imported.length} 个到 ${r.group}（风格 ${r.style}）` + (r.groupCreated ? ' · 分组为本次新建' : '')];
  for (const i of r.imported.slice(0, 20)) lines.push(`  + ${i.name.padEnd(22)} ${i.file}`);
  if (r.imported.length > 20) lines.push(`  …… 还有 ${r.imported.length - 20} 个`);
  if (r.skipped.length) {
    lines.push('', `跳过 ${r.skipped.length} 个：`);
    for (const s of r.skipped) lines.push(`  = ${s.name} —— ${s.reason}`);
  }
  return lines.join('\n');
}

function renderExport(r) {
  const lines = [`已导出 ${r.exported.length} 个 → ${r.to}` + (r.style ? `（统一风格 ${r.style}）` : '（各取当前风格）')];
  for (const e of r.exported.slice(0, 20)) lines.push(`  → ${e.group}/${e.name}.svg`);
  if (r.exported.length > 20) lines.push(`  …… 还有 ${r.exported.length - 20} 个`);
  if (r.skipped.length) {
    lines.push('', `跳过 ${r.skipped.length} 个：`);
    for (const s of r.skipped) lines.push(`  = ${s.group}/${s.name} —— ${s.reason}`);
  }
  if (r.board) lines.push('', `看板页: ${r.board}`);
  return lines.join('\n');
}

function renderSpec(r) {
  const s = r.spec;
  const lines = [
    `图标规范（档位 line）`,
    `  viewBox      ${s.viewBox}`,
    `  网格         ${s.grid}pt`,
    `  线宽         ${s.strokeWidth}`,
    `  线帽/连接    ${s.strokeLinecap} / ${s.strokeLinejoin}`,
    `  颜色         ${s.color}（由外层 CSS 驱动，不写死）`,
    '',
    '自检: svg spec check [分组]     批量归一化: svg spec fix <分组>',
    '',
    '合规骨架（往 --code 里填路径即可）:',
    ICON_SKELETON,
  ];
  return lines.join('\n');
}

export function svgActions() {
  return [
    {
      id: 'svg.board',
      cli: ['svg', 'board'],
      http: ['GET', '/api/svg/board'],
      summary: '看板数据：整库图标（含当前风格 SVG 源码与规范审计），供面板一屏渲染',
      flags: {
        search: { type: 'string', hint: '关键词' },
        tags: { type: 'array', hint: 'a,b' },
      },
      run: (ctx) => board.buildBoard('svg', { search: ctx.search, tags: ctx.tags }),
      render: renderBoard,
    },
    {
      id: 'svg.assetDetail',
      cli: ['svg', 'detail'],
      http: ['GET', '/api/svg/detail'],
      summary: '资源详情：全部风格的源码与审计（资源页多风格并排对比用）',
      args: ['group', 'name'],
      run: (ctx) => board.buildAssetDetail('svg', { group: ctx.group, name: ctx.name }),
      render: (r) =>
        [`${r.group}/${r.name}  (${r.label})`, `  ${r.styles.length} 个风格 · ${r.stats.issues} 条规范问题`]
          .concat(
            r.styles.map(
              (s) => `  ${s.name}${s.name === r.activeStyle ? ' *' : ''}  历史 ${s.historyCount}  问题 ${s.audit.issues.length}`
            )
          )
          .join('\n'),
    },
    {
      id: 'svg.cat',
      cli: ['svg', 'cat'],
      http: ['GET', '/api/svg/cat'],
      summary: '打印某风格某槽位的裸源码（管道编辑 / agent 读取用：svg cat … > f.svg）',
      args: ['group', 'name'],
      flags: {
        style: { type: 'string' },
        slot: { type: 'string', enum: SLOTS, hint: 'svg|css|js', default: 'svg' },
      },
      run: (ctx) => catSlot({ group: ctx.group, name: ctx.name, style: ctx.style, slot: ctx.slot }),
      render: (r) => r.code,
    },
    {
      id: 'svg.import',
      cli: ['svg', 'import'],
      http: ['POST', '/api/svg/import'],
      summary: '批量导入：把目录下的 .svg 一次性建成资源（--dry-run 先看计划）',
      args: ['group'],
      flags: {
        from: { type: 'string', required: true, hint: '目录' },
        style: { type: 'string', hint: '默认 default' },
        tags: { type: 'array', hint: 'icon,line' },
        recursive: { type: 'boolean' },
        'label-from': { type: 'string', enum: ['filename', 'title'], default: 'filename' },
        'dry-run': { type: 'boolean' },
      },
      run: (ctx) =>
        set.importDir({
          kind: 'svg',
          group: ctx.group,
          from: ctx.from,
          style: ctx.style || 'default',
          tags: ctx.tags,
          recursive: ctx.recursive,
          labelFrom: ctx['label-from'],
          dryRun: ctx['dry-run'],
        }),
      render: renderImport,
    },
    {
      id: 'svg.export',
      cli: ['svg', 'export'],
      http: ['POST', '/api/svg/export'],
      summary: '批量导出：把分组写成目录（.svg + 一张自包含看板页 index.html）',
      args: [{ name: 'group', required: false }],
      flags: {
        to: { type: 'string', required: true, hint: '目录' },
        style: { type: 'string', hint: '不传则各取当前风格' },
        board: { type: 'boolean', default: true },
        force: { type: 'boolean' },
      },
      run: (ctx) =>
        set.exportDir({
          kind: 'svg',
          group: ctx.group,
          to: ctx.to,
          style: ctx.style,
          board: ctx.board,
          force: ctx.force,
        }),
      render: renderExport,
    },
    {
      id: 'svg.spec.show',
      cli: ['svg', 'spec', 'show'],
      http: ['GET', '/api/svg/spec'],
      summary: '打印图标规范与合规骨架（agent 写新图标前先看这个）',
      run: () => ({ status: 'ok', spec: ICON_SPEC, profiles: PROFILES, skeleton: ICON_SKELETON }),
      render: renderSpec,
    },
    {
      id: 'svg.spec.check',
      cli: ['svg', 'spec', 'check'],
      http: ['GET', '/api/svg/spec-check'],
      summary: '规范审计：逐条列出不合规的图标与原因（--group 限定范围）',
      args: [{ name: 'group', required: false }],
      flags: {
        profile: { type: 'string', enum: PROFILES, default: 'line' },
        accent: { type: 'string', hint: '双色档用：哪个色值是主题色（例 "#5B7CFA"）' },
      },
      run: (ctx) => audit.checkLibrary('svg', { group: ctx.group, profile: ctx.profile, accent: ctx.accent }),
      render: audit.renderCheck,
    },
    {
      id: 'svg.spec.fix',
      cli: ['svg', 'spec', 'fix'],
      http: ['POST', '/api/svg/spec-fix'],
      summary: '批量归一化：统一 viewBox / 去掉写死宽高 / 颜色换 currentColor（改动进编辑历史，可回退；不传分组则整库）',
      // group 与 svg.spec.check 一样是**可选**的：不传即整库。
      // 这里必须可选，否则面板上的「一键归一化」根本发不出请求——
      // HTTP 路由没有路径占位符，必填的位置参数只能从 body 取，
      // 而面板在整库范围下压根没有分组可填（声明成必填就恒定 400）。
      args: [{ name: 'group', required: false }],
      flags: {
        style: { type: 'string', hint: '不传则修当前风格' },
        profile: { type: 'string', enum: PROFILES, default: 'line' },
        accent: { type: 'string', hint: '双色档用：哪个色值是主题色（例 "#5B7CFA"）' },
        'dry-run': { type: 'boolean' },
      },
      run: (ctx) =>
        audit.fixLibrary('svg', {
          group: ctx.group,
          style: ctx.style,
          profile: ctx.profile,
          accent: ctx.accent,
          dryRun: ctx['dry-run'],
        }),
      render: audit.renderFix,
    },
  ];
}
