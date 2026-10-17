// 资源集的批量搬移：**一资源一目录**的三件套约定（index.html / style.css / script.js）。
//
// 与 core/svg/set.js 是并列的两份，不是上下层：svg 的资源是「一枚图标 = 一个文件」，
// 平铺成一堆 .svg 天然成立；html 的资源是「一个场景 = 三段代码（html/css/js）」，
// 平铺会丢槽位，所以约定成「一个资源一个目录，槽位对应固定文件名」：
//     卡片模板/会员卡片/index.html
//     卡片模板/会员卡片/style.css
//     卡片模板/会员卡片/script.js
// 槽位 ↔ 文件的映射表就是下面 FILES——这套约定唯一的真相来源，改约定只改那一处。
//
// 三条规矩与 svg 那份一致（搬移不该有第二套价值观）：
//   1. 逐字节保真 —— 只搬不改，要改内容走显式动作并进编辑历史
//   2. 不静默覆盖 —— 目标已存在时默认跳过并如实上报，--force 才覆盖
//   3. zip 条目先在过滤层挡掉目录条目 / `..` / 绝对路径（zip-slip 防御，成本一行）
//
// 风格维度与 svg 同口径：导入把三件套落在 --style 指定的一个风格上，
// 导出只取当前（或 --style 指定）风格；多风格往返不在这一版里。
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { badInput, notFound } from '../errors/index.js';
import { assertSafeName } from '../paths.js';
import { ASSET_KINDS, assertKind, normalizeTags, parseGroupPath } from './constants.js';
import { createAsset } from './assets.js';
import { addGroup } from './groups.js';
import * as st from './storage.js';
import { unzipStore, zipStore } from '../zip.js';

// 槽位 → 资源目录里的文件名（主槽随 kind 变：html 的 index.html / svg 的 icon.svg /
// color 的 data）。color 的 data 槽无扩展名，slot 名即文件名（与 storage.codeFilePath 一致）。
const FILES = { html: 'index.html', svg: 'icon.svg', css: 'style.css', js: 'script.js', data: 'data' };

const slotsOf = (kind) => ASSET_KINDS[kind].slots;
const fileNameOf = (slot) => FILES[slot];
const slotOfFile = (fileName) => Object.keys(FILES).find((s) => FILES[s] === fileName) || null;

// 展示名兜底：主槽里的 <title>（html 的 head，svg 同理）。
// 与 core/svg/set.js 的同名函数是各写一份——两边的「主槽」不同，
// 共享一个函数反而要把差异塞进参数里，不划算。
function labelFromTitle(code, fallback) {
  const m = String(code).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const t = m ? m[1].replace(/\s+/g, ' ').trim() : '';
  return t || fallback;
}

// color 的主槽是 Palette JSON（没有 <title>），展示名取 JSON 的 name，解析失败回退。
function labelFromPalette(code, fallback) {
  try {
    const p = JSON.parse(code);
    const t = p && p.name ? String(p.name).trim() : '';
    return t || fallback;
  } catch {
    return fallback;
  }
}

// zip 条目 → 每资源一组槽位代码。目录名（最后一段）派生资源名，
// 输入包里的上级目录不参与命名——包外层的包裹目录换来换去不该改资源名。
function sourcesFromZip(kind, zip, from) {
  const slots = slotsOf(kind);
  const byDir = new Map();
  for (const e of unzipStore(zip)) {
    const n = String(e.name).replace(/\\/g, '/');
    if (n.endsWith('/') || n.startsWith('/')) continue;
    if (/(^|\/)\.\.?(\/|$)/.test(n)) continue;
    const segs = n.split('/');
    const slot = slotOfFile(segs.pop());
    if (!slot || !slots.includes(slot)) continue;
    const dir = segs.join('/');
    if (!byDir.has(dir)) byDir.set(dir, {});
    byDir.get(dir)[slot] = e.data.toString('utf8');
  }
  const sources = [...byDir.entries()]
    .filter(([dir, code]) => dir && Object.keys(code).length)
    .map(([dir, code]) => ({ rel: dir, name: dir.split('/').pop(), code }));
  if (!sources.length) {
    throw notFound(
      `zip 里没有可导入的资源目录（约定：<目录>/${fileNameOf(slots[0])} 等槽位文件）${from ? `: ${from}` : ''}`
    );
  }
  return sources;
}

