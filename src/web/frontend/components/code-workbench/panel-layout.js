// 编辑区多面板的纯模型：面板数组 + 主轴 + 栏宽占比。
//
// 与 UI 无关（不 import React、不碰 DOM），可以被单测直接压。
//
// ---- 为什么是**一维数组**而不是树 ----
//
// 上一版用「树 + 递归 SplitPane」做嵌套分屏，在第二层就崩了：`.sp-pane` 是 position:absolute，
// 面板的 flex:1 落在非 flex 父元素里失效，实测最深的组高达 3649px（内容自然撑高，完全没约束）。
// 一维数组没有嵌套，主轴一次定死，`flex` 直接等分，不存在任何嵌套尺寸推导。
//
// ---- 状态 ----
//   { axis: null|'row'|'col', panels: [{ id, tabs: string[], active: string }], sizes: number[] }
//
// ---- 五条不变量（单测逐条钉死，任何操作后都必须成立）----
//   1. **划分**：所有 panel.tabs 的并集恒为全部 slot，每个恰出现一次（拖拽是移动不是复制）
//   2. panels.length ∈ [1,3]，且 sizes.length === panels.length
//   3. axis === null ⟺ panels.length === 1
//   4. 没有空面板（被腾空的连带移除）
//   5. **data-slot 全局唯一** —— 由 (1) 直接推出。这是 readCode() 的地基：
//      工作台用 `querySelector('[data-slot="x"] .code-area')` 取代码，两个面板同时出现
//      同一个 slot 会让它静默读到另一个 textarea。

/** 单面板最小占比（分隔条拖到这儿就顶住） */
export const MIN_PCT = 15;

/** 新面板最多 3 个（只有 html/css/js 三个文件，再多必然是空面板） */
export const MAX_PANELS = 3;

// 落点方向 → 主轴。左右拆出 row，上下拆出 col。
const AXIS_OF = { left: 'row', right: 'row', top: 'col', bottom: 'col' };

export function initLayout(slots, snapshot) {
  const from = snapshot ? layoutFromSnapshot(snapshot, slots) : null;
  return from || { axis: null, panels: [{ id: 'g1', tabs: slots.slice(), active: slots[0] }], sizes: [100] };
}

/** 可落盘的布局快照（不含运行时 id） */
export function snapshotLayout(state) {
  return {
    axis: state.axis,
    sizes: state.sizes.slice(),
    panels: state.panels.map((p) => ({ tabs: p.tabs.slice(), active: p.active })),
  };
}

/**
 * 把快照还原成可用 layout；对不上当前 slots / 破坏不变量则返回 null（调用方回退 init）。
 * id 一律重发 g1..gn，避免和上一会话撞车。
 */
export function layoutFromSnapshot(snap, slots) {
  if (!snap || !Array.isArray(snap.panels) || !Array.isArray(snap.sizes)) return null;
  if (snap.panels.length < 1 || snap.panels.length > MAX_PANELS) return null;
  if (snap.sizes.length !== snap.panels.length) return null;
  if ((snap.axis === null) !== (snap.panels.length === 1)) return null;
  if (snap.axis != null && snap.axis !== 'row' && snap.axis !== 'col') return null;

  const want = [...slots].sort();
  const tabs = snap.panels.flatMap((p) => (Array.isArray(p?.tabs) ? p.tabs : []));
  if ([...tabs].sort().join('\0') !== want.join('\0')) return null;
  if (new Set(tabs).size !== tabs.length) return null;

  const sum = snap.sizes.reduce((a, b) => a + Number(b), 0);
  if (!Number.isFinite(sum) || Math.abs(sum - 100) > 0.5) return null;

  const panels = [];
  for (let i = 0; i < snap.panels.length; i++) {
    const p = snap.panels[i];
    if (!p?.tabs?.length) return null;
    const sz = Number(snap.sizes[i]);
    if (!Number.isFinite(sz) || sz < MIN_PCT - 0.01) return null;
    const active = p.tabs.includes(p.active) ? p.active : p.tabs[0];
    panels.push({ id: `g${i + 1}`, tabs: p.tabs.slice(), active });
  }
  return { axis: snap.axis, panels, sizes: snap.sizes.map(Number) };
}

/** 从分组里摘掉一个页签（active 被摘走则收到剩下的第一个上） */
// 把一个页签从它所在的面板摘掉；被腾空的面板连带移除，sizes 归一化，只剩一个时 axis 归 null。
// fromId 对不上（slot 不在该面板）→ 原样返回，避免后续 merge/split 再插入造成副本。
function detach(state, slot, fromId) {
  const from = state.panels.find((p) => p.id === fromId);
  if (!from || !from.tabs.includes(slot)) return state;

  const panels = state.panels.map((p) => {
    if (p.id !== fromId) return p;
    const tabs = p.tabs.filter((s) => s !== slot);
    return { ...p, tabs, active: tabs.includes(p.active) ? p.active : tabs[0] };
  });
  const keep = panels.map((p) => p.tabs.length > 0);
  if (keep.every(Boolean)) return { axis: state.axis, panels, sizes: state.sizes.slice() };

  const kept = panels.filter((_, i) => keep[i]);
  let sizes = state.sizes.filter((_, i) => keep[i]);
  if (kept.length === 1) return { axis: null, panels: kept, sizes: [100] };

  const sum = sizes.reduce((a, b) => a + b, 0);
  sizes = sizes.map((s) => (s / sum) * 100);
  return { axis: state.axis, panels: kept, sizes };
}

