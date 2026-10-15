// 编辑区多面板划分模型（panel-layout.js）的行为契约。
//
// 五条不变量（文件头注释钉死的）任何操作后都必须成立：
//   1. 划分：所有 panel.tabs 的并集恒为全部 slot，每个恰一次（移动不是复制）
//   2. panels.length 属于 [1,3]，且 sizes.length === panels.length
//   3. axis === null 当且仅当 panels.length === 1
//   4. 没有空面板
//   5. data-slot 全局唯一 —— 由 (1) 直接推出
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initLayout,
  canSplit,
  splitPanel,
  mergeInto,
  resizeAt,
  collectAll,
  snapshotLayout,
  layoutFromSnapshot,
  MAX_PANELS,
  MIN_PCT,
} from '../../src/web/frontend/components/code-workbench/panel-layout.js';

const SLOTS = ['html', 'css', 'js'];

function assertInvariants(state, slots = SLOTS) {
  const tabs = state.panels.flatMap((p) => p.tabs);
  assert.deepEqual([...tabs].sort(), [...slots].sort(), '划分：并集 = 全部 slot');
  assert.equal(new Set(tabs).size, tabs.length, '划分：每个 slot 恰一次');
  assert.ok(state.panels.length >= 1 && state.panels.length <= MAX_PANELS);
  assert.equal(state.sizes.length, state.panels.length);
  assert.equal(state.axis === null, state.panels.length === 1, 'axis 与单面板同步');
  for (const p of state.panels) {
    assert.ok(p.tabs.length > 0, '没有空面板');
    assert.ok(p.tabs.includes(p.active), 'active 必须在本面板 tabs 里');
  }
  const sum = state.sizes.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 100) < 1e-6, `sizes 之和应为 100，实际 ${sum}`);
}

test('initLayout：单面板持有全部 slot', () => {
  const s = initLayout(SLOTS);
  assert.equal(s.axis, null);
  assert.equal(s.panels.length, 1);
  assert.deepEqual(s.panels[0].tabs, SLOTS);
  assert.equal(s.panels[0].active, 'html');
  assertInvariants(s);
});

test('splitPanel：边缘拆出新面板（移动，不复制）', () => {
  let s = initLayout(SLOTS);
  s = splitPanel(s, { slot: 'css', fromId: 'g1', targetId: 'g1', side: 'right', newId: 'g2' });
  assert.equal(s.axis, 'row');
  assert.equal(s.panels.length, 2);
  assert.deepEqual(s.panels[0].tabs, ['html', 'js']);
  assert.deepEqual(s.panels[1].tabs, ['css']);
  assert.equal(s.panels[0].active, 'html');
  assertInvariants(s);
});

test('splitPanel：left/top 插到目标前面', () => {
  let s = initLayout(SLOTS);
  s = splitPanel(s, { slot: 'js', fromId: 'g1', targetId: 'g1', side: 'left', newId: 'g2' });
  assert.equal(s.panels[0].id, 'g2');
  assert.deepEqual(s.panels[0].tabs, ['js']);
  assert.equal(s.axis, 'row');
  assertInvariants(s);

  s = initLayout(SLOTS);
  s = splitPanel(s, { slot: 'js', fromId: 'g1', targetId: 'g1', side: 'top', newId: 'g2' });
  assert.equal(s.axis, 'col');
  assert.equal(s.panels[0].id, 'g2');
  assertInvariants(s);
});

test('canSplit：轴冲突 / 已满 3 栏 / 单页签自拆 → 拒', () => {
  let s = initLayout(SLOTS);
  s = splitPanel(s, { slot: 'css', fromId: 'g1', targetId: 'g1', side: 'right', newId: 'g2' });
  // 已定 row，上下拆拒掉（不做嵌套、不做换轴）
  assert.equal(canSplit(s, 'g1', 'g2', 'top'), false);
  assert.equal(canSplit(s, 'g1', 'g2', 'bottom'), false);
  assert.equal(canSplit(s, 'g1', 'g2', 'left'), true);

  // 单页签面板拖到自己边缘 = 假操作
  assert.equal(canSplit(s, 'g2', 'g2', 'right'), false);

  // 拆满 3 栏后再拒
  s = splitPanel(s, { slot: 'js', fromId: 'g1', targetId: 'g2', side: 'right', newId: 'g3' });
  assert.equal(s.panels.length, MAX_PANELS);
  assert.equal(canSplit(s, 'g1', 'g2', 'right'), false);
  assertInvariants(s);
});

