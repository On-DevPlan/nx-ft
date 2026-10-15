// 批量图标集：整目录导入 / 整目录导出（含独立看板页）。
//
// 存在的理由：图标从来不是「一个一个建」的。设计稿给过来的是一整个目录 48 个 .svg，
// 手工 add 48 次既慢又必然写错名字。反过来，交接/发布时也需要把库里的一整组
// 还原成「一个目录 + 一张看板页」交出去。
//
// 两条铁律：
//   1. 逐字节保真 —— 导入导出都不改 SVG 内容。要改内容请用 `svg spec fix`，
//      那是显式的、会进编辑历史的动作；transfer 只搬不改，否则「导出再导入」不是恒等变换。
//   2. 不静默覆盖 —— 目标已存在时默认跳过并如实上报，--force 才覆盖。
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { badInput, notFound } from '../errors/index.js';
import { assertSafeName } from '../paths.js';
import { createAsset } from '../assets/assets.js';
import { addGroup } from '../assets/groups.js';
import { assertKind, normalizeTags, parseGroupPath } from '../assets/constants.js';
import * as st from '../assets/storage.js';
import { renderBoardHtml } from './board-page.js';
import { auditSvg } from './spec.js';
import { unzipStore, zipStore } from '../zip.js';

const SLOTS = ['svg', 'css', 'js'];

// 从文件名派生资源名：去掉扩展名，把会被 assertSafeName 拒绝的字符换掉。
// 不追求「好看的 slug」——展示名走 --label / <title>，目录名只要能稳定寻址即可。
export function assetNameFromFile(file) {
  const base = String(file).replace(/\.svg$/i, '').trim();
  let n = base.replace(/[\\/]+/g, '-').replace(/\s+/g, '-').replace(/\.{2,}/g, '.');
  n = n.replace(/^\.+/, '');
  return assertSafeName(n, '由文件名派生的资源名');
}

export function labelFromTitle(svg, fallback) {
  const m = String(svg).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const t = m ? m[1].replace(/\s+/g, ' ').trim() : '';
  return t || fallback;
}

function listSvgFiles(dir, recursive, base = dir) {
  const out = [];
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    throw notFound(`目录不存在或不可读: ${dir}`);
  }
  for (const n of names.sort()) {
    const abs = join(dir, n);
    let s;
    try {
      s = statSync(abs);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      if (recursive) out.push(...listSvgFiles(abs, recursive, base));
      continue;
    }
    if (/\.svg$/i.test(n)) out.push({ abs, rel: abs.slice(base.length + 1).replace(/\\/g, '/') });
  }
  return out;
}

// ---- 批量导入（目录 / zip 两条来源在这里汇合） ----
//
// 来源只差「怎么拿到 {rel, svg} 列表」：目录靠遍历，zip 靠解包。之后的
// 查重、计划、落盘是同一份代码——`svg import --from x.zip` 与面板上传 zip
// 之所以保证行为一致，就是因为它们真的在跑同一个函数。

// 从已读出的源码列表构建计划：资源名派生、展示名、同名拦截。
function buildImportPlan(sources, labelFrom) {
  const plan = sources.map(({ rel, svg }) => {
    const name = assetNameFromFile(rel.split('/').pop());
    const label = labelFrom === 'title' ? labelFromTitle(svg, name) : name;
    return { name, label, file: rel, svg };
  });

  // 同名文件（大小写不敏感的文件系统上很常见）在导入前就拦掉，
  // 否则第二个会静默变成 skipped，用户以为导进去了。
  const seen = new Map();
  const dupes = [];
  for (const p of plan) {
    if (seen.has(p.name)) dupes.push({ name: p.name, files: [seen.get(p.name), p.file] });
    else seen.set(p.name, p.file);
  }
  if (dupes.length) {
    throw badInput(
      `来源里有会派生同名资源的文件：${dupes.map((d) => d.files.join(' / ')).join('；')}（重命名其中一个再导入）`
    );
  }
  return plan;
}

