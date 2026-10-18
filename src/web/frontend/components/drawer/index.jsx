// 侧边栏抽屉：右侧滑入的全高编辑面板。与 Modal 的分工——Modal 居中、适合大块
// 只读内容（diff / 历史 / 命令输出）；抽屉贴右缘、适合「清单长、逐项填」的表单。
// 纯壳件：不 import 任何业务模块，数据与动作全由调用方传入；
// 由调用方条件挂载（渲染即打开、卸载即关闭），进场一条 translateX 动画，退场不等待。
import { useEffect, useRef } from 'react';
import { Btn } from '../btn/index.jsx';

export function Drawer({ title, subtitle, onClose, children, footer, width = 440, testId = 'drawer' }) {
  const panelRef = useRef(null);
  // 只在挂载时做两件事：焦点落进面板第一个可交互件；Esc 关闭。
  // onClose 走 ref——调用方每次渲染传的都是新箭头函数，进依赖数组会让监听反复装卸。
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    // 焦点给第一个可输入件（body 里的输入框），没有才退到第一个按钮——
    // 「关闭」按钮在头部、文档序最靠前，直接 querySelector('button') 会抢走焦点。
    const first =
      panelRef.current?.querySelector('input, textarea, select') ||
      panelRef.current?.querySelector('button');
    first?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      className="drawer"
      data-testid={testId}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCloseRef.current();
      }}
    >
      <section
        ref={panelRef}
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ width: `min(${width}px, 92vw)` }}
      >
        <header className="drawer-head">
          <div className="drawer-head-main">
            <span className="drawer-title">{title}</span>
            {/* 盖上遮罩后页面身份被挡住，副标题负责交代「在编辑谁」 */}
            {subtitle ? <span className="drawer-sub mono">{subtitle}</span> : null}
          </div>
          <Btn size="sm" variant="secondary" onClick={onClose} testId={`${testId}-close`}>
            关闭
          </Btn>
        </header>
        <div className="drawer-body">{children}</div>
        {footer ? <footer className="drawer-foot">{footer}</footer> : null}
      </section>
    </div>
  );
}
