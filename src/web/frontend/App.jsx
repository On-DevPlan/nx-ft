// 面板壳：tab 导航 + 当前视图。**这个文件几乎不需要改**——
// 新增面板 = 在 registry.js 登记一行 + 写一个 view.jsx。
//
// 视图可带自己的子路由（如 #/svg/edit/ui/nav/search）：
// 这里只取 hash 首段判视图，剩余段落归视图自己解释（见 AssetView / SvgView 的路由解析），
// 因此同一 tab 内跳转（进工作台/返回）不会被壳重写掉。
//
// ---- 路由的真相只有一份：location.hash ----
//
// 早期这里是**双向互写**（hash 变了写 store、store 变了写 hash），第一次挂载时
// 「store → hash」那条 effect 会先于用户数据的到达执行，拿着默认值 'home'
// 把地址栏里的 `#/svg/edit/ui/nav/search` 覆盖成 `#/home`——分享出去的深链
// 一打开就跳首页。两个方向同时写的结构，必然有一方读到陈旧值。
//
// 现在：导航 = 改 hash；订阅 = 监听 hashchange 回填 store。没有第二个写入者，
// 也就没有竞态，而浏览器后退键天然可用（它就是 hash 变化）。
import { Suspense, useEffect, useRef } from 'react';
import { VIEWS } from './registry.js';
import { useStore } from './store.jsx';
import { ErrorBoundary } from './components/ui.jsx';

function viewFromHash() {
  const h = location.hash.replace(/^#\/?/, '');
  return h.split('/')[0] || '';
}

export default function App() {
  const { ui, patchUi, boot, refreshBoot } = useStore();
  const views = VIEWS;
  // 上次访问的视图（store 从 localStorage 恢复的），只在地址栏完全没有 hash 时用作兜底
  const fallbackRef = useRef(ui.view);

  // 窗口聚焦时刷新 bootstrap：别的终端改了状态，这里能看到。
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') refreshBoot().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refreshBoot]);

  // hash → store（唯一订阅点）。首帧先按深链同步，没有 hash 才退回上次访问的视图。
  useEffect(() => {
    const sync = () => patchUi({ view: viewFromHash() });
    if (location.hash) sync();
    else if (fallbackRef.current) location.hash = '#/' + fallbackRef.current;
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [patchUi]);

  const current = views.find((v) => v.id === ui.view) || views[0];
  const appName = boot?.app?.name || 'nx-ft';

  return (
    <>
      <header>
        <div className="brand">
          <img src="/logo-rounded.png" alt="" />
          {appName}
          <span className="sub">本机工具：CLI 与 Web 面板同源</span>
        </div>
        <nav>
          {/* 顶部 tab = 回到该面板的**根**路由，不把上一级页面的子路径带过去 */}
          {views.map((v) => (
            <button
              key={v.id}
              className={'tab' + (current && current.id === v.id ? ' active' : '')}
              onClick={() => {
                if (location.hash !== '#/' + v.id) location.hash = '#/' + v.id;
              }}
            >
              {v.title}
            </button>
          ))}
          {views.length === 0 && (
            <span className="muted" style={{ padding: '6px 12px' }}>
              暂无视图
            </span>
          )}
        </nav>
        <div className="meta">{boot ? `v${boot.app.version}` : ''}</div>
      </header>
      <main>
        {!current ? (
          <div className="empty">
            <p>
              还没有注册任何视图。在 <code>src/modules/&lt;域&gt;/view.jsx</code> 写一个，
              再在 <code>src/web/frontend/registry.js</code> 登记一行。
            </p>
          </div>
        ) : (
          <ErrorBoundary key={current.id}>
            <Suspense fallback={<div className="muted" style={{ padding: 24 }}>加载中…</div>}>
              <section className="panel active">
                <current.component />
              </section>
            </Suspense>
          </ErrorBoundary>
        )}
      </main>
    </>
  );
}
