// 统一按钮族：主按钮 / 次级按钮 / 两者的下拉版，外加承载它们的动作行。
//
// 为什么要有它：同一个 .btn 在这套面板里被手写成了十几种组合
// （`btn small ghost`、`btn small primary`、`btn danger ghost`…），差异只落在
// 「主次」和「尺寸」两件事上，但每个调用点都得自己记全。这里把这两件事收敛成
// variant / size 两个词，类名的拼装只此一处（btnClass），改口径不用翻每个调用点。
//
// 三条全局规矩：
//   1. 一个页面只有一个主按钮 —— .primary 是全页唯一允许的实心色块；
//   2. 主按钮永远在最右 —— 由 `.btn-bar > .btn.primary { margin-left: auto }` 保证，
//      调用方把它写在中间也落在行尾（顺序由 CSS 兜住，不靠人记）；
//   3. 工具区从左到右：次级按钮 → 次级下拉 → 主按钮。
//   BtnBar 会在渲染时按 rules.js 检查自己这一行（多于一个主按钮 / 主按钮没放最后
//   就 console.warn）。跨行的「一个页面一个」组件看不出来，靠这个 warn + 视觉走查。
//
// 与壳的关系：只认 .btn / .btn-menu* 这些自己的类名，不认路由、不认 store，
// 也不碰 .shell-menu*（layout.css 那组旧实现已退役：调用点全部迁到本组件）。
//
// 工具区的标准写法（等价于今天 manage-bar 的那一条，只是主按钮压到了最右）：
//
//   <BtnBar>
//     <Crumbs items={crumbs} />
//     <BtnBarSpacer />
//     <input className="am-search" value={search} onChange={…} />
//     <BtnMenu label="更多" testId="more-menu">            {/* 次级下拉 */}
//       <BtnMenuLabel>视图</BtnMenuLabel>
//       <BtnMenuItem current onClick={…}>编辑</BtnMenuItem>
//       <BtnMenuItem onClick={…}>画廊</BtnMenuItem>
//       <BtnMenuSep />
//       <BtnMenuLabel>目录</BtnMenuLabel>
//       <BtnMenuItem danger onClick={…} testId="remove-current-group">删除当前文件夹</BtnMenuItem>
//     </BtnMenu>
//     <Btn onClick={…} testId="export-zip">导出 zip</Btn>  {/* 次级按钮：variant 默认就是次级 */}
//     <BtnMenu label="+ 新建" variant="primary" align="left" testId="new-menu">
//       <BtnMenuItem onClick={…} testId="new-asset">新建资源</BtnMenuItem>
//       <BtnMenuItem onClick={…} testId="new-dir">新建子目录</BtnMenuItem>
//     </BtnMenu>                                           {/* 主按钮（下拉版）：全行最右 */}
//   </BtnBar>
import { Children, createContext, useContext, useEffect, useRef } from 'react';
import { primaryIssues } from './rules.js';

// 尺寸走 context：工具区整条都是 22px 的小按钮，逐个写在调用点上纯属重复。
// BtnBar 默认把这一行设为 small，单个按钮要用大号就自己传 size。
// default 是 md（32px）——与 atomic.css 的 .btn 默认一致，脱离工具区时不会突然变小。
const SizeCtx = createContext('md');

// 主次 / 尺寸 → 类名。只在 bundle 内使用。
//
// variant 只认三个值：
//   primary    主操作，全页唯一（.primary 是唯一允许的实心绿）
//   secondary  次级操作 = ghost（工具区里所有非主操作都是这个：无底色，hover 才浮起）
//   danger     破坏性操作（红描边）。放进下拉面板时面板会把描边抹掉，只剩红字，
//              与参照实现里的 `btn ghost danger` 落到同一个像素。
// 白底描边的普通按钮（画廊卡片那类）不在按钮族的语义里，用 className 透传 `.btn`。
function btnClass(variant, size, className) {
  const v = variant === 'primary' ? ' primary' : variant === 'danger' ? ' danger' : ' ghost';
  const s = size === 'md' ? '' : ' small';
  return 'btn' + s + v + (className ? ' ' + className : '');
}

