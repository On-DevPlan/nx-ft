// 侧边栏头部：搜索框 + 「+ 新建目录」+ 设置（双开关）+ 折叠把手。
//
// 抽出来是为了给 index.jsx 留行数余量（300 行闸门）。这里只管画与转发，
// 状态（关键词、是否在创建、是否折叠、两条默认开关）仍由 Sidebar 持有。
// 设置气泡只改「下次进入」的初值策略——
//   文件夹默认收起：每次进入的初始展开态 = 空集（选中链 effect 兜底，
//     仍然显示深链所在的目录，方便用户从深链直达；其他不自动展开）。
//   侧边栏默认收起：每次进入的初始 folded = true（已选过关闭后保存会重置）。
import { useEffect, useRef, useState } from 'react';
import { Chevron, CrossGlyph, GearGlyph, PlusGlyph, SearchGlyph } from './icons.jsx';

// 紧凑型设置气泡：两条勾选项，无说明文字——面板是「黑白灰 + --bad 一个语义色」，
// 设的语义由勾选本身表达，不另起小字解释。点气泡外关，齿轮按钮本身负责开/关切换。
// 用 span 画勾选框而不是 <input type=checkbox>：native 即便 appearance:none 也常
// 在 12px 这种小尺寸下被浏览器塞进 padding/font metrics 渲染成非正方（实测高度多出
// 几像素）；自己画完全 token 驱动，12×12 严格正方。
function SettingsPop({ defaultFolders, defaultSidebar, onFolders, onSidebar, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDown = (e) => {
      if (!ref.current?.contains(e.target) && !e.target.closest?.('.gcfg')) onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);
  return (
    <div className="gcfg-pop" ref={ref} role="dialog" aria-label="侧边栏设置">
      <div className="gcfg-row" onClick={() => onFolders(!defaultFolders)}>
        <span
          className={'gcfg-cb' + (defaultFolders ? ' on' : '')}
          role="checkbox"
          aria-checked={defaultFolders}
          tabIndex={-1}
        />
        文件夹默认收起
      </div>
      <div className="gcfg-row" onClick={() => onSidebar(!defaultSidebar)}>
        <span
          className={'gcfg-cb' + (defaultSidebar ? ' on' : '')}
          role="checkbox"
          aria-checked={defaultSidebar}
          tabIndex={-1}
        />
        侧边栏默认收起
      </div>
    </div>
  );
}

export function SidebarHead({
  placeholder, kw, onKw,
  creating, onToggleCreate, createLabel = '新建文件夹',
  onCollapseToggle, folded,
  defaultFolders, onDefaultFolders,
  defaultSidebar, onDefaultSidebar,
}) {
  const [cfgOpen, setCfgOpen] = useState(false);
  const anyOn = defaultFolders || defaultSidebar;
  return (
    <div className="gside-head">
      <label className="gside-search">
        <span className="gsearch-ico">
          <SearchGlyph />
        </span>
        <input
          type="text"
          value={kw}
          placeholder={placeholder}
          aria-label={placeholder}
          autoComplete="off"
          spellCheck={false}
          data-testid="gside-search"
          onChange={(e) => onKw(e.target.value)}
        />
        {kw ? (
          <button className="gsearch-clr" aria-label="清除搜索" tabIndex={-1} onClick={() => onKw('')}>
            <CrossGlyph />
          </button>
        ) : null}
      </label>
      {onToggleCreate ? (
        <button
          className="gicon-btn"
          title="新建文件夹"
          aria-label={createLabel}
          aria-pressed={!!creating}
          data-testid="gside-new-dir"
          onClick={onToggleCreate}
        >
          <PlusGlyph />
        </button>
      ) : null}
      {onDefaultFolders && onDefaultSidebar ? (
        <span className="gcfg">
          <button
            className={'gicon-btn' + (anyOn ? ' active' : '')}
            title="侧边栏设置"
            aria-label="侧边栏设置"
            aria-expanded={cfgOpen}
            data-testid="gside-settings"
            onClick={() => setCfgOpen((v) => !v)}
          >
            <GearGlyph />
          </button>
          {cfgOpen ? (
            <SettingsPop
              defaultFolders={defaultFolders}
              defaultSidebar={defaultSidebar}
              onFolders={onDefaultFolders}
              onSidebar={onDefaultSidebar}
              onClose={() => setCfgOpen(false)}
            />
          ) : null}
        </span>
      ) : null}
      {onCollapseToggle ? (
        <button
          className="gside-collapse"
          // 真正可点的按钮——之前的 ::after 伪元素在父级 .gside 上，但折叠
          // 回调现在挂在 head 侧，伪元素收不到事件；改成真按钮后点击直达
          // onCollapseToggle，键盘也能聚焦（伪元素做不到）。
          // 视觉位置由 CSS 绝对定位到侧边栏顶部（.gside-collapse，不归 head 框管）
          type="button"
          aria-label={folded ? '展开侧边栏' : '收起侧边栏'}
          title={folded ? '展开侧边栏' : '收起侧边栏'}
          data-testid="gside-collapse"
          onClick={onCollapseToggle}
        >
          {/* 与原 ::after 同义：展开态 ‹（点它收起）/ 折叠态 ›（点它展开） */}
          <Chevron flip={!folded} />
        </button>
      ) : null}
    </div>
  );
}
