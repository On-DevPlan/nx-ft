// 侧边栏头部：搜索框 + 「+ 新建目录」+ 折叠把手。
//
// 抽出来是为了给 index.jsx 留行数余量（300 行闸门）。这里只管画与转发，
// 状态（关键词、是否在创建、是否折叠）仍由 Sidebar 持有——它要拿关键词去过滤树，
// fold 是整条侧边栏的全局状态。
import { Chevron, CrossGlyph, PlusGlyph, SearchGlyph } from './icons.jsx';

export function SidebarHead({
  placeholder, kw, onKw,
  creating, onToggleCreate, createLabel = '新建文件夹',
  onCollapseToggle, folded,
}) {
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
          title={createLabel}
          aria-label={createLabel}
          aria-pressed={!!creating}
          data-testid="gside-new-dir"
          onClick={onToggleCreate}
        >
          <PlusGlyph />
        </button>
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
