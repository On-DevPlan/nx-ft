// 管理页工具区（V3 主从收纳）：按模块表（layout）渲染工具栏子元素。
// 模块表在父级 useToolbarLayout hook 里持久化到 localStorage；
// 本组件按 layout 数组的次序逐个渲染可见的次级模块（+ 新建恒末位）。
//
// 顺序规则：
//   1) inline-create（创建中状态）作为最左孩子（醒目）
//   2) layout 数组里 section=top 的可见项，按数组次序渲染
//   3) 主按钮 + 新建 恒末位（panel 与 move() 双重兜底，bar 渲染也独立按「非主」/「主」两段拆开）
//   4) 「自定义工具栏…」 入口 = 更多菜单底部一项
//
// 入口：ManagePage 组装、ShellBar 传送进 Layout 的工具区；本组件只管排布与
// 输入行开合，创建本身交给 onCreateAsset / onCreateDir。
import { Fragment, useState } from 'react';
import { Btn, BtnBar, BtnBarSpacer, BtnMenu, BtnMenuItem, BtnMenuLabel, BtnMenuSep } from '../btn/index.jsx';
import { Crumbs, InlineCreateRow } from './parts.jsx';
import { ToolbarLayoutPanel } from './toolbar-layout-panel.jsx';
import { effZoneOf, isMenuItemId } from './toolbar-modules.js';

// 没有 layout（未启用编排）时按这个默认次序渲染（只含原生工具栏项）。
// export/import 现在是「更多」菜单项（section more-batch），不再列在这里。
const DEFAULT_ORDER = ['crumbs', 'search', 'more'];

