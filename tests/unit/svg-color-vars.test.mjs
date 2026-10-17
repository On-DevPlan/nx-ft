// SVG 颜色变量引擎（svg/color-vars.js）的单元测试：
// 声明解析 / 字面量迁移（属性 + CSS 两路、去重、语义保持、自闭合保持）/ 幂等 / 覆盖样式。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectHardcoded,
  migrateToVars,
  parseVarDecls,
  upsertDeclBlock,
  varOverrideCss,
} from '../../src/web/frontend/components/svg/color-vars.js';

test('collectHardcoded：只收字面量，跟随语义（currentColor 等）与 url()/var() 不收', () => {
  const svg = '<path fill="#2B3445" stroke="none" color="currentColor" stroke="url(#g)" fill="var(--x)"/>';
  assert.deepEqual(collectHardcoded(svg), ['#2B3445']);
});

test('migrateToVars：属性字面量迁进 inline style，并生成声明块', () => {
  const src = '<svg viewBox="0 0 24 24"><path fill="#2B3445" d="M0 0"/><circle stroke="#FFB0A5" r="3"/></svg>';
  const r = migrateToVars(src);
  assert.equal(r.count, 2);
  assert.deepEqual(r.vars, [
    { name: '--c-1', value: '#2B3445' },
    { name: '--c-2', value: '#FFB0A5' },
  ]);
  assert.match(r.svg, /<path d="M0 0" style="fill:var\(--c-1,#2B3445\)" \/>/);
  assert.match(r.svg, /<circle r="3" style="stroke:var\(--c-2,#FFB0A5\)" \/>/);
  assert.match(r.svg, /<style>svg\{--c-1:#2B3445;--c-2:#FFB0A5\}<\/style><path/);
});

test('migrateToVars：自闭合写法保持（/> 不能丢，否则整份 SVG 结构塌掉）', () => {
  const src = '<svg><path fill="#111" d="M0 0"/><rect width="3" height="3"/></svg>';
  const r = migrateToVars(src);
  assert.match(r.svg, /<path d="M0 0" style="fill:var\(--c-1,#111\)" \/>/);
  // 未动的元素字节不变
  assert.match(r.svg, /<rect width="3" height="3"\/>/);
});

test('migrateToVars：同值共用一个变量；style 里已有的属性是死值——删属性不建变量', () => {
  const src = '<svg><path fill="#111" style="fill:#222" d="M0 0"/><path fill="#111" d="M1 1"/></svg>';
  const r = migrateToVars(src);
  // 第一个 path 的 fill 属性本来就被 style 压住（死值）：删掉、不计入；
  // 第二个 path 的 #111 建变量。
  assert.equal(r.count, 1);
  assert.deepEqual(r.vars, [{ name: '--c-1', value: '#111' }]);
  assert.match(r.svg, /<path style="fill:#222" d="M0 0" \/>/);
  assert.match(r.svg, /style="fill:var\(--c-1,#111\)"/);
});

test('migrateToVars：<style> 块 CSS 原地换 var()；属性与 CSS 同值共用变量', () => {
  const src = '<svg><style>.a{fill:#111;stroke: #222}</style><path class="a" stroke="#111" d="M0 0"/></svg>';
  const r = migrateToVars(src);
  assert.equal(r.count, 3);
  assert.match(r.svg, /\.a\{fill:var\(--c-1,#111\);stroke:\s*var\(--c-2,#222\)\}/);
  assert.match(r.svg, /stroke:var\(--c-1,#111\)/);
});

test('migrateToVars：幂等——迁完再迁不再变化', () => {
  const src = '<svg><path fill="#2B3445" d="M0 0"/></svg>';
  const once = migrateToVars(src);
  const twice = migrateToVars(once.svg);
  assert.equal(twice.count, 0);
  assert.equal(twice.svg, once.svg);
});

test('migrateToVars：无可迁移项时原样返回', () => {
  const src = '<svg><path fill="currentColor" stroke="url(#g)" d="M0 0"/></svg>';
  const r = migrateToVars(src);
  assert.equal(r.count, 0);
  assert.equal(r.svg, src);
});

test('parseVarDecls / upsertDeclBlock：声明块可读可更新（幂等）', () => {
  const src = '<svg><style>svg{--c-1:#111;--c-2:#222}</style><path d="M0 0"/></svg>';
  assert.deepEqual(parseVarDecls(src), [
    { name: '--c-1', value: '#111' },
    { name: '--c-2', value: '#222' },
  ]);
  const updated = upsertDeclBlock(src, [{ name: '--c-1', value: '#333' }]);
  assert.match(updated, /<style>svg\{--c-1:#333\}<\/style>/);
  assert.equal(parseVarDecls(updated).length, 1);
  // 无块时插到 <svg …> 开标签之后
  const inserted = upsertDeclBlock('<svg viewBox="0 0 9 9"><path/></svg>', [{ name: '--c-1', value: '#111' }]);
  assert.match(inserted, /^<svg viewBox="0 0 9 9"><style>/);
});

test('varOverrideCss：只输出有值的变量；空入参给空串', () => {
  assert.equal(varOverrideCss({ '--c-1': '#111', '--c-2': '' }), 'svg{--c-1:#111}');
  assert.equal(varOverrideCss(null), '');
  assert.equal(varOverrideCss({}), '');
});
