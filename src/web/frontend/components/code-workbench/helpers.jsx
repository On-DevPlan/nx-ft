// 多栏编辑器的纯辅助：落点几何、页签激活、齿轮图标。

export const EDGE = 0.25;

/** 在面板矩形上判边缘；中心返回 null（正文不响应） */
export function edgeZone(rect, x, y) {
  if (!rect || !rect.width || !rect.height) return null;
  const fx = (x - rect.left) / rect.width;
  const fy = (y - rect.top) / rect.height;
  const dist = { left: fx, right: 1 - fx, top: fy, bottom: 1 - fy };
  const sides = ['left', 'right', 'top', 'bottom'];
  let best = sides[0];
  for (const s of sides) if (dist[s] < dist[best]) best = s;
  return dist[best] <= EDGE ? best : null;
}

/** 页签条上：落在哪个页签之前（null = 追加末尾） */
export function beforeSlotAt(tabsEl, clientX) {
  const buttons = [...tabsEl.querySelectorAll('[data-slot-tab]')];
  for (const btn of buttons) {
    const r = btn.getBoundingClientRect();
    if (clientX < r.left + r.width / 2) return btn.getAttribute('data-slot-tab');
  }
  return null;
}

export function setActive(state, panelId, slot) {
  return {
    ...state,
    panels: state.panels.map((p) => (p.id === panelId ? { ...p, active: slot } : p)),
  };
}

export function SettingsGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M8.1 2.8h3.8l.35 1.55a5.2 5.2 0 0 1 1.35.78l1.5-.55 1.9 3.3-1.15 1.1c.1.45.15.9.15 1.37 0 .47-.05.92-.15 1.37l1.15 1.1-1.9 3.3-1.5-.55a5.2 5.2 0 0 1-1.35.78L11.9 17.2H8.1l-.35-1.55a5.2 5.2 0 0 1-1.35-.78l-1.5.55-1.9-3.3 1.15-1.1A5.6 5.6 0 0 1 4 10.35c0-.47.05-.92.15-1.37l-1.15-1.1 1.9-3.3 1.5.55a5.2 5.2 0 0 1 1.35-.78L8.1 2.8Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10.35" r="2.15" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
