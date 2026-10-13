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

test('每个模块至少一条 action；svg 的命令集必须覆盖 html（同构 + 专属扩展）', () => {
  for (const m of MODULES) {
    assert.ok(m.actions && m.actions.length, `模块 ${m.id} 没有 action`);
  }
  const html = MODULES.find((m) => m.id === 'html');
  const svg = MODULES.find((m) => m.id === 'svg');

  // 语义从「数量相等」放宽为「超集」：svg 在共用 CRUD 之上多了看板 / 批量 / 规范三类专属命令。
  // 但**共用部分必须逐条对齐** —— html 有一条，svg 就必须有同名的一条，
  // 否则「两个面板交互一致」这个前提就破了（同名的那条会各自漂移）。
  const strip = (id, kind) => id.replace(new RegExp('^' + kind + '\\.'), '');
  const svgIds = new Set(svg.actions.map((a) => strip(a.id, 'svg')));
  for (const a of html.actions) {
    assert.ok(svgIds.has(strip(a.id, 'html')), `svg 缺少与 html 对应的 action: ${a.id}`);
  }

  // 专属扩展确实存在（防止有人「为了过测试」把两边改成一样长）
  const extra = svg.actions.filter(
    (a) => !html.actions.some((h) => strip(h.id, 'html') === strip(a.id, 'svg'))
  );
  assert.ok(extra.length >= 5, `svg 应有专属 action（看板/批量/规范），实际只多出 ${extra.length} 条`);
});