test('mergeInto：跨面板合并；源空则连带移除', () => {
  let s = initLayout(SLOTS);
  s = splitPanel(s, { slot: 'css', fromId: 'g1', targetId: 'g1', side: 'right', newId: 'g2' });
  s = mergeInto(s, { slot: 'css', fromId: 'g2', targetId: 'g1', beforeSlot: null });
  assert.equal(s.axis, null);
  assert.equal(s.panels.length, 1);
  assert.ok(s.panels[0].tabs.includes('css'));
  assert.equal(s.panels[0].active, 'css');
  assertInvariants(s);
});

test('mergeInto：同面板内重排', () => {
  let s = initLayout(SLOTS);
  s = mergeInto(s, { slot: 'js', fromId: 'g1', targetId: 'g1', beforeSlot: 'html' });
  assert.deepEqual(s.panels[0].tabs, ['js', 'html', 'css']);
  assert.equal(s.panels[0].active, 'js');
  assertInvariants(s);
});

test('resizeAt：两侧夹紧 MIN_PCT，总和不变', () => {
  let s = initLayout(SLOTS);
  s = splitPanel(s, { slot: 'css', fromId: 'g1', targetId: 'g1', side: 'right', newId: 'g2' });
  const before = s.sizes[0] + s.sizes[1];
  s = resizeAt(s, 0, 5); // 极左 → 夹到 MIN_PCT
  assert.equal(s.sizes[0], MIN_PCT);
  assert.equal(s.sizes[0] + s.sizes[1], before);
  s = resizeAt(s, 0, 99);
  assert.equal(s.sizes[1], MIN_PCT);
  assertInvariants(s);
});

test('collectAll：收回单面板', () => {
  let s = initLayout(SLOTS);
  s = splitPanel(s, { slot: 'css', fromId: 'g1', targetId: 'g1', side: 'right', newId: 'g2' });
  s = collectAll(s, 'g2');
  assert.equal(s.axis, null);
  assert.equal(s.panels[0].id, 'g2');
  assert.deepEqual(s.panels[0].tabs, ['html', 'js', 'css']);
  assertInvariants(s);
});

test('snapshot / layoutFromSnapshot：往返保持划分；脏数据返回 null', () => {
  let s = initLayout(SLOTS);
  s = splitPanel(s, { slot: 'css', fromId: 'g1', targetId: 'g1', side: 'right', newId: 'g2' });
  const snap = snapshotLayout(s);
  const back = layoutFromSnapshot(snap, SLOTS);
  assert.ok(back);
  assert.equal(back.axis, 'row');
  assert.deepEqual(
    back.panels.map((p) => p.tabs),
    s.panels.map((p) => p.tabs)
  );
  assertInvariants(back);

  // 槽位对不上 / 缺面板 → null，调用方回退默认单栏
  assert.equal(layoutFromSnapshot(snap, ['svg', 'css', 'js']), null);
  assert.equal(layoutFromSnapshot({ axis: null, panels: [], sizes: [] }, SLOTS), null);
  assert.equal(layoutFromSnapshot(null, SLOTS), null);

  // initLayout 吃快照
  const booted = initLayout(SLOTS, snap);
  assert.equal(booted.panels.length, 2);
  assertInvariants(booted);
});

test('mergeInto / splitPanel：fromId 对不上时不产生副本', () => {
  let s = initLayout(SLOTS);
  s = splitPanel(s, { slot: 'css', fromId: 'g1', targetId: 'g1', side: 'right', newId: 'g2' });
  // css 已在 g2，却谎称从 g1 拖来 → 必须拒绝，不能在 g1 再插一份
  const before = JSON.stringify(s);
  s = mergeInto(s, { slot: 'css', fromId: 'g1', targetId: 'g1', beforeSlot: null });
  assert.equal(JSON.stringify(s), before);
  assertInvariants(s);

  s = splitPanel(s, { slot: 'css', fromId: 'g1', targetId: 'g1', side: 'left', newId: 'g3' });
  assert.equal(JSON.stringify(s), before);
  assertInvariants(s);
});