// ---- 单个按钮 ----
//
// busy：异步动作进行中（导入 / 导出 / 保存）。置 disabled + aria-busy，文案由调用方
// 自己换（「导出中…」）——组件不猜文案，也不放转圈图标（本骨架无图标、无动效装饰）。
export function Btn({
  variant = 'secondary',
  size,
  icon = null,
  busy = false,
  disabled = false,
  testId,
  className = '',
  children,
  ...rest
}) {
  const ctxSize = useContext(SizeCtx);
  return (
    <button
      type="button"
      className={btnClass(variant, size || ctxSize, className)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      data-testid={testId}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

// ---- 下拉按钮 ----
//
// 用原生 <details> 而不是受控 state：不点就是不开，键盘 / 无障碍免费拿到，
// 且不需要为了「开没开」在两个组件间同步状态。
//
// align：面板贴哪一边。默认 right（按钮在行尾时面板向左展开，不会飘出容器）；
// 靠左的按钮（如「+ 新建」在左侧时）传 left。
export function BtnMenu({
  label,
  variant = 'secondary',
  size,
  align = 'right',
  closeOnOutside = true,
  testId,
  panelTestId,
  title,
  className = '',
  children,
}) {
  const ctxSize = useContext(SizeCtx);
  const ref = useRef(null);

  // 原生 <details> 只在「再点一次 summary」时收起，点别处会一直挂着占位。
  // 这里补上点击外部与 Esc 收起（参照实现只有「点菜单项收起」这一条）。Esc 之后把
  // 焦点还给 summary——否则键盘用户关掉菜单就丢失了位置。
  useEffect(() => {
    const el = ref.current;
    if (!el || !closeOnOutside) return undefined;
    const close = () => { el.open = false; };
    const onDown = (e) => { if (el.open && !el.contains(e.target)) close(); };
    const onKey = (e) => {
      if (e.key !== 'Escape' || !el.open) return;
      close();
      el.querySelector('summary')?.focus();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [closeOnOutside]);

  // 点面板里任意一项就收起：菜单里全是「做完即走」型动作，留着菜单只会挡住下一个操作。
  // 挂在面板上而不是逐项挂，是为了让调用方自己塞进来的原始 <button> 也享受同一条。
  const onClickPanel = (e) => {
    if (e.target.closest('button')) e.currentTarget.closest('details').removeAttribute('open');
  };

  return (
    <details className={'btn-menu' + (variant === 'primary' ? ' is-primary' : '')} ref={ref}>
      <summary className={btnClass(variant, size || ctxSize, className)} title={title} data-testid={testId}>
        {label}
        <span className="btn-chev" aria-hidden="true">▾</span>
      </summary>
      <div
        className={'btn-menu-panel' + (align === 'left' ? ' from-left' : '')}
        data-testid={panelTestId}
        onClick={onClickPanel}
      >
        {children}
      </div>
    </details>
  );
}

// ---- 下拉面板里的零件 ----
//
// 面板项的尺寸 / 字号由 .btn-menu-panel .btn 统一成 28px / 11px（不管外层是哪个
// 尺寸上下文），所以这里不接 size——菜单项的行高是面板的事，不是按钮的事。

// current：该项是当前生效的那个（视图 / 分组）。用「加粗 + 右侧『当前』」标注，
// 不用实心绿——面板里是一堆同级项，颜色喊出来的「选中」会去抢主操作的位置。
export function BtnMenuItem({ current = false, danger = false, testId, className = '', children, ...rest }) {
  return (
    <Btn
      variant={danger ? 'danger' : 'secondary'}
      className={(current ? 'on' : '') + (className ? ' ' + className : '')}
      testId={testId}
      {...rest}
    >
      {children}
      {current ? <span className="btn-menu-now">当前</span> : null}
    </Btn>
  );
}

// 分组标签（「视图」「批量」「目录」）
export function BtnMenuLabel({ children }) {
  return <span className="btn-menu-lbl">{children}</span>;
}

// 分组之间的分隔线
export function BtnMenuSep() {
  return <hr />;
}

// 把一整块外部节点（比如某个域传进来的批量动作）摊平进面板列：
// display: contents 让容器在布局上不存在，域代码无需知道自己在菜单里。
export function BtnMenuGroup({ children }) {
  return <div className="btn-menu-group">{children}</div>;
}

// ---- 动作行 ----
//
// 只做两件事：横向排布（flex + 8px gap）、把主按钮顶到最右（CSS）。
// 行内可以放任意节点（面包屑、搜索框、分隔撑杆），不只是按钮——真实工具区就是
// 面包屑 + 撑杆 + 搜索 + 按钮混着排的。
//
// 为什么 flex: 1：整行只有它一个孩子时（工具区只有按钮），它必须撑满，
// 主按钮才真的落在容器最右而不是紧跟在内容后面。
export function BtnBar({ size = 'sm', testId = 'btn-bar', className = '', children }) {
  // Children.toArray 先展平数组 / Fragment、滤掉 null：调用方写成条件渲染
  // （`{inDir ? <BtnMenuItem …/> : null}`）时不至于把规矩判错。
  const issues = primaryIssues(Children.toArray(children));
  const key = issues.join('|');
  // 依赖用拼好的 key 而不是 issues 数组本身：数组每次渲染都是新的，直接当依赖会
  // 每渲染一次报一次；key 只在问题集合真的变了的时候才变，同一批问题只报一次。
  useEffect(() => {
    for (const issue of issues) console.warn('[nx-ft] 按钮行不合规：' + issue);
  }, [key]);

  return (
    <div className={'btn-bar' + (className ? ' ' + className : '')} data-testid={testId}>
      <SizeCtx.Provider value={size}>{children}</SizeCtx.Provider>
    </div>
  );
}

// 撑杆：把左右两组内容顶开
export function BtnBarSpacer() {
  return <span className="btn-bar-spacer" />;
}