// 计划的落地段：--dry-run 只出计划；真跑才建分组、逐条 createAsset。
function finishImport({ kind, group, sources, style, tags, labelFrom, dryRun, from }) {
  assertKind(kind);
  const groupPath = parseGroupPath(group);
  const tagList = normalizeTags(tags);
  const plan = buildImportPlan(sources, labelFrom);

  if (dryRun) {
    return { status: 'ok', dryRun: true, group: groupPath, from, total: plan.length, plan: plan.map((p) => ({ name: p.name, label: p.label, file: p.file })) };
  }

  let groupCreated = false;
  if (!st.loadGroup(kind, groupPath)) {
    // kind 必须带上：addGroup 会 assertKind，漏了就是「未知资源类型: undefined」
    // （原 importDir 漏过这一项，只有导进已存在的分组才看不出问题）
    addGroup({ kind, group: groupPath });
    groupCreated = true;
  }

  const imported = [];
  const skipped = [];
  for (const p of plan) {
    const r = createAsset({ kind, group: groupPath, name: p.name, label: p.label, tags: tagList, style, code: { svg: p.svg } });
    if (r.status === 'skipped') skipped.push({ name: p.name, reason: '资源已存在' });
    else imported.push({ name: p.name, label: p.label, file: p.file, bytes: Buffer.byteLength(p.svg, 'utf8') });
  }

  return {
    status: 'ok',
    group: groupPath,
    from,
    groupCreated,
    style,
    tags: tagList,
    total: plan.length,
    imported,
    skipped,
  };
}

export function importDir({ kind, group, from, style = 'default', tags, recursive = false, labelFrom = 'filename', dryRun = false }) {
  assertKind(kind);
  if (!from) throw badInput('需要 --from <目录或 .zip 文件>');
  const src = resolve(String(from));

  // .zip 也是合法来源：与目录遍历只差「怎么列出文件」这一步
  if (/\.zip$/i.test(src)) {
    let buf;
    try {
      buf = readFileSync(src);
    } catch {
      throw notFound(`zip 文件不存在或不可读: ${src}`);
    }
    return importZipBuffer({ kind, group, zip: buf, style, tags, labelFrom, dryRun, from: src });
  }

  const files = listSvgFiles(src, recursive);
  if (!files.length) throw notFound(`目录下没有 .svg 文件: ${src}`);
  const sources = files.map((f) => ({ rel: f.rel, svg: readFileSync(f.abs, 'utf8') }));
  return finishImport({ kind, group, sources, style, tags, labelFrom, dryRun, from: src });
}

// zip 来源的导入。zip 参数收 Buffer（HTTP 上传是原始字节流，CLI 走 importDir 的
// .zip 分支读文件后也汇到这里）。zip 里的目录结构整棵都收（等价于 --recursive），
// 资源名仍只取文件名部分，与目录导入同名同规则。
export function importZipBuffer({ kind, group, zip, style = 'default', tags, labelFrom = 'filename', dryRun = false, from = '(zip 内容)' }) {
  const entries = unzipStore(zip);
  // 只收 .svg；目录条目与带 .. / 绝对路径的条目直接滤掉。这里虽不落盘
  // （派生资源名也不含路径），但来源不明的包不该走进后续逻辑——zip-slip 的
  // 防御放在过滤层，成本一行，永远不嫌早。
  const sources = entries
    .filter((e) => {
      const n = e.name.replace(/\\/g, '/');
      if (n.endsWith('/') || n.startsWith('/')) return false;
      if (/(^|\/)\.\.?(\/|$)/.test(n)) return false;
      return /\.svg$/i.test(n);
    })
    .map((e) => ({ rel: e.name, svg: e.data.toString('utf8') }));
  if (!sources.length) throw notFound(`zip 里没有可导入的 .svg 文件${from ? `: ${from}` : ''}`);
  return finishImport({ kind, group, sources, style, tags, labelFrom, dryRun, from });
}

