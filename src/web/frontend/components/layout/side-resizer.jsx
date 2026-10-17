// 侧边栏宽度分隔条：拖拽「资源管理面板 ↔ 内容区」之间的竖线，调整左右分配。
//
// 与工作台里的 SplitPane（按百分比）不同：侧边栏宽度是**像素**值（固定侧栏、
// main 自适应），更符合文件管理器的手感。这里产出两样东西：
//   useSideWidth() —— 宽度状态 + 拖拽 / 键盘 / 持久化逻辑
//   SideResizer    —— 中间那条可拖拽的竖线（role=separator）
//
// 拖拽全程基于 window 原生事件（mousemove / mouseup / blur），不依赖 React 重渲染
// 时序；宽度约束在 [MIN, MAX]，落 localStorage 记忆；双击 / 回车复位默认宽度。
// 键盘可达（WCAG 2.2 AA「Dragging Movements」：拖拽不能是唯一调整方式）。
import { useCallback, useEffect, useRef, useState } from 'react';

const SIDE_WIDTH_KEY = 'nx-ft-side-width';
export const DEFAULT_SIDE_W = 232;
export const MIN_SIDE_W = 160;
export const MAX_SIDE_W = 480;

const clamp = (v) => Math.min(MAX_SIDE_W, Math.max(MIN_SIDE_W, v));

function loadWidth() {
  try {
    const raw = localStorage.getItem(SIDE_WIDTH_KEY);
    if (raw == null) return DEFAULT_SIDE_W; // 修：Number(null)===0 会把宽度锁死在 0
    const v = Number(raw);
    return Number.isFinite(v) ? clamp(v) : DEFAULT_SIDE_W;
  } catch {
    return DEFAULT_SIDE_W;
  }
}

export function useSideWidth() {
  const [sideW, setSideW] = useState(loadWidth);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const persist = useCallback((v) => {
    try {
      localStorage.setItem(SIDE_WIDTH_KEY, String(Math.round(v)));
    } catch {
      /* 隐私模式静默 */
    }
  }, []);

  const onMove = useCallback((e) => {
    if (!dragging.current) return;
    setSideW(clamp(startW.current + (e.clientX - startX.current)));
  }, []);

  const onUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    // 复用 SplitPane 的 sp-dragging：拖拽期间让预览 iframe 上的遮罩接管指针，
    // 否则指针进入 iframe 后 window 收不到 mousemove/mouseup，分隔条会粘住（见 preview.css）
    document.body.classList.remove('sp-dragging');
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    // 拖动中切走窗口（alt-tab）mouseup 落在外面，失焦即当作松手
    window.addEventListener('blur', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('blur', onUp);
      onUp();
    };
  }, [onMove, onUp]);

  useEffect(() => {
    persist(sideW);
  }, [sideW, persist]);

  const beginDrag = useCallback((e) => {
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = sideW;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.body.classList.add('sp-dragging');
    e.preventDefault();
  }, [sideW]);

  const reset = useCallback(() => setSideW(DEFAULT_SIDE_W), []);

  // 键盘：方向键微调（Shift 大步）、Home/End 到两端、回车复位
  const onKeyDown = useCallback((e) => {
    const step = e.shiftKey ? 24 : 8;
    let next = null;
    if (e.key === 'ArrowLeft') next = sideW - step;
    else if (e.key === 'ArrowRight') next = sideW + step;
    else if (e.key === 'Home') next = MIN_SIDE_W;
    else if (e.key === 'End') next = MAX_SIDE_W;
    else if (e.key === 'Enter') next = DEFAULT_SIDE_W;
    if (next === null) return;
    e.preventDefault();
    setSideW(clamp(next));
  }, [sideW]);

  return { sideW, beginDrag, onKeyDown, reset };
}

export function SideResizer({ sideW, beginDrag, onKeyDown, reset }) {
  return (
    <div
      className="shell-resizer"
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label="调整侧边栏宽度（拖动，或用方向键）"
      aria-valuenow={Math.round(sideW)}
      aria-valuemin={MIN_SIDE_W}
      aria-valuemax={MAX_SIDE_W}
      title="拖拽调整侧边栏宽度 · 方向键微调 · 双击重置"
      onMouseDown={beginDrag}
      onDoubleClick={reset}
      onKeyDown={onKeyDown}
    />
  );
}
