// 预览容器（唯一实现，html / svg 共用）：工具条 + 可缩放可平移的画布 + iframe。
//
// 为什么是 iframe：预览要跑用户自己写的 <script>，只有独立 document 隔离得住
// （样式污染、全局变量）。代价是 iframe 会把指针事件全吃掉——本文件一半的代码
// 在处理这件事（滚动/拖拽/分隔条三处，见下面各段注释）。
//
// 缩放是**整体 transform**，不是改 iframe 的逻辑尺寸：用户要的是「整个图形变大变小」。
// 改尺寸会让 html 预览按响应式重排（断点都变了），看到的是另一个页面，不是放大镜。
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Btn } from '../btn/index.jsx';
import { useView } from './useView.js';

// key 必须由「内容本身」派生——只用长度会让「换风格但长度恰好相同」时不重挂载，
// iframe 会继续渲染上一份代码（真实踩过：minimal 与 dark 的 CSS 长度相同）。
function docHash(doc) {
  const s = String(doc || '');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return s.length + '.' + (h >>> 0).toString(36);
}

export function PreviewPane({
  doc,
  kind = 'html',
  full = false,
  tick = 0,
  onToggleFull,
  title,
  // 视口:'pc'(默认,iframe 铺满预览区) | 'mobile'(iPhone 7/8/9 = 375×667,带外壳居中)。
  // 默认 pc 是刻意的——SVG 域的 detail.jsx 也调这个组件,不传就该维持原样。
  viewport = 'pc',
  // 给了才渲染「手机 / PC」切换按钮(调用方持有视口状态)。不给 = 视口固定,按钮不出现。
  onViewportChange,
}) {
  const { view, stageRef, zoomByWheel, zoomByInnerWheel, zoomStep, panBy, reset } = useView();
  // 抓手模式 = 画布模式：拖拽平移、滚轮缩放。
  //   svg 预览默认开——图形本来不需要交互，整块当画布用最顺手；
  //   html 预览默认关——「预览里能点、能滚」是第一需求，要平移得自己按一下抓手。
  const [grab, setGrab] = useState(kind === 'svg');
  const veilRef = useRef(null);
  const dragRef = useRef(null);
  // 手机视口:容器尺寸 → 375×667 的适配倍率。iframe 始终按真实手机尺寸渲染,
  // 只把整机按倍率缩放——这样预览里的响应式断点、字号、点击区都是手机的真值。
  const mobileWrapRef = useRef(null);
  const [fit, setFit] = useState(1);

  // 用 useLayoutEffect 而非 useEffect：首帧就量好倍率,避免「先按 100% 画出来、
  // 下一帧再缩回去」的可见跳变(容器通常略小于 375×667,这个跳变每次进页面都会闪一下)。
  useLayoutEffect(() => {
    if (viewport !== 'mobile') return undefined;
    const el = mobileWrapRef.current;
    if (!el) return undefined;
    const pad = 16; // 与 .pv-mobile-wrap 的 padding 一致
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return; // 还没布局(隐藏/首帧),等下一次回调
      setFit(Math.max(0.2, Math.min(1, (r.width - pad * 2) / 375, (r.height - pad * 2) / 667)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewport]);

  useEffect(() => {
    if (!full) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onToggleFull();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [full, onToggleFull]);

  // 滚轮必须用**原生**监听：React 的 onWheel 是挂在根节点上的 passive 监听，
  // 合成事件里调 preventDefault() 只会换来一句控制台警告，拦不住页面跟着滚。
  useEffect(() => {
    const el = veilRef.current;
    if (!el || !grab) return undefined;
    el.addEventListener('wheel', zoomByWheel, { passive: false });
    return () => el.removeEventListener('wheel', zoomByWheel);
  }, [grab, zoomByWheel]);

  // 平移：用 pointer 事件 + 指针捕获。捕获之后即使拖出遮罩（拖到编辑区、拖出窗口）
  // 也照样收得到 move / up，不会出现「松手了还在跟」的半截拖拽。
  const onDown = (e) => {
    dragRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    // 指针捕获：捕获之后即使拖出遮罩（拖到编辑区、拖出窗口）也照样收得到 move/up，
    // 不会出现「松手了还在跟」的半截拖拽。
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 合成事件的 pointerId 不是活跃指针，捕获会抛；退化成普通拖拽即可 */
    }
    e.preventDefault();
  };
  const onMove = (e) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    panBy(e.clientX - d.x, e.clientY - d.y);
    d.x = e.clientX;
    d.y = e.clientY;
  };
  const onUp = (e) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* 已经把指针丢了（pointercancel），没什么可释放的 */
    }
  };

  // 键盘替代（与 SplitPane 分隔条同一条硬标准：拖拽不能是唯一的调整方式，WCAG 2.2 AA）。
  // 抓手模式关着也能用——pointer-events 只管指针命中，拦不住键盘焦点。
  const onKeyDown = (e) => {
    const step = e.shiftKey ? 60 : 15;
    const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
    const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
    if (!dx && !dy) return;
    e.preventDefault();
    panBy(dx, dy);
  };

  // 挂进 iframe **内部**的监听。每次 doc 变化 iframe 都按 key 重挂载，
  // 监听跟着旧 document 一起回收，不用手动解绑。
  const onFrameLoad = useCallback(
    (e) => {
      const d = e.target.contentDocument;
      if (!d) return;
      // 预览里的链接点击不该把 iframe 导航走（会丢预览），直接拦住
      d.addEventListener('click', (ev) => {
        const a = ev.target.closest && ev.target.closest('a');
        if (a) ev.preventDefault();
      });
      // 滚轮落在 iframe 自己的 document 里，父窗口的监听**收不到**——iframe 是独立
      // 浏览上下文，事件不会冒泡上来。只有同源直挂内层才拿得到（srcDoc 继承父源）。
      // 内层只在按住 Ctrl/Cmd 时缩放，其余放行给页面自己滚。
      d.addEventListener(
        'wheel',
        (ev) => {
          if (!ev.ctrlKey && !ev.metaKey) return;
          ev.preventDefault();
          zoomByInnerWheel(ev);
        },
        { passive: false }
      );
    },
    [zoomByInnerWheel]
  );

  const pct = Math.round(view.k * 100);

  return (
    <div className={'pv' + (full ? ' pv-full' : '')} data-testid="pv">
      <div className="pv-head">
        <span className="pv-title">{title || (full ? '预览（全屏）' : '实时预览')}</span>
        <div className="pv-acts">
          {/* 设备视口:手机(iPhone 7/8/9, 375×667)/ PC(铺满)。只在调用方给了
              onViewportChange 时出现——SVG 详情页那边视口固定,不该看到这组按钮。 */}
          {onViewportChange ? (
            <div className="pv-viewport" role="group" aria-label="预览视口">
              <button
                className={'pv-vpbtn' + (viewport === 'mobile' ? ' on' : '')}
                onClick={() => onViewportChange('mobile')}
                aria-pressed={viewport === 'mobile'}
                title="手机视口：iPhone 7/8/9（375×667）"
                data-testid="pv-vp-mobile"
              >
                手机
              </button>
              <button
                className={'pv-vpbtn' + (viewport === 'pc' ? ' on' : '')}
                onClick={() => onViewportChange('pc')}
                aria-pressed={viewport === 'pc'}
                title="PC 视口：预览铺满整个预览区"
                data-testid="pv-vp-pc"
              >
                PC
              </button>
            </div>
          ) : null}
          <div className="pv-zoom">
            <button className="pv-zbtn" onClick={() => zoomStep(-1)} title="缩小" data-testid="pv-zoom-out">
              −
            </button>
            <button
              className="pv-zpct"
              onClick={reset}
              title="点一下回到 100%（预览填满容器）"
              data-testid="pv-zoom-pct"
            >
              {pct}%
            </button>
            <button className="pv-zbtn" onClick={() => zoomStep(1)} title="放大" data-testid="pv-zoom-in">
              +
            </button>
          </div>
          <Btn
            size="sm"
            variant="secondary"
            className={grab ? 'pv-on' : ''}
            onClick={() => setGrab((g) => !g)}
            aria-pressed={grab}
            testId="pv-grab"
            title={grab ? '抓手：拖动平移、滚轮缩放。点一下切回交互模式' : '交互：预览可点可滚。点一下切到抓手'}
          >
            {grab ? '抓手' : '交互'}
          </Btn>
          <Btn size="sm" variant="secondary" onClick={onToggleFull} testId="pv-full">
            {full ? '退出全屏 (Esc)' : '全屏展开'}
          </Btn>
        </div>
      </div>

      <div className="pv-stage" ref={stageRef}>
        {viewport === 'mobile' ? (
          // 手机外壳:固定 375×667 的真机尺寸画框,按容器自适应缩放(fit),再叠加抓手的缩放/平移。
          // 缩放走 transform,不改 iframe 的逻辑尺寸——改尺寸会让页面按响应式重排,看到的就不是手机了。
          <div className="pv-mobile-wrap" ref={mobileWrapRef}>
            <div
              className="pv-mobile-frame"
              style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${fit * view.k})` }}
            >
              <iframe
                key={docHash(doc) + ':' + tick}
                className="pv-frame pv-frame-mobile"
                title="预览（手机 375×667）"
                // 不设 sandbox：预览内容是用户自己写的本机资源，脚本就该正常跑
                // （sandbox 无 allow-same-origin 时 alert 会被静默拦截，也读不到内容做断言）
                srcDoc={doc}
                onLoad={onFrameLoad}
              />
            </div>
          </div>
        ) : (
          <div
            className="pv-canvas"
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
          >
            <iframe
              key={docHash(doc) + ':' + tick}
              className="pv-frame"
              title="预览"
              // 不设 sandbox：预览内容是用户自己写的本机资源，脚本就该正常跑
              // （sandbox 无 allow-same-origin 时 alert 会被静默拦截，也读不到内容做断言）
              srcDoc={doc}
              onLoad={onFrameLoad}
            />
          </div>
        )}

        {/* 指针遮罩：盖在 iframe 上，接管拖拽与滚轮。两件事共用一层：
            1) 抓手模式下常开（.grab）——否则 iframe 把指针全吃掉，拖不动；
            2) 平时 pointer-events:none 放行给预览，只在分隔条拖拽期间由
               body.sp-dragging 临时打开。不打开的话，指针一移进预览区，
               SplitPane 挂在 window 上的 mousemove/mouseup 就全断了，
               分隔条会「粘住」——松手还在跟着走。详见 styles/preview.css。 */}
        <div
          ref={veilRef}
          className={'pv-veil' + (grab ? ' grab' : '')}
          data-testid="pv-veil"
          tabIndex={0}
          role="application"
          aria-label="预览画布：方向键平移（Shift 加速），滚轮缩放，双击复位"
          onPointerDown={grab ? onDown : undefined}
          onPointerMove={grab ? onMove : undefined}
          onPointerUp={grab ? onUp : undefined}
          onPointerCancel={grab ? onUp : undefined}
          onKeyDown={onKeyDown}
          onDoubleClick={grab ? reset : undefined}
        />
      </div>
    </div>
  );
}
