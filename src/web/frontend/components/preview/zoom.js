// 预览画布的缩放模型。纯函数、不碰 React——单测直接调它（tests/unit/preview-zoom.test.mjs）。
//
// 基准尺寸 = 舞台尺寸：k=1 时预览正好填满容器。这条要保住——「把预览区拉大、内容跟着
// 变大」被反复反馈过（见 CHANGELOG 里「预览高度被固定」那几轮），别为了缩放把它弄丢。
// k 只是叠在基准之上的倍数。
//
// 坐标约定：iframe 的逻辑盒子恒等于舞台尺寸，缩放/平移是画布上的 transform。
//   transform: translate(x, y) scale(k)，transform-origin: 0 0
//   ⇒ 内容点 c 落在舞台上的位置是 x + k*c
// x / y 因此以**舞台像素**计（缩放前的坐标），和 transform 的书写顺序一致。

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 16;
export const STEP = 1.25; // 按钮一档

export const IDENTITY = { k: 1, x: 0, y: 0 };

// 滚轮一格（deltaY = 100）≈ 1.16 倍。用指数而不是阶梯，触控板的碎步也能连续缩放。
const WHEEL_GAIN = 0.0015;

export function clampScale(k) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, k));
}

export function wheelFactor(deltaY) {
  return Math.pow(1 + WHEEL_GAIN, -deltaY);
}

// 把滚轮的 delta 归一成像素：Firefox 的「行」模式 deltaY 只有个位数，
// 不折算的话滚一整天也放不大。
export function wheelDelta(e) {
  if (e.deltaMode === 1) return e.deltaY * 16;
  if (e.deltaMode === 2) return e.deltaY * 100;
  return e.deltaY;
}

/**
 * 围绕锚点缩放，锚点下的内容保持不动。
 *
 * @param view  当前视图 { k, x, y }
 * @param factor 倍数（>1 放大）
 * @param px,py 锚点位置，含义由 space 决定
 * @param space 'stage'   → px/py 是舞台坐标（父窗口里相对舞台左上角；遮罩层上的事件走这条）
 *              'content' → px/py 已是内容坐标（iframe 内部坐标。它不受 transform 影响，
 *                          就等于内容坐标本身；滚轮落在 iframe 里时走这条）
 *
 * 推导：锚点下的内容点 a 满足 x + k*a = p；要求缩放后仍在 p：
 *   x' + k'*a = x + k*a  ⇒  x' = x + a*(k - k')
 * （不是常见的 t' = p - (k'/k)(p - t) —— 那条只在 x=0 或 k'=k 时与这里等价。）
 */
export function applyZoom(view, factor, px, py, space = 'stage') {
  const k = clampScale(view.k * factor);
  const ax = space === 'content' ? px : (px - view.x) / view.k;
  const ay = space === 'content' ? py : (py - view.y) / view.k;
  const d = view.k - k;
  return { k, x: view.x + ax * d, y: view.y + ay * d };
}
