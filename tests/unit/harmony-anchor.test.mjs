// 锚色（anchor）契约：external/color-studio/src/engine/anchor.js
//
// 锚色 = 派生色的基准色。以前它只在「点和声规则」那一刻写一次，之后再也不动：
// 色轮上的派生标记按「当前选中色」画，列表里的派生色却按「旧锚色」派生，
// 两边对不上 —— 用户看到的正是「锚色无效、不响应、不会自动变」。
//
// 现在锚色 = 当前选中的色卡（选中色 → 和声锚色 → 首色），下面钉住这条链路。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  reassignDerivedSlot,
  repairAnchor,
  resolveAnchorId,
  withAnchor,
  withHarmonyRule,
} from '../../src/web/frontend/external/color-studio/src/engine/anchor.js';

const entry = (id, hex, extra = {}) => ({
  id, hex, weight: 1, locked: false, note: '', tags: [], createdAt: 0, updatedAt: 0, ...extra,
});

// 一块板：A 是锚色，d0/d1 是派生色卡（triadic → slot 0 / slot 1）
function makeDoc(overrides = {}) {
  return {
    meta: { schemaVersion: '1.3.0', createdAt: 0, updatedAt: 0, authorEmail: '' },
    activePaletteId: 'P',
    palettes: [{
      id: 'P',
      name: '主色板',
      colorIds: ['A', 'd0', 'd1'],
      harmony: { type: 'triadic', anchorColorId: 'A', autoFill: false },
      sortBy: 'manual',
      createdAt: 0,
      updatedAt: 0,
    }],
    colorEntries: [
      entry('A', '#FF0000'),
      entry('d0', '#00FF00', { derivedFrom: { paletteId: 'P', rule: 'triadic', slot: 0 } }),
      entry('d1', '#0000FF', { derivedFrom: { paletteId: 'P', rule: 'triadic', slot: 1 } }),
    ],
    filterStack: [],
    pickHistory: [],
    viewState: {
      leftPane: 'palettes',
      showHarmony: true,
      selectedHarmony: 'triadic',
      brightness: 100,
      mainView: 'wheel',
      selectedColorId: 'A',
    },
    ...overrides,
  };
}

test('resolveAnchorId：选中色优先，其次和声锚色，最后首色', () => {
  const doc = makeDoc();
  assert.equal(resolveAnchorId(doc), 'A', '选中色即锚色');

  const noSel = makeDoc({
    viewState: { ...makeDoc().viewState, selectedColorId: null },
  });
  assert.equal(resolveAnchorId(noSel), 'A', '没有选中态时回落到和声锚色');

  const stale = makeDoc({
    viewState: { ...makeDoc().viewState, selectedColorId: 'GONE' },
  });
  assert.equal(resolveAnchorId(stale), 'A', '选中态指向已删除的卡时回落到和声锚色');

  const noHarmony = makeDoc({
    palettes: [{ ...makeDoc().palettes[0], harmony: null }],
    viewState: { ...makeDoc().viewState, selectedColorId: null },
  });
  assert.equal(resolveAnchorId(noHarmony), 'A', '没有和声锚色时回落到首色');
});

test('withAnchor：选中即锚色——选中态与 harmony.anchorColorId 一起改', () => {
  const next = withAnchor(makeDoc(), 'd0');
  assert.equal(next.viewState.selectedColorId, 'd0');
  assert.equal(next.palettes[0].harmony.anchorColorId, 'd0', '锚色必须跟着选中色走');
});

test('withAnchor：没变化就不动文档（不产生无谓写盘）', () => {
  const doc = makeDoc();
  assert.equal(withAnchor(doc, 'A'), doc, '已经是锚色时原样返回');
});

test('withAnchor：拿派生色卡当锚色时，旧锚色接手它的派生槽位（板不涨卡）', () => {
  const next = withAnchor(makeDoc(), 'd0');
  const byId = Object.fromEntries(next.colorEntries.map((c) => [c.id, c]));
  assert.equal(byId.d0.derivedFrom, undefined, '新锚色不再带派生角标');
  assert.equal(byId.A.derivedFrom.slot, 0, '旧锚色接手 slot 0');
  assert.equal(next.palettes[0].colorIds.length, 3, '色卡数量不变');
});

test('reassignDerivedSlot：旧锚色本身是派生色时不换手（避免两个派生角标）', () => {
  const doc = makeDoc();
  const swapped = reassignDerivedSlot(doc, 'd0', 'd1');
  const byId = Object.fromEntries(swapped.colorEntries.map((c) => [c.id, c]));
  assert.equal(byId.d1.derivedFrom.slot, 1, 'd1 仍是派生色');
  assert.equal(byId.d0.derivedFrom.slot, 0, 'd0 仍是派生色');
});

test('withHarmonyRule：点规则时锚色定到当前选中的色卡', () => {
  const doc = makeDoc();
  const next = withHarmonyRule(doc, 'analogous');
  assert.equal(next.palettes[0].harmony.type, 'analogous');
  assert.equal(next.palettes[0].harmony.anchorColorId, 'A', '锚色 = 当前选中色');
  assert.equal(next.viewState.selectedHarmony, 'analogous');
  assert.equal(next.viewState.showHarmony, true);
});

test('withHarmonyRule：选「无」清掉和声数据', () => {
  const next = withHarmonyRule(makeDoc(), null);
  assert.equal(next.palettes[0].harmony, null);
  assert.equal(next.viewState.selectedHarmony, null);
  assert.equal(next.viewState.showHarmony, false);
});

test('repairAnchor：锚色指向已删除的卡时重新指到首色', () => {
  const doc = makeDoc();
  doc.palettes[0].harmony.anchorColorId = 'GONE';
  const fixed = repairAnchor(doc);
  assert.equal(fixed.palettes[0].harmony.anchorColorId, 'A');
});

test('repairAnchor：板里一张色都没有时清掉和声（不留悬空锚色）', () => {
  const doc = makeDoc();
  doc.palettes[0].colorIds = [];
  doc.palettes[0].harmony.anchorColorId = 'GONE';
  const fixed = repairAnchor(doc);
  assert.equal(fixed.palettes[0].harmony, null);
});