/**
 * 这个边缘落点能不能拆。唯一被拒的自身情形：目标就是源面板、且源面板只有这一个文件——
 * 摘走它源面板就空了，等于把面板挪个位置，是个「拖了却什么都没发生」的假操作。
 * 轴冲突（已定 row 却往上下拆）与超上限（已有 3 栏）也在这一并拒掉。
 */
export function canSplit(state, fromId, targetId, side) {
  if (!AXIS_OF[side]) return false;
  if (state.panels.length >= MAX_PANELS) return false;
  if (state.axis && state.axis !== AXIS_OF[side]) return false;
  if (fromId === targetId) {
    const from = state.panels.find((p) => p.id === fromId);
    if (!from || from.tabs.length <= 1) return false;
  }
  return true;
}

/** 拖到边缘：在 targetId 面板的 side 侧开一个新面板（newId），把 slot 放进去 */
export function splitPanel(state, { slot, fromId, targetId, side, newId }) {
  if (!canSplit(state, fromId, targetId, side)) return state;
  const axis = state.axis ?? AXIS_OF[side];
  const atFront = side === 'left' || side === 'top';

  const d = detach(state, slot, fromId);
  if (d === state) return state; // fromId 对不上，detach 拒绝
  const ti = d.panels.findIndex((p) => p.id === targetId);
  if (ti < 0) return state;

  // 新面板拿目标面板一半的占比——但**不按字数分**，是有先后顺序的插入到 panels/sizes
  const half = d.sizes[ti] / 2;
  const insertAt = atFront ? ti : ti + 1;
  const panels = d.panels.slice();
  const sizes = d.sizes.slice();
  panels.splice(insertAt, 0, { id: newId, tabs: [slot], active: slot });
  sizes[ti] = half;
  sizes.splice(insertAt, 0, half);

  return { axis, panels, sizes };
}

/**
 * 拖到页签条：把 slot 插到 targetId 面板的 beforeSlot 之前（null = 追加末尾）。
 * 同一面板内则是就地重排。
 */
export function mergeInto(state, { slot, fromId, targetId, beforeSlot }) {
  const target = state.panels.find((p) => p.id === targetId);
  if (!target || beforeSlot === slot) return state;

  if (fromId === targetId) {
    // 同面板重排：slot 必须已在本面板，否则 splice 会凭空多出一份
    if (!target.tabs.includes(slot)) return state;
    const tabs = target.tabs.filter((s) => s !== slot);
    const at = beforeSlot == null ? tabs.length : Math.max(0, tabs.indexOf(beforeSlot));
    tabs.splice(at < 0 ? tabs.length : at, 0, slot);
    return {
      ...state,
      panels: state.panels.map((p) => (p.id === targetId ? { ...p, tabs, active: slot } : p)),
    };
  }

  const d = detach(state, slot, fromId);
  if (d === state) return state; // fromId 对不上，detach 拒绝
  const ti = d.panels.findIndex((p) => p.id === targetId);
  if (ti < 0) return state;
  const t = d.panels[ti];
  const tabs = t.tabs.slice();
  const at = beforeSlot == null ? tabs.length : Math.max(0, tabs.indexOf(beforeSlot));
  tabs.splice(at < 0 ? tabs.length : at, 0, slot);

  const panels = d.panels.slice();
  panels[ti] = { ...t, tabs, active: slot };
  return { ...d, panels };
}

/**
 * 拖分隔条：把第 index 与 index+1 面板之间那条分隔移到整条的 pct%（整条 = 100）。
 * 受两侧 MIN_PCT 夹紧；两条面板的总和保持不变，所以 sizes 的和恒为 100。
 */
export function resizeAt(state, index, pct) {
  if (index < 0 || index + 1 >= state.sizes.length) return state;
  const sizes = state.sizes.slice();
  let acc = 0;
  for (let i = 0; i < index; i++) acc += sizes[i];
  const total = sizes[index] + sizes[index + 1];
  const next = Math.min(total - MIN_PCT, Math.max(MIN_PCT, pct - acc));
  sizes[index] = next;
  sizes[index + 1] = total - next;
  return { ...state, sizes };
}

/** 合并成一个面板（保留 keepId 这个面板的位置与 id） */
export function collectAll(state, keepId) {
  const tabs = state.panels.flatMap((p) => p.tabs);
  const keep = state.panels.find((p) => p.id === keepId);
  const active = keep && tabs.includes(keep.active) ? keep.active : tabs[0];
  return { axis: null, panels: [{ id: keepId, tabs, active }], sizes: [100] };
}