// 本机目录 → 每资源一组槽位代码。只看 --from 的直接子目录（约定本身就是一层：
// 每个子目录 = 一个资源），不递归——再深的层级在「一资源一目录」里没有语义。
function sourcesFromDir(kind, dir) {
  const slots = slotsOf(kind);
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    throw notFound(`目录不存在或不可读: ${dir}`);
  }
  const sources = [];
  for (const n of names.sort()) {
    const abs = join(dir, n);
    let s;
    try {
      s = statSync(abs);
    } catch {
      continue;
    }
    if (!s.isDirectory()) continue;
    const code = {};
    for (const f of readdirSync(abs)) {
      const slot = slotOfFile(f);
      if (slot && slots.includes(slot)) code[slot] = readFileSync(join(abs, f), 'utf8');
    }
    if (Object.keys(code).length) sources.push({ rel: n, name: n, code });
  }
  if (!sources.length) {
    throw notFound(`目录下没有可导入的资源目录（每个资源一个子目录，内含 ${slots.map(fileNameOf).join(' / ')}）: ${dir}`);
  }
  return sources;
}

// 计划：派生资源名、取展示名、同名拦截。
// 同名（不同上级目录里的同名资源目录）在写入前就拦掉——否则第二个会静默
// 变成 skipped，用户以为导进去了（与 svg 那份同一个坑、同一种防法）。
function buildImportPlan(kind, sources, labelFrom) {
  const main = slotsOf(kind)[0];
  const plan = sources.map((s) => {
    const name = assertSafeName(String(s.name).trim(), '由目录名派生的资源名');
    const raw = s.code[main] || '';
    const label = labelFrom === 'title'
      ? (kind === 'color' ? labelFromPalette(raw, name) : labelFromTitle(raw, name))
      : name;
    return { name, label, rel: s.rel, code: s.code };
  });
  const seen = new Map();
  const dupes = [];
  for (const p of plan) {
    if (seen.has(p.name)) dupes.push({ name: p.name, files: [seen.get(p.name), p.rel] });
    else seen.set(p.name, p.rel);
  }
  if (dupes.length) {
    throw badInput(
      `来源里有会派生同名资源的目录：${dupes.map((d) => d.files.join(' / ')).join('；')}（重命名其中一个再导入）`
    );
  }
  return plan;
}

// 计划的落地段：--dry-run 只出计划；真跑才建分组、逐条 createAsset。
function finishImport({ kind, group, sources, style, tags, labelFrom, dryRun, from }) {
  assertKind(kind);
  const groupPath = parseGroupPath(group);
  const tagList = normalizeTags(tags);
  const plan = buildImportPlan(kind, sources, labelFrom);

  if (dryRun) {
    return {
      status: 'ok',
      dryRun: true,
      group: groupPath,
      from,
      total: plan.length,
      plan: plan.map((p) => ({ name: p.name, label: p.label, file: p.rel, slots: Object.keys(p.code) })),
    };
  }

  let groupCreated = false;
  if (!st.loadGroup(kind, groupPath)) {
    addGroup({ kind, group: groupPath });
    groupCreated = true;
  }

  const imported = [];
  const skipped = [];
  for (const p of plan) {
    const r = createAsset({ kind, group: groupPath, name: p.name, label: p.label, tags: tagList, style, code: p.code });
    if (r.status === 'skipped') skipped.push({ name: p.name, reason: '资源已存在' });
    else {
      const bytes = Object.values(p.code).reduce((n, c) => n + Buffer.byteLength(c, 'utf8'), 0);
      imported.push({ name: p.name, label: p.label, file: p.rel, slots: Object.keys(p.code), bytes });
    }
  }

  return { status: 'ok', group: groupPath, from, groupCreated, style, tags: tagList, total: plan.length, imported, skipped };
}