// ---- 打包成 zip（浏览器直接下载用） ----
//
// 与 exportDir 的分工：exportDir 写到指定的本机目录（CLI 用），
// exportZip 把同一批文件**装进内存里的一个 zip** 交给 HTTP 层——
// 面板上点「批量导出」就该直接下载，而不是先让人填一个目录路径。
// 取文件的规则与 exportDir 完全一致（同一套「当前风格」判定），只是不落盘。
export function exportZip({ kind, group, style } = {}) {
  assertKind(kind);
  const groupPaths = group
    ? [parseGroupPath(group)]
    : st.scanGroups(kind).map((g) => g.groupPath);
  if (!groupPaths.length) throw notFound('库里还没有任何分组');

  const entries = [];
  const skipped = [];
  for (const gp of groupPaths) {
    const manifest = st.loadGroup(kind, gp);
    if (!manifest) throw notFound(`分组不存在: ${gp}`);
    for (const a of Object.values(manifest.assets).filter((x) => x.kind === kind)) {
      const useStyle = style || a.activeStyle || Object.keys(a.styles)[0];
      if (!useStyle || !a.styles[useStyle]) {
        skipped.push({ group: gp, name: a.name, reason: '没有可导出的风格' });
        continue;
      }
      const svg = st.readCodeFiles(kind, gp, a.name, useStyle, SLOTS).svg || '';
      if (!svg.trim()) {
        skipped.push({ group: gp, name: a.name, reason: `风格 ${useStyle} 的 svg 槽位为空` });
        continue;
      }
      entries.push({ name: `${gp}/${a.name}.svg`, data: svg });
    }
  }
  if (!entries.length) throw notFound('没有可导出的资源（都缺风格或内容为空）');

  const stamp = new Date().toISOString().slice(0, 10);
  const scope = group ? group.replace(/\//g, '-') : `${kind}-all`;
  return {
    status: 'ok',
    filename: `${scope}-${stamp}.zip`,
    buffer: zipStore(entries),
    count: entries.length,
    skipped,
  };
}

// ---- 批量导出 ----

export function exportDir({ kind, group, to, style, board = true, force = false }) {
  assertKind(kind);
  if (!to) throw badInput('需要 --to <目录>');
  const target = resolve(String(to));

  const groupPaths = group
    ? [parseGroupPath(group)]
    : st.scanGroups(kind).map((g) => g.groupPath);
  if (!groupPaths.length) throw notFound('库里还没有任何分组');

  const exported = [];
  const skipped = [];
  const boardGroups = [];

  for (const gp of groupPaths) {
    const manifest = st.loadGroup(kind, gp);
    if (!manifest) throw notFound(`分组不存在: ${gp}`);
    const assets = Object.values(manifest.assets).filter((a) => a.kind === kind);
    const boardAssets = [];

    for (const a of assets) {
      const useStyle = style || a.activeStyle || Object.keys(a.styles)[0];
      if (!useStyle || !a.styles[useStyle]) {
        skipped.push({ group: gp, name: a.name, reason: '没有可导出的风格' });
        continue;
      }
      const code = st.readCodeFiles(kind, gp, a.name, useStyle, SLOTS);
      const svg = code.svg || '';
      if (!svg.trim()) {
        skipped.push({ group: gp, name: a.name, reason: `风格 ${useStyle} 的 svg 槽位为空` });
        continue;
      }
      const dir = join(target, ...gp.split('/'));
      mkdirSync(dir, { recursive: true });
      const file = join(dir, a.name + '.svg');
      if (existsSync(file) && !force) {
        skipped.push({ group: gp, name: a.name, reason: '文件已存在（加 --force 覆盖）', file });
        continue;
      }
      writeFileSync(file, svg, 'utf8');
      exported.push({ group: gp, name: a.name, style: useStyle, file, bytes: Buffer.byteLength(svg, 'utf8') });
      boardAssets.push({
        name: a.name,
        label: a.label || a.name,
        tags: a.tags || [],
        file: gp.split('/').pop() + '/' + a.name + '.svg',
        svg,
        issues: auditSvg(svg).issues,
      });
    }

    if (boardAssets.length) boardGroups.push({ path: gp, label: manifest.group.label || gp, assets: boardAssets });
  }

  let boardFile = null;
  if (board && boardGroups.length) {
    mkdirSync(target, { recursive: true });
    boardFile = join(target, 'index.html');
    writeFileSync(
      boardFile,
      renderBoardHtml({
        title: 'SVG 图标集',
        subtitle: `导出目录 ${target}`,
        groups: boardGroups,
        spec: null,
      }),
      'utf8'
    );
  }

  return { status: 'ok', to: target, style: style || null, total: exported.length + skipped.length, exported, skipped, board: boardFile };
}
