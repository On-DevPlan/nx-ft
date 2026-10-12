// svg service：矢量资产的所有读路径。
//
// 跟 studio service 同样的契约：纯异步函数、抛 NxError、return 普通对象。
// 数据来源 = catalog.json（已由 build.mjs 扫盘生成）；原文 SVG 现场读盘。
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { APP_NAME, SVG_DIR } from '../../core/paths.js';
import { badInput, notFound } from '../../core/errors/index.js';

async function readJson(p) {
  return JSON.parse(await readFile(p, 'utf8'));
}

async function readCatalog() {
  const p = join(SVG_DIR, '..', 'manifest', 'catalog.json');
  if (!existsSync(p)) {
    throw notFound('catalog.json 未生成——先跑 `' + APP_NAME + ' studio build` 或 `' + APP_NAME + ' svg build`');
  }
  return readJson(p);
}

function assertSafeId(id, label = 'id') {
  if (!id || typeof id !== 'string') throw badInput(`${label} 不能为空`);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    throw badInput(`非法 ${label}: ${id}（仅允许小写字母/数字/连字符，且不能以连字符开头）`);
  }
  return id;
}

// ---- manifest：所有组（每组轻量摘要，不带 .svg 原文） ----

export async function manifest() {
  const cat = await readCatalog();
  const groups = (cat.svg || []).map((g) => ({
    id: g.id,
    title: g.title,
    description: g.description,
    viewBox: g.viewBox || null,
    items: (g.items || []).map((it) => ({
      name: it.name,
      title: it.title,
      tags: it.tags || [],
      viewBox: it.viewBox || g.viewBox || null,
      file: it.file,
    })),
    _source: g._source,
  }));
  return { groups };
}

// ---- group：单组完整 spec（items[] 完整字段） ----

export async function group({ id } = {}) {
  assertSafeId(id, 'group id');
  const cat = await readCatalog();
  const g = (cat.svg || []).find((x) => x.id === id);
  if (!g) {
    const known = (cat.svg || []).map((x) => x.id).join(' | ') || '（空）';
    throw notFound(`SVG 组不存在: ${id}（可用: ${known}）`);
  }
  return {
    id: g.id,
    kind: g.kind,
    title: g.title,
    description: g.description,
    viewBox: g.viewBox || null,
    items: (g.items || []).map((it) => ({
      name: it.name,
      title: it.title,
      tags: it.tags || [],
      viewBox: it.viewBox || g.viewBox || null,
      file: it.file,
    })),
    _source: g._source,
  };
}

// ---- preview：单件 SVG 原文 + 自包含 HTML 文档 ----
//
// 自包含文档设计：把 SVG 嵌进最小 HTML 骨架（带 <style> 兜底色，currentColor 透传），
// agent 拿这个 document 可以直接喂给浏览器 / iframe / 邮件，无需任何外链。
// 与 studio.preview 的「class 契约片段」对齐：都能用浏览器 / 邮件 / Markdown 预览。
export async function preview({ groupId, itemId } = {}) {
  assertSafeId(groupId, 'group id');
  assertSafeId(itemId, 'item id');
  const cat = await readCatalog();
  const g = (cat.svg || []).find((x) => x.id === groupId);
  if (!g) throw notFound(`SVG 组不存在: ${groupId}`);
  const item = (g.items || []).find((x) => x.name === itemId);
  if (!item) {
    const known = (g.items || []).map((x) => x.name).join(' | ') || '（空）';
    throw notFound(`item 不存在: ${groupId}/${itemId}（可用: ${known}）`);
  }

  const filePath = join(SVG_DIR, groupId, item.file);
  if (!existsSync(filePath)) {
    throw notFound(`SVG 源文件缺失: ${groupId}/${item.file}`);
  }
  const svg = await readFile(filePath, 'utf8');

  // 兼容 SVG 自身的 viewBox：item 覆盖 > 组默认 > SVG 自身第一个 viewBox
  const itemViewBox = item.viewBox || g.viewBox || null;

  return {
    group: groupId,
    item: itemId,
    title: item.title,
    tags: item.tags || [],
    viewBox: itemViewBox,
    svg, // 原始 SVG 字符串（已规范化）
    document: `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${groupId} · ${itemId}</title>
<style>
  body { margin: 0; padding: 24px; background: var(--bg, #fafafa); color: var(--ink, #222); font: 14px/1.5 system-ui, sans-serif; }
  .frame { display: inline-block; padding: 16px 24px; border: 1px dashed currentColor; border-radius: 4px; }
  svg { color: inherit; max-width: 100%; height: auto; }
</style>
</head>
<body>
  <div class="frame">${svg}</div>
</body>
</html>`,
  };
}

// ---- build：重建 catalog（CLI-only，对应 studio build 的同源操作） ----

export async function build() {
  const { buildCatalog } = await import('../../manifest/build.mjs');
  const r = await buildCatalog();
  return { ...r, path: join(SVG_DIR, '..', 'manifest', 'catalog.json') };
}
