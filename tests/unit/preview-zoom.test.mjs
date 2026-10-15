// 预览缩放模型（src/web/frontend/components/preview/zoom.js）的单元测试。
//
// 断言的是**不变量**（锚点下的内容不动、上下限生效），不是某组具体的 x/y 数字——
// 那套数字随公式一改就全变，断言等于把实现抄一遍。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  IDENTITY,
  MAX_SCALE,
  MIN_SCALE,
  applyZoom,
  clampScale,
  wheelDelta,
  wheelFactor,
} from '../../src/web/frontend/components/preview/zoom.js';

// 内容点 c 落在舞台上的位置（与 CSS `translate(x,y) scale(k)` + origin 0 0 一致）
const atX = (view, cx) => view.x + view.k * cx;
const atY = (view, cy) => view.y + view.k * cy;

// 锚点在**内容坐标系**里的位置：舞台坐标反解回去
const contentX = (view, px) => (px - view.x) / view.k;
const contentY = (view, py) => (py - view.y) / view.k;

test('围绕舞台锚点缩放：锚点下的内容一动不动', () => {
  for (const view of [
    IDENTITY,
    { k: 2, x: -100, y: -40 }, // 已放大并平移过
    { k: 0.5, x: 60, y: 30 }, // 已缩小过
  ]) {
    for (const factor of [1.25, 2, 0.8]) {
      for (const [px, py] of [[100, 50], [0, 0], [320, 180]]) {
        const next = applyZoom(view, factor, px, py, 'stage');
        const where = `view=${JSON.stringify(view)} factor=${factor} 锚点=(${px},${py})`;
        assert.equal(atX(next, contentX(view, px)), px, `x 锚点漂了 ${where}`);
        assert.equal(atY(next, contentY(view, py)), py, `y 锚点漂了 ${where}`);
      }
    }
  }
});

test('内容坐标锚点与舞台坐标锚点等价（同一物理位置，两种事件来源）', () => {
  const view = { k: 2, x: -100, y: -40 };
  // 内容坐标 (40, 0) 此刻落在舞台上的 (-20, -40) 处
  assert.equal(atX(view, 40), -20);
  assert.equal(atY(view, 0), -40);
  assert.deepEqual(applyZoom(view, 2, -20, -40, 'stage'), applyZoom(view, 2, 40, 0, 'content'));
});

test('缩放比例被夹在上下限内，且夹住后锚点仍然不漂', () => {
  assert.equal(applyZoom(IDENTITY, 1e6, 10, 10).k, MAX_SCALE);
  assert.equal(applyZoom(IDENTITY, 1e-6, 10, 10).k, MIN_SCALE);

  const view = { k: 8, x: 0, y: 0 };
  const next = applyZoom(view, 1e6, 200, 120, 'stage');
  assert.equal(next.k, MAX_SCALE);
  assert.equal(atX(next, contentX(view, 200)), 200);
  assert.equal(atY(next, contentY(view, 120)), 120);
});

test('100% 是恒等：预览正好填满容器（这条行为被反复反馈过，别弄丢）', () => {
  assert.deepEqual(IDENTITY, { k: 1, x: 0, y: 0 });
  assert.equal(atX(IDENTITY, 0), 0);
  assert.equal(atX(IDENTITY, 600), 600); // 舞台右边界与内容右边界重合
});

test('clampScale 是幂等的', () => {
  for (const k of [0, 0.05, 1, 3.7, 99]) assert.equal(clampScale(clampScale(k)), clampScale(k));
});

test('滚轮：向上放大、向下缩小，且行/页模式折算成像素', () => {
  assert.ok(wheelFactor(-100) > 1, '向上滚应放大');
  assert.ok(wheelFactor(100) < 1, '向下滚应缩小');
  assert.equal(wheelFactor(0), 1);
  // Firefox 的行模式 deltaY 只有个位数，不折算就滚不动
  assert.equal(wheelDelta({ deltaY: 3, deltaMode: 1 }), 48);
  assert.equal(wheelDelta({ deltaY: 1, deltaMode: 2 }), 100);
  assert.equal(wheelDelta({ deltaY: 100, deltaMode: 0 }), 100);
});
