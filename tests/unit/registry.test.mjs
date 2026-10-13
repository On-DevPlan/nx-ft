// 注册表一致性：前端视图与后端模块两侧对齐。
//
// 规则（方向不对称，与 runtime/registry.js 的注释一致）：
//   前端每个视图都必须有对应的后端模块（登记了不存在的视图 = 测试失败）。
//   后端模块**允许**没有视图（平台级能力，如 skill）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULES } from '../../src/runtime/registry.js';
import { VIEWS } from '../../src/web/frontend/registry.js';

test('每个前端视图都能在后端找到同名模块', () => {
  const ids = new Set(MODULES.map((m) => m.id));
  for (const v of VIEWS) {
    assert.ok(ids.has(v.id), `视图 ${v.id} 没有对应的后端模块`);
  }
});

test('关键模块与视图都已登记（防漏登记静默失效）', () => {
  const moduleIds = MODULES.map((m) => m.id);
  for (const id of ['home', 'skill', 'html', 'svg', 'logo']) {
    assert.ok(moduleIds.includes(id), `后端模块缺 ${id}`);
  }
  const viewIds = VIEWS.map((v) => v.id);
  for (const id of ['home', 'html', 'svg', 'logo']) {
    assert.ok(viewIds.includes(id), `前端视图缺 ${id}`);
  }
});

test('每个模块至少一条 action，且 html/svg 的 action 数量一致（同构保证）', () => {
  for (const m of MODULES) {
    assert.ok(m.actions && m.actions.length, `模块 ${m.id} 没有 action`);
  }
  const html = MODULES.find((m) => m.id === 'html');
  const svg = MODULES.find((m) => m.id === 'svg');
  assert.equal(html.actions.length, svg.actions.length);
});
