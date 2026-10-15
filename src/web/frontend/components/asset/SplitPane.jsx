// 通用面板分隔条：左右 / 上下两块面板之间可拖拽改变占比。
// 思想来自 ft-uiux 不变量 7（PC 端面板中间可拖拽分隔条）。
// 框架无关，但当前项目用 React；任意现代 UI 栈可移植。
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * SplitPane —— 两块面板 + 中间分隔条，方向 horizontal / vertical。
 *
 *  行为：
 *  - 拖拽时实时调整两块面板占比
 *  - 受 minPct / maxPct 约束（避免拖到看不见）
 *  - 拖拽期间整页不卡顿（基于原生事件，不基于框架响应式）
 *  - 持久化：localStorage key 存在时记忆上次比例
 *
 *  用法：
 *  <SplitPane direction="vertical" initialPct={55} minPct={20} maxPct={80}
 *    left={<Editors />} right={<Preview />} persistKey="wb-split-html" />
 */
export function SplitPane({
  direction = 'vertical', // 'horizontal' = 左右分；'vertical' = 上下分
  initialPct = 50,
  minPct = 15,
  maxPct = 85,
  left,
  right,
  persistKey,
  testId,
}) {
  const stored = (() => {
    if (!persistKey) return initialPct;
    try {
      // 修：Number(null) === 0 会把初始宽度锁死在 0%。必须先判断 null。
      const raw = localStorage.getItem(persistKey);
      if (raw == null) return initialPct;
      const v = Number(raw);
      return Number.isFinite(v) ? v : initialPct;
    } catch {
      return initialPct;
    }
  })();
  const [pct, setPct] = useState(stored);
  const dragging = useRef(false);
  const wrapRef = useRef(null);

  const persist = useCallback(
    (v) => {
      if (!persistKey) return;
      try {
        localStorage.setItem(persistKey, String(v));
      } catch {
        /* 隐私模式静默 */
      }
    },
    [persistKey]
  );

  const onMove = useCallback(
    (e) => {
      if (!dragging.current) return;
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const pos =
        direction === 'horizontal' ? e.clientX - rect.left : e.clientY - rect.top;
      const total = direction === 'horizontal' ? rect.width : rect.height;
      const next = Math.min(maxPct, Math.max(minPct, (pos / total) * 100));
      setPct(next);
    },
    [direction, minPct, maxPct]
  );

  const onUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.body.classList.remove('sp-dragging');
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    // 拖动中切走窗口（alt-tab、点别的应用）会让 mouseup 落在外面收不到，
    // 回来时分隔条还挂在鼠标上。失焦即当作松手。
    window.addEventListener('blur', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('blur', onUp);
      // 拖拽中途卸载（比如按住分隔条时用键盘把路由切走）也要把 body 上的状态摘干净：
      // sp-dragging 留着会让预览遮罩一直接管指针，预览从此点不动、滚不动。
      onUp();
    };
  }, [onMove, onUp]);

  useEffect(() => {
    persist(pct);
  }, [pct, persist]);

  const onDown = (e) => {
    dragging.current = true;
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    // 预览是 iframe 承载的：指针一旦移到它上方，mousemove/mouseup 就被 iframe 自己的
    // document 吃掉，父窗口再也收不到——分隔条会「粘住」，松开鼠标还在跟着走。
    // 这个类让预览里的遮罩层在拖拽期间接管指针（见 styles/preview.css）。
    document.body.classList.add('sp-dragging');
    e.preventDefault();
  };

  // 双击分隔条 = 重置为 initialPct
  const onDoubleClick = () => setPct(initialPct);

  // 键盘替代（WCAG 2.2 AA「Dragging Movements」：拖拽不能是唯一的调整方式）：
  // 分隔条可聚焦，方向键微调、Shift+方向键大步、Home/End 到两端、双击/回车复位。
  const onKeyDown = (e) => {
    const back = direction === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';
    const fwd = direction === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
    const step = e.shiftKey ? 10 : 2;
    let next = null;
    if (e.key === back) next = pct - step;
    else if (e.key === fwd) next = pct + step;
    else if (e.key === 'Home') next = minPct;
    else if (e.key === 'End') next = maxPct;
    else if (e.key === 'Enter') next = initialPct;
    if (next === null) return;
    e.preventDefault();
    setPct(Math.min(maxPct, Math.max(minPct, next)));
  };

  const isHoriz = direction === 'horizontal';
  const dividerClass = isHoriz ? 'sp-divider sp-divider-h' : 'sp-divider sp-divider-v';

  const styleFirst = isHoriz
    ? { width: `${pct}%`, minWidth: 0 }
    : { height: `${pct}%`, minHeight: 0 };
  const styleSecond = isHoriz
    ? { width: `${100 - pct}%`, minWidth: 0 }
    : { height: `${100 - pct}%`, minHeight: 0 };

  return (
    <div
      ref={wrapRef}
      className={isHoriz ? 'sp-wrap sp-wrap-h' : 'sp-wrap sp-wrap-v'}
      data-testid={testId}
    >
      <div className={isHoriz ? 'sp-pane sp-pane-h' : 'sp-pane sp-pane-v'} style={styleFirst}>
        {left}
      </div>
      <div
        className={dividerClass}
        role="separator"
        tabIndex={0}
        aria-orientation={isHoriz ? 'vertical' : 'horizontal'}
        aria-label="调整面板比例（拖动，或用方向键）"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={minPct}
        aria-valuemax={maxPct}
        onMouseDown={onDown}
        onDoubleClick={onDoubleClick}
        onKeyDown={onKeyDown}
        title="拖拽改变占比 · 方向键微调 · 双击重置"
        data-testid={testId ? `${testId}-divider` : undefined}
      />
      <div className={isHoriz ? 'sp-pane sp-pane-h' : 'sp-pane sp-pane-v'} style={styleSecond}>
        {right}
      </div>
    </div>
  );
}
