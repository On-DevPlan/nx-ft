// 全局面板状态：bootstrap 数据 + 会话级选择。
//
// 关键约定：凡是「刷新后不该丢」的用户选择（当前视图、各种下拉与勾选）
// 一律走 persist 读写 localStorage——**UI 状态持久化是硬标准，不是可选项**。
// 用户切了 tab、按了刷新，回到原处；否则每次刷新都跳回首页，用起来像坏了。
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api/client.js';

const LS_KEY = 'nx-se-ui';

const DEFAULT_UI = {
  view: 'studio',
  // StyleLab / Catalog 的跨刷新选择：让用户切到一半能继续。
  // pack 类选择一律 null 起步——有效默认由各视图按 packs 清单解析
  // （catalog 序第一个），这里硬编码 pack 名会在 pack 演化后全部失效
  // （'paper' 默认值就是这么烂掉的）。
  catalogPack: null,
  labTokens: 'light',
  labStyle: null,
  labComponent: 'btn',
  // ComponentDoc：catalog 点击行后进入的组件文档页
  docComponent: null,
  docTokens: 'light',
  docStyle: null,
};

function loadUi() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULT_UI };
    return { ...DEFAULT_UI, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_UI };
  }
}

const StoreCtx = createContext(null);

export function StoreProvider({ children }) {
  const [boot, setBoot] = useState(null);
  const [ui, setUi] = useState(loadUi);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(ui));
    } catch {
      /* 隐私模式等场景静默降级 */
    }
  }, [ui]);

  const refreshBoot = useCallback(async () => {
    const b = await api('/api/bootstrap');
    setBoot(b);
    return b;
  }, []);

  useEffect(() => {
    refreshBoot().catch(() => {});
  }, [refreshBoot]);

  const patchUi = useCallback((patch) => {
    setUi((u) => (typeof patch === 'function' ? { ...u, ...patch(u) } : { ...u, ...patch }));
  }, []);

  const value = useMemo(
    () => ({ boot, ui, patchUi, refreshBoot }),
    [boot, ui, patchUi]
  );
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useStore 必须在 StoreProvider 内使用');
  return ctx;
}
