// 布局骨架：顶部 header，下面「左：侧边栏 | 右：main」。
//
//   mode="a"  双栏（带侧边栏）
//   mode="b"  全宽（无侧边栏，main 占满）
//
// main 内部再分两层：
//   上 = 工具区（常驻，不随内容滚动）
//   下 = 内容区（children，自己的滚动条）
//
// 工具区的内容有两种给法：
//   1. toolbar 属性 —— 调用方（壳）直接传节点；
//   2. <ShellBar> 传送门 —— 深处的视图把自己的工具行送上来（管理页在用）。
//      视图卸载时传送门拆除，工具区回到空（:empty 时整条隐藏，不留空条）。
//
// 组件只搭骨架：不认路由、不认 store、不 import 任何域组件。
// mode="a" 但没给 sidebar 时自动退化为全宽（不留空列）。
// 高度 100vh 撑满视口、滚动收在 main 内容区 / 侧边栏各自内部，
// 因此不需要给 html/body 加全局样式——组件没被渲染时全库零影响。
import { createContext, useContext, useState } from 'react';
import { createPortal } from 'react-dom';

const BarCtx = createContext(null);

// 视图侧的传送门：<ShellBar><button …/></ShellBar> → 内容出现在壳的工具区。
export function ShellBar({ children }) {
  const el = useContext(BarCtx);
  return el ? createPortal(children, el) : null;
}

export function Layout({ mode = 'a', header = null, sidebar = null, toolbar = null, children }) {
  const withSide = mode === 'a' && !!sidebar;
  const [barEl, setBarEl] = useState(null);
  return (
    <BarCtx.Provider value={barEl}>
      <div className="shell" data-testid="layout" data-mode={withSide ? 'a' : 'b'}>
        <header>{header}</header>
        <div className="shell-row">
          {withSide ? <div className="shell-side">{sidebar}</div> : null}
          <main>
            <div className="shell-bar" ref={setBarEl} data-testid="layout-toolbar">
              {toolbar}
            </div>
            <div className="shell-content">{children}</div>
          </main>
        </div>
      </div>
    </BarCtx.Provider>
  );
}
