// 多栏代码编辑器（HTML 工作台 / SVG 详情页共用）：一维最多 3 栏 + 页签 + CodeEditor。
//
// 状态在 panel-layout.js；DOM 在 view.jsx；sash 在 sash.js。
// 布局默认不自动落盘；页签条齿轮可「设为默认」，同 layoutKey 下打开任意资源都套这份。
// 读代码按 `[data-slot] .code-area`（见 readSlotCode）。
import { useEffect, useRef, useState } from 'react';
import { useToast } from '../ui.jsx';
import {
  initLayout,
  canSplit,
  splitPanel,
  mergeInto,
} from './panel-layout.js';
import { loadDefaultLayout, saveDefaultLayout } from './layout-default.js';
import { beginSashDrag } from './sash.js';
import { beforeSlotAt, edgeZone } from './helpers.jsx';
import { MultiPaneView } from './view.jsx';

export { initLayout, canSplit, splitPanel, mergeInto, resizeAt, snapshotLayout, layoutFromSnapshot, MAX_PANELS, MIN_PCT } from './panel-layout.js';
export { loadDefaultLayout, saveDefaultLayout } from './layout-default.js';

/** 从编辑器根节点按 slot 读出当前草稿（隐藏页签也在 DOM 里） */
export function readSlotCode(root, slots) {
  const out = {};
  for (const slot of slots) {
    const el = root?.querySelector?.(`[data-slot="${slot}"] .code-area`);
    out[slot] = el ? el.value : '';
  }
  return out;
}

/**
 * @param {string} layoutKey  默认布局 localStorage 键分段（如 html / svg）
 * @param {string[]} slots
 * @param {Record<string,string>} labels
 * @param {boolean} [ready]
 * @param {Record<string,string>} [code]  当前风格各 slot 初值
 * @param {string} [codeKey]  换风格时清种子 / 重挂载编辑器
 * @param {import('react').Ref} [rootRef]  父页读草稿用（与内部 root 合并）
 * @param {Record<string,{label:string,render:Function}>} [extras]  非代码模块页签
 */