export function importDir({ kind, group, from, style = 'default', tags, labelFrom = 'filename', dryRun = false }) {
  assertKind(kind);
  if (!from) throw badInput('需要 --from <目录或 .zip 文件>');
  const src = resolve(String(from));

  // .zip 也是合法来源：与目录只差「怎么拿到每资源的三件套」
  if (/\.zip$/i.test(src)) {
    let buf;
    try {
      buf = readFileSync(src);
    } catch {
      throw notFound(`zip 文件不存在或不可读: ${src}`);
    }
    return importZipBuffer({ kind, group, zip: buf, style, tags, labelFrom, dryRun, from: src });
  }

  return finishImport({ kind, group, sources: sourcesFromDir(kind, src), style, tags, labelFrom, dryRun, from: src });
}

// zip 来源的导入（HTTP 上传是原始字节流）。
export function importZipBuffer({
  kind,
  group,
  zip,
  style = 'default',
  tags,
  labelFrom = 'filename',
  dryRun = false,
  from = '(zip 内容)',
}) {
  return finishImport({ kind, group, sources: sourcesFromZip(kind, zip, from), style, tags, labelFrom, dryRun, from });
}

// ---- 导出：同一套「取哪批、取哪个风格」的判定，只是落点不同 ----

// 需要导出的资产清单（目录与 zip 两个出口共用，保证两边内容一致）
// pick 模式：选区 = 目录整选（递归）+ 任意深度子文件单列；传 {pick: [...]} 时走此分支。
function collectExports({ kind, group, style, pick }) {
  assertKind(kind);
  const slots = slotsOf(kind);

  if (pick) {
    if (!Array.isArray(pick) || !pick.length) throw badInput('pick 不能为空');
    const items = [];
    const skipped = [];
    const seen = new Set(); // 去重：整选目录与子文件混选时同一资源只取一次
    const pushItem = (gp, a) => {
      const useStyle = style || a.activeStyle || Object.keys(a.styles)[0];
      if (!useStyle || !a.styles[useStyle]) {
        skipped.push({ group: gp, name: a.name, reason: '没有可导出的风格' });
        return;
      }
      const code = st.readCodeFiles(kind, gp, a.name, useStyle, slots);
      const nonEmpty = slots.filter((s) => String(code[s] || '').trim());
      if (!nonEmpty.length) {
        skipped.push({ group: gp, name: a.name, reason: `风格 ${useStyle} 的槽位都是空的` });
        return;
      }
      const key = `${gp}/${a.name}`;
      if (seen.has(key)) return;
      seen.add(key);
      items.push({ group: gp, name: a.name, style: useStyle, code, slots: nonEmpty });
    };
    for (const p of pick) {
      if (!p || typeof p !== 'object') throw badInput('pick 项必须是对象');
      if (p.type === 'dir') {
        const dirPath = String(p.path || '');
        if (!dirPath) { skipped.push({ group: dirPath, name: '', reason: 'dir 项缺 path' }); continue; }
        const all = st.scanGroups(kind);
        for (const { groupPath, manifest } of all) {
          if (groupPath === dirPath || groupPath.startsWith(dirPath + '/')) {
            for (const a of Object.values(manifest.assets).filter((x) => x.kind === kind)) {
              pushItem(groupPath, a);
            }
          }
        }
      } else if (p.type === 'asset') {
        // p.key = 'group/name'（group 段本身可含 /，按最后一段切资源名）
        const key = String(p.key || '');
        const lastSlash = key.lastIndexOf('/');
        if (lastSlash <= 0) { skipped.push({ group: '', name: key, reason: 'asset key 非法' }); continue; }
        const gp = key.slice(0, lastSlash);
        const nm = key.slice(lastSlash + 1);
        const manifest = st.loadGroup(kind, parseGroupPath(gp));
        if (!manifest) { skipped.push({ group: gp, name: nm, reason: '分组不存在' }); continue; }
        const a = manifest.assets[nm];
        if (!a || a.kind !== kind) { skipped.push({ group: gp, name: nm, reason: '资源不存在' }); continue; }
        pushItem(gp, a);
      } else {
        throw badInput('pick 项 type 必须是 dir 或 asset');
      }
    }
    if (!items.length) throw notFound('没有可导出的资源（选区都缺风格或内容为空）');
    return { items, skipped };
  }

  const groupPaths = group ? [parseGroupPath(group)] : st.scanGroups(kind).map((g) => g.groupPath);
  if (!groupPaths.length) throw notFound('库里还没有任何分组');

  const items = [];
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
      const code = st.readCodeFiles(kind, gp, a.name, useStyle, slots);
      const nonEmpty = slots.filter((s) => String(code[s] || '').trim());
      if (!nonEmpty.length) {
        skipped.push({ group: gp, name: a.name, reason: `风格 ${useStyle} 的槽位都是空的` });
        continue;
      }
      items.push({ group: gp, name: a.name, style: useStyle, code, slots: nonEmpty });
    }
  }
  if (!items.length) throw notFound('没有可导出的资源（都缺风格或内容为空）');
  return { items, skipped };
}

