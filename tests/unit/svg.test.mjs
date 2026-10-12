// SVG 资产形状测试：覆盖「spec 合法 / .svg 文件存在且 well-formed / 反向无孤儿 / exports 登记」四个面。
//
// 跑在 build 之后（依赖 catalog.json 已写）。单独跑不通：先 `pnpm run manifest:build`。
//
// 模式对齐 tests/unit/manifest-consistency.test.mjs —— 把「spec ↔ 资产 ↔ catalog」三件套对齐。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SVG_DIR = join(ROOT, 'src', 'svg');
const CATALOG = join(ROOT, 'src', 'manifest', 'catalog.json');

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

// ---- 1. catalog 顶层有 svg 字段（build.mjs 改对的硬证明） ----

test('catalog.json 顶层含 svg 字段（build 写入）', () => {
  // 兜底：先 build。CI 链路 `pnpm test` 在我们之前跑过 manifest:build，这里直接读。
  assert.ok(existsSync(CATALOG), 'catalog.json 缺失——先 `pnpm run manifest:build`');
  const cat = readJson(CATALOG);
  assert.ok(Array.isArray(cat.svg), 'catalog.svg 必须是数组');
});

// ---- 2. 每个组 spec 自身合法 + spec.id == 目录名 ----

test('每个 SVG 组的 spec 合法且 id 等于目录名', () => {
  const cat = readJson(CATALOG);
  const seen = new Set();
  for (const g of cat.svg) {
    assert.equal(g.kind, 'svg-group', `${g.id}: kind 必须是 "svg-group"`);
    assert.ok(g.id && typeof g.id === 'string', `${g.id}: id 缺失`);
    assert.ok(g.title, `${g.id}: title 缺失`);
    assert.ok(Array.isArray(g.items), `${g.id}: items 必须是数组`);
    assert.ok(!seen.has(g.id), `组 id 重复: ${g.id}`);
    seen.add(g.id);
    // spec.id 必须等于目录名（防漂移）
    const groupDir = join(SVG_DIR, g.id);
    assert.ok(existsSync(groupDir), `磁盘上找不到组目录: ${g.id}`);
    const specPath = join(groupDir, 'spec.json');
    assert.ok(existsSync(specPath), `组目录缺 spec.json: ${g.id}`);
    const onDisk = readJson(specPath);
    assert.equal(onDisk.id, g.id, `spec.id (${onDisk.id}) 必须等于目录名 (${g.id})`);
  }
});

// ---- 3. 反向断言 1：spec 引用的 .svg 必须存在 ----

test('每个 spec.items[].file 在磁盘上存在', () => {
  const cat = readJson(CATALOG);
  for (const g of cat.svg) {
    for (const it of g.items || []) {
      const p = join(SVG_DIR, g.id, it.file);
      assert.ok(existsSync(p), `${g.id}/${it.file}: 磁盘缺失`);
    }
  }
});

// ---- 4. 反向断言 2：磁盘上的 .svg 必须出现在 spec.items[] 里（防孤儿） ----

test('组目录下每个 .svg 必须在 spec.items[] 里登记（防孤儿）', () => {
  const cat = readJson(CATALOG);
  for (const g of cat.svg) {
    const groupDir = join(SVG_DIR, g.id);
    const files = readdirSync(groupDir).filter((f) => f.endsWith('.svg'));
    const declared = new Set((g.items || []).map((it) => it.file));
    const orphans = files.filter((f) => !declared.has(f));
    assert.deepEqual(orphans, [], `${g.id}: 孤儿 .svg（未在 spec.items 登记）: ${orphans.join(', ')}`);
  }
});

// ---- 5. .svg 文件 well-formed（XML 解析不报错） ----
//
// 用极简 parser：找配对的 <svg ...>...</svg>，算开闭标签数一致；
// 真正的 DOM 解析留给浏览器 / 服务端。这里只挡掉「忘记关标签 / 写错成纯文本」这类最常见错误。
// 解析深度不做语义校验（不查 viewBox、不查 path 语法），那超出本测试层。
test('每个 .svg 文件是 well-formed XML（粗校验：标签配对）', () => {
  const cat = readJson(CATALOG);
  for (const g of cat.svg) {
    for (const it of g.items || []) {
      const content = readFileSync(join(SVG_DIR, g.id, it.file), 'utf8');
      assert.ok(content.includes('<svg'), `${g.id}/${it.file}: 缺少 <svg> 根标签`);
      assert.ok(content.includes('</svg>'), `${g.id}/${it.file}: 缺少 </svg> 闭合`);
      // 统计 <svg 与 </svg> 数量一致（仅根，不递归 path 等）
      const open = (content.match(/<svg[\s>]/g) || []).length;
      const close = (content.match(/<\/svg>/g) || []).length;
      assert.equal(open, close, `${g.id}/${it.file}: <svg> (${open}) 与 </svg> (${close}) 数量不一致`);
      assert.ok(content.includes('viewBox='), `${g.id}/${it.file}: 缺少 viewBox 属性（响应式前提）`);
    }
  }
});

// ---- 6. package.json exports 登记了 ./svg（与 assets 实际挂载对齐） ----

test('package.json exports 登记了 "./svg"（资源已对外暴露）', () => {
  const pkg = readJson(join(ROOT, 'package.json'));
  assert.equal(pkg.exports['./svg'], './src/svg', 'package.json exports["./svg"] 必须是 "./src/svg"');
});

// ---- 7. _template 不计入 catalog（它只是模板，不是资产） ----

test('_template 目录不出现在 catalog.svg 里（它只是新组模板）', () => {
  const cat = readJson(CATALOG);
  const ids = cat.svg.map((g) => g.id);
  assert.ok(!ids.includes('_template'), '_template 是模板目录，不应被算作资产组');
});

// ---- 8. item.name 必填且组内唯一 ----

test('item.name 在组内唯一且 slug 合法', () => {
  const cat = readJson(CATALOG);
  for (const g of cat.svg) {
    const seen = new Set();
    for (const it of g.items || []) {
      assert.ok(it.name, `${g.id}: item.name 缺失 (file=${it.file})`);
      assert.ok(/^[a-z0-9][a-z0-9-]*$/.test(it.name), `${g.id}/${it.name}: 非法 slug（仅小写字母/数字/连字符）`);
      assert.ok(!seen.has(it.name), `${g.id}: item.name 重复: ${it.name}`);
      seen.add(it.name);
    }
  }
});