export function MultiPaneEditor({
  layoutKey,
  slots,
  labels,
  ready = true,
  code = {},
  codeKey = '',
  onChange,
  onSave,
  rootRef: rootRefProp,
  // 非代码模块页签：{ [slotId]: { label, render() } }。与其余 slot 同层——
  // 一样能拖动合并 / 分栏，只是内容不是 CodeEditor（如 svg 编辑区的「颜色」面板）。
  extras = null,
}) {
  // 页签全集 = 代码 slots + 模块 slots。布局持久化按全集校验：老快照（没有模块
  // slot）对不上 → 回退单面板默认布局，编排过的话会重排一次，属可接受的迁移。
  const extraSlots = Object.keys(extras || {});
  const tabSlots = [...slots, ...extraSlots];
  const toast = useToast();
  const bootRef = useRef(null);
  if (!bootRef.current) {
    bootRef.current = initLayout(tabSlots, loadDefaultLayout(layoutKey, tabSlots));
  }
  const [layout, setLayout] = useState(() => bootRef.current);
  const idSeq = useRef(bootRef.current.panels.length);
  const dragRef = useRef(null); // { slot, fromId }
  // hint: { kind:'edge', panelId, side } | { kind:'tab', panelId, beforeSlot } | null
  const [hint, setHint] = useState(null);
  const innerRootRef = useRef(null);
  const setRoot = (el) => {
    innerRootRef.current = el;
    if (typeof rootRefProp === 'function') rootRefProp(el);
    else if (rootRefProp) rootRefProp.current = el;
  };
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  // 分栏 / 合并会把 CodeEditor 在面板间卸载再挂载——只在改布局那一刻快照 DOM，
  // 把种子写进 seeds；日常输入不改 seeds，避免清撤销栈。
  const [seeds, setSeeds] = useState({});

  const readDrafts = () => readSlotCode(innerRootRef.current, slots);
  const panelIdOf = (state, slot) => state.panels.find((p) => p.tabs.includes(slot))?.id;

  const applyLayout = (updater) => {
    const before = layoutRef.current;
    const after = typeof updater === 'function' ? updater(before) : updater;
    if (after === before) return;
    const drafts = readDrafts();
    const moved = {};
    for (const slot of slots) {
      if (panelIdOf(before, slot) !== panelIdOf(after, slot) && drafts[slot] != null) {
        moved[slot] = drafts[slot];
      }
    }
    if (Object.keys(moved).length) setSeeds((s) => ({ ...s, ...moved }));
    setLayout(after);
  };

  const initialOf = (slot) => {
    if (Object.prototype.hasOwnProperty.call(seeds, slot)) return seeds[slot];
    return ready ? String(code?.[slot] ?? '') : '';
  };

  const slotsKey = tabSlots.join(',');
  const layoutBootKey = useRef(`${layoutKey}:${slotsKey}`);
  useEffect(() => {
    const key = `${layoutKey}:${slotsKey}`;
    if (layoutBootKey.current === key) return;
    layoutBootKey.current = key;
    const next = initLayout(tabSlots, loadDefaultLayout(layoutKey, tabSlots));
    setSeeds({});
    setLayout(next);
    idSeq.current = next.panels.length;
  }, [slotsKey, layoutKey]);

  useEffect(() => {
    setSeeds({});
  }, [codeKey]);

  const nextId = () => {
    idSeq.current += 1;
    return `g${idSeq.current}`;
  };

  const saveAsDefault = () => {
    if (saveDefaultLayout(layoutKey, layoutRef.current)) toast.ok('已设为默认布局（本类资源打开时套用）');
    else toast.bad('无法保存默认布局（存储不可用）');
  };

  const accept = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onTabsOver = (panelId, e) => {
    if (!dragRef.current) return;
    const beforeSlot = beforeSlotAt(e.currentTarget, e.clientX);
    accept(e);
    setHint((h) =>
      h && h.kind === 'tab' && h.panelId === panelId && h.beforeSlot === beforeSlot
        ? h
        : { kind: 'tab', panelId, beforeSlot }
    );
  };

  const onTabsDrop = (panelId, e) => {
    const src = dragRef.current;
    dragRef.current = null;
    setHint(null);
    if (!src) return;
    e.preventDefault();
    const beforeSlot = beforeSlotAt(e.currentTarget, e.clientX);
    applyLayout((s) =>
      mergeInto(s, { slot: src.slot, fromId: src.fromId, targetId: panelId, beforeSlot })
    );
  };

  const onPanelOver = (panelId, e) => {
    if (!dragRef.current) return;
    if (e.target.closest?.('.wb-tabs')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const side = edgeZone(rect, e.clientX, e.clientY);
    if (!side) {
      setHint((h) => (h && h.kind === 'edge' && h.panelId === panelId ? null : h));
      return;
    }
    const src = dragRef.current;
    if (!canSplit(layoutRef.current, src.fromId, panelId, side)) {
      setHint((h) => (h && h.kind === 'edge' && h.panelId === panelId ? null : h));
      return;
    }
    accept(e);
    setHint((h) =>
      h && h.kind === 'edge' && h.panelId === panelId && h.side === side
        ? h
        : { kind: 'edge', panelId, side }
    );
  };

  const onPanelDrop = (panelId, e) => {
    if (e.target.closest?.('.wb-tabs')) return;
    const src = dragRef.current;
    dragRef.current = null;
    setHint(null);
    if (!src) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const side = edgeZone(rect, e.clientX, e.clientY);
    if (!side || !canSplit(layoutRef.current, src.fromId, panelId, side)) return;
    e.preventDefault();
    const newId = nextId();
    applyLayout((s) =>
      splitPanel(s, { slot: src.slot, fromId: src.fromId, targetId: panelId, side, newId })
    );
  };

  const onPanelLeave = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setHint(null);
  };

  const sashDragRef = useRef(null);
  useEffect(
    () => () => {
      sashDragRef.current?.end();
    },
    []
  );

  const onSashPointerDown = (index, e) => {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    if (sashDragRef.current) sashDragRef.current.end();
    const wrap = innerRootRef.current?.querySelector('.wb-panels');
    const state = layoutRef.current;
    const row = state.axis === 'row';
    const handle = beginSashDrag({
      wrap,
      state,
      index,
      sashEl: e.currentTarget,
      pointerId: e.pointerId,
      startClient: row ? e.clientX : e.clientY,
      setLayout,
      onEnded: () => {
        sashDragRef.current = null;
      },
    });
    if (handle) sashDragRef.current = handle;
  };

  const axis = layout.axis || 'row';
  const multi = layout.panels.length > 1;

  return (
    <MultiPaneView
      setRoot={setRoot}
      layout={layout}
      axis={axis}
      multi={multi}
      labels={labels}
      extras={extras}
      ready={ready}
      codeKey={codeKey}
      hint={hint}
      dragRef={dragRef}
      layoutRef={layoutRef}
      initialOf={initialOf}
      onChange={onChange}
      onSave={onSave}
      onPanelOver={onPanelOver}
      onPanelLeave={onPanelLeave}
      onPanelDrop={onPanelDrop}
      onTabsOver={onTabsOver}
      onTabsDrop={onTabsDrop}
      onSashPointerDown={onSashPointerDown}
      saveAsDefault={saveAsDefault}
      setLayout={setLayout}
      setHint={setHint}
    />
  );
}