// 导出到本机目录：<目标>/<分组路径>/<资源名>/{index.html,style.css,script.js}
export function exportDir({ kind, group, to, style, force = false } = {}) {
  if (!to) throw badInput('需要 --to <目录>');
  const target = resolve(String(to));
  const { items, skipped } = collectExports({ kind, group, style });

  const exported = [];
  for (const it of items) {
    const dir = join(target, ...it.group.split('/'), it.name);
    mkdirSync(dir, { recursive: true });
    const files = [];
    let blocked = null;
    for (const slot of it.slots) {
      const file = join(dir, fileNameOf(slot));
      if (existsSync(file) && !force) {
        blocked = file;
        break;
      }
      files.push({ slot, file });
    }
    if (blocked) {
      skipped.push({ group: it.group, name: it.name, reason: '文件已存在（加 --force 覆盖）', file: blocked });
      continue;
    }
    // 先全部检查再写：中途失败不会留下「写了一半」的资源目录
    for (const f of files) writeFileSync(f.file, it.code[f.slot], 'utf8');
    exported.push({
      group: it.group,
      name: it.name,
      style: it.style,
      dir,
      slots: it.slots,
      bytes: files.reduce((n, f) => n + Buffer.byteLength(it.code[f.slot], 'utf8'), 0),
    });
  }

  return { status: 'ok', to: target, style: style || null, total: exported.length + skipped.length, exported, skipped };
}

// 导出成内存里的 zip（面板「导出 zip」直接下载；CLI 也可用）
export function exportZip({ kind, group, style, pick } = {}) {
  const { items, skipped } = collectExports({ kind, group, style, pick });
  const entries = [];
  for (const it of items) {
    for (const slot of it.slots) {
      entries.push({ name: `${it.group}/${it.name}/${fileNameOf(slot)}`, data: it.code[slot] });
    }
  }

  const stamp = new Date().toISOString().slice(0, 10);
  let scope;
  if (pick) scope = `${kind}-pick-${items.length}`;
  else if (group) scope = group.replace(/\//g, '-');
  else scope = `${kind}-all`;
  return {
    status: 'ok',
    filename: `${scope}-${stamp}.zip`,
    buffer: zipStore(entries),
    count: items.length,
    skipped,
  };
}
