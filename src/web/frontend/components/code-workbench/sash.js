// 栏间分隔条：pointer + rAF，一次 DOM 写（--wb-a）。
// 拖动态挂 body.wb-sash-drag，避免 React 重渲冲掉 class / flex。
import { MIN_PCT, resizeAt } from './panel-layout.js';

/**
 * @returns {{ end: (ev?: PointerEvent) => void } | null}
 */
export function beginSashDrag({
  wrap,
  state,
  index,
  sashEl,
  pointerId,
  startClient,
  setLayout,
  onEnded,
}) {
  const axis = state.axis;
  if (!wrap || !axis || index < 0 || index + 1 >= state.sizes.length) return null;

  const panels = [...wrap.querySelectorAll(':scope > .wb-panel')];
  const paneA = panels[index];
  const paneB = panels[index + 1];
  if (!paneA || !paneB) return null;

  const row = axis === 'row';
  // 用 A+B 内容区像素做换算（不含 sash、也不含第三栏）
  const ra = paneA.getBoundingClientRect();
  const rb = paneB.getBoundingClientRect();
  const startA_px = row ? ra.width : ra.height;
  const pairContentPx = startA_px + (row ? rb.width : rb.height);
  if (pairContentPx <= 0) return null;

  let baseAcc = 0;
  for (let i = 0; i < index; i++) baseAcc += state.sizes[i];
  const pairPct = state.sizes[index] + state.sizes[index + 1];
  const startA = state.sizes[index];

  sashEl.setPointerCapture?.(pointerId);

  document.body.classList.add('sp-dragging', 'wb-sash-drag');
  document.body.style.userSelect = 'none';
  document.body.style.cursor = row ? 'col-resize' : 'row-resize';
  paneA.dataset.resize = 'a';
  paneB.dataset.resize = 'b';
  wrap.style.setProperty('--wb-pair', String(pairPct));
  wrap.style.setProperty('--wb-a', String(startA));
  wrap.dispatchEvent(new CustomEvent('wb:resize-start', { bubbles: true }));

  let pendingPct = baseAcc + startA;
  let client = startClient;
  let raf = 0;
  let ended = false;

  const clampA = (a) => Math.min(pairPct - MIN_PCT, Math.max(MIN_PCT, a));

  const paint = () => {
    raf = 0;
    const newA_px = startA_px + (client - startClient);
    const a = clampA((newA_px / pairContentPx) * pairPct);
    pendingPct = baseAcc + a;
    wrap.style.setProperty('--wb-a', String(a));
  };

  const onMove = (ev) => {
    client = row ? ev.clientX : ev.clientY;
    if (!raf) raf = requestAnimationFrame(paint);
  };

  const end = (ev) => {
    if (ended) return;
    ended = true;

    try {
      sashEl.releasePointerCapture?.(pointerId);
    } catch {
      /* already released */
    }
    sashEl.removeEventListener('pointermove', onMove);
    sashEl.removeEventListener('pointerup', end);
    sashEl.removeEventListener('pointercancel', end);
    sashEl.removeEventListener('lostpointercapture', end);
    window.removeEventListener('blur', end);
    if (raf) cancelAnimationFrame(raf);

    if (ev && (ev.clientX != null || ev.clientY != null)) {
      client = row ? (ev.clientX ?? client) : (ev.clientY ?? client);
    }
    paint();

    const a = Number(wrap.style.getPropertyValue('--wb-a')) || startA;
    const b = pairPct - a;
    paneA.style.flex = `${a} 1 0%`;
    paneB.style.flex = `${b} 1 0%`;
    delete paneA.dataset.resize;
    delete paneB.dataset.resize;
    wrap.style.removeProperty('--wb-a');
    wrap.style.removeProperty('--wb-pair');
    document.body.classList.remove('sp-dragging', 'wb-sash-drag');
    document.body.style.userSelect = '';
    document.body.style.cursor = '';

    setLayout((s) => resizeAt(s, index, pendingPct));
    wrap.dispatchEvent(new CustomEvent('wb:resize-end', { bubbles: true }));
    onEnded?.();
  };

  sashEl.addEventListener('pointermove', onMove);
  sashEl.addEventListener('pointerup', end);
  sashEl.addEventListener('pointercancel', end);
  sashEl.addEventListener('lostpointercapture', end);
  window.addEventListener('blur', end);

  return { end };
}