export function ManageBar({
  crumbs,
  inDir,
  onRenameDir,
  onRemoveDir,
  onCreateAsset,
  onCreateDir,
  search,
  onSearch,
  searchPlaceholder = '搜索名称 / 分组 / 标签 / 风格',
  viewId,
  onView,
  defaultViewLabel,
  views,
  onBatch,
  extra,
  // 1.1 可编排：layout 来自 useToolbarLayout，setLayout 用于面板保存；
  // exportBtn / importBtn 是父级预渲染的 AssetZipIoBtns(side=export|import) 节点。
  // 任一可选 prop 缺失 → 退化到老行为（全部默认可见，无编排入口）。
  layout = null,
  setLayout = null,
  exportBtn = null,
  importBtn = null,
}) {
  const [creating, setCreating] = useState(null); // null | 'asset' | 'dir'
  const [panelOpen, setPanelOpen] = useState(false);

  // 旧调用方（没传 layout）→ 走默认全可见（visible 缺省视为 true）
  const isVisible = (id) => {
    if (!layout) return true;
    const m = layout.find((x) => x.id === id);
    return m ? m.visible !== false : true;
  };

  // 计算 bar 的渲染次序：未启用编排时用默认序，启用时按 layout 数组原序。
  // 原生项 + 开了快捷显示的菜单项混排在同一 zone 序列里（快捷项 zone 缺省 right）。
  const ordered = (layout && layout.length
    ? layout.filter((x) => !isMenuItemId(x.id) || x.quick)
    : DEFAULT_ORDER.map((id) => ({ id, visible: true })));
  const nonPrimary = ordered.filter((x) => x.id !== 'new');

  // 区域：layout 项可带 zone 覆盖模块表默认；缺省按注册表（判定在 toolbar-modules.js，
  // 与面板共用同一份——面板怎么编，栏就怎么渲）。
  // 是否上工具栏：原生项看 visible；菜单项看 quick（两个开关相互独立）
  const onBar = (x) => (isMenuItemId(x.id) ? !!x.quick : isVisible(x.id));
  const barList = nonPrimary.filter(onBar);
  const leftItems = barList.filter((x) => effZoneOf(x) === 'left');
  const rightItems = barList.filter((x) => effZoneOf(x) === 'right');

  // 「更多」菜单成员判定：visible 开启 + 未快捷显示（quick 项已上工具栏，菜单里不重复）
  const inMenu = (id) => {
    const item = layout ? layout.find((x) => x.id === id) : null;
    if (!item) return true;
    if (item.visible === false) return false;
    if (item.quick) return false;
    return true;
  };

  // 按 id 渲染单个 bar 模块（含从「更多」提升上来的项）。主按钮由后面的代码独立渲染。
  const renderBarModule = (id) => {
    if (id === 'crumbs') return <Crumbs key="crumbs" items={crumbs} />;
    if (id === 'search') return (
      <input
        key="search"
        className="am-search"
        spellCheck="false"
        placeholder={searchPlaceholder}
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        data-testid="manage-search"
      />
    );
    if (id === 'more') return (
      <BtnMenu key="more" label="更多" testId="more-menu" panelTestId="more-menu-panel">
        {views.length && inMenu('views') ? (
          <>
            <BtnMenuLabel>视图</BtnMenuLabel>
            <BtnMenuItem current={viewId === 'default'} onClick={() => onView('default')} testId="view-default">
              {defaultViewLabel}
            </BtnMenuItem>
            {views.map((v) => (
              <BtnMenuItem
                key={v.id}
                current={viewId === v.id}
                onClick={() => onView(v.id)}
                testId={`view-${v.id}`}
              >
                {v.label}
              </BtnMenuItem>
            ))}
            <BtnMenuSep />
          </>
        ) : null}
        {((extra && inMenu('more-batch-extra')) || inMenu('export') || inMenu('import')) ? (
          <>
            <BtnMenuLabel>批量</BtnMenuLabel>
            {extra && inMenu('more-batch-extra') ? extra : null}
            {inMenu('export') && exportBtn ? <Fragment key="export-menu">{exportBtn}</Fragment> : null}
            {inMenu('import') && importBtn ? <Fragment key="import-menu">{importBtn}</Fragment> : null}
            <BtnMenuSep />
          </>
        ) : null}
        {(inMenu('more-batch') || (inDir && (inMenu('more-rename') || inMenu('more-remove')))) ? (
          <>
            <BtnMenuLabel>目录</BtnMenuLabel>
            {inMenu('more-batch') && onBatch ? (
              <BtnMenuItem onClick={onBatch} testId="enter-batch" disabled={!onBatch}>
                批量操作
              </BtnMenuItem>
            ) : null}
            {inDir && inMenu('more-rename') ? (
              <BtnMenuItem onClick={onRenameDir} testId="rename-current-group">
                改名 / 移动
              </BtnMenuItem>
            ) : null}
            {inDir && inMenu('more-remove') ? (
              <BtnMenuItem danger onClick={onRemoveDir} testId="remove-current-group">
                删除当前文件夹
              </BtnMenuItem>
            ) : null}
            <BtnMenuSep />
          </>
        ) : null}
        {setLayout ? (
          <BtnMenuItem onClick={() => setPanelOpen(true)} testId="customize-toolbar">
            自定义工具栏…
          </BtnMenuItem>
        ) : null}
      </BtnMenu>
    );
    if (id === 'export') return <Fragment key="export">{exportBtn}</Fragment>;
    if (id === 'import') return <Fragment key="import">{importBtn}</Fragment>;
    // —— 从「更多」提升上来的快捷按钮 ——
    if (id === 'views') {
      // 视图单选下拉：label 显示当前视图；当前项标「当前」。无可切换视图时不渲染。
      if (!views.length) return null;
      const cur = views.find((v) => v.id === viewId);
      return (
        <BtnMenu key={id} label={cur ? cur.label : defaultViewLabel} testId="bar-views" panelTestId="bar-views-panel">
          <BtnMenuItem current={viewId === 'default'} onClick={() => onView('default')} testId="bar-view-default">
            {defaultViewLabel}
          </BtnMenuItem>
          {views.map((v) => (
            <BtnMenuItem key={v.id} current={viewId === v.id} onClick={() => onView(v.id)} testId={`bar-view-${v.id}`}>
              {v.label}
            </BtnMenuItem>
          ))}
        </BtnMenu>
      );
    }
    if (id === 'more-batch-extra') return extra ? <Fragment key={id}>{extra}</Fragment> : null;
    if (id === 'more-batch') return onBatch ? (
      <Btn key={id} variant="secondary" onClick={onBatch} testId="enter-batch-bar">批量操作</Btn>
    ) : null;
    if (id === 'more-rename') return inDir ? (
      <Btn key={id} variant="secondary" onClick={onRenameDir} testId="bar-rename-group">改名 / 移动</Btn>
    ) : null;
    if (id === 'more-remove') return inDir ? (
      <Btn key={id} variant="danger" onClick={onRemoveDir} testId="bar-remove-group">删除当前文件夹</Btn>
    ) : null;
    return null;
  };

  return (
    <>
      <BtnBar>
        {/* 1) 创建中态：最左（醒目），独立于 layout */}
        {creating ? (
          <InlineCreateRow
            placeholder={
              creating === 'dir' ? '子目录名称，可用 / 建多层，如 ui/buttons' : '资源名称，如 login-btn'
            }
            confirmText={creating === 'dir' ? '创建目录' : '创建'}
            onConfirm={async (name) => {
              await (creating === 'dir' ? onCreateDir : onCreateAsset)(name);
              setCreating(null);
            }}
            onCancel={() => setCreating(null)}
            testId={creating === 'dir' ? 'inline-create-dir' : 'inline-create-asset'}
          />
        ) : null}
        {/* 2) 左区（导航类）→ 撑杆 → 右区（动作类），原生项与快捷项按 layout 次序混排 */}
        {leftItems.map((item) => renderBarModule(item.id))}
        <BtnBarSpacer />
        {rightItems.map((item) => renderBarModule(item.id))}
        {/* 3) 主按钮恒末位（panel + move 双重护栏） */}
        {isVisible('new') ? (
          <BtnMenu
            key="new"
            label="+ 新建"
            variant="primary"
            align="left"
            testId="new-menu"
            panelTestId="new-menu-panel"
          >
            <BtnMenuItem onClick={() => setCreating('asset')} testId="new-asset">
              新建资源
            </BtnMenuItem>
            <BtnMenuItem onClick={() => setCreating('dir')} testId="new-dir">
              新建子目录
            </BtnMenuItem>
          </BtnMenu>
        ) : null}
      </BtnBar>
      {panelOpen && setLayout ? (
        <ToolbarLayoutPanel
          layout={layout}
          setLayout={setLayout}
          onClose={() => setPanelOpen(false)}
        />
      ) : null}
    </>
  );
}
