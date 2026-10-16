// 管理页的「结果模式」视图：有搜索词或标签时，平铺显示命中的分组区块。
//
// 与 manage-browse.jsx 是同一页面的两个互斥分支。这里不显示目录树选中态，
// 因为「搜索」的语义是跨目录找东西，而不是「在某个目录里找」——
// 因此结果头必须把「全库」范围明示出来（方案B：保留跨目录语义 + UI 标注；
// 若日后拍板方案A「限当前目录」，本视图从主页面退场即可，组件保留）。
import { Btn, BtnBarSpacer } from '../btn/index.jsx';
import { AssetCard } from './parts.jsx';
import { byOrder } from './tree.jsx';

export function ManageResult({ tree, count, activeTags, toggleTag, onOpen, onClear, batchMode, selected, onToggle, kind = 'html' }) {
  return (
    <>
      <div className="am-crumbbar">
        {/* 「全库」必须明示：搜索的语义是跨目录的，与主页面「仅当前目录」的浏览口径不同
            （03 主页面任务的差距 #1）——结果头标注范围与来源目录数，不让跨目录无感发生。 */}
        <span className="am-sec-title">
          搜索结果 · 全库 {count.assets} 个资源 · 来自 {tree.groups.length} 个目录
          {activeTags.length ? '（' + activeTags.map((t) => '#' + t).join(' + ') + '）' : ''}
        </span>
        <BtnBarSpacer />
        <Btn size="sm" onClick={onClear}>清除筛选</Btn>
      </div>

      {!tree.groups.length ? (
        <div className="empty">没有匹配的资源（共 {tree.total.assets} 个）</div>
      ) : (
        // 分组与组内资源都按树序（byOrder）——搜索结果也跟随侧边栏的手动排序，
        // 不因为「换了视图」就回到 manifest 迭代序
        tree.groups.slice().sort(byOrder).map((g) => (
          <section key={g.path} className="am-group">
            <div className="am-group-head">
              <span className="am-group-name">{g.label}</span>
              <span className="mono muted am-group-path">{g.path}</span>
              <span className="tag">{g.assets.length} 资源</span>
            </div>
            <div className="am-cards">
              {g.assets.slice().sort(byOrder).map((a) => (
                <AssetCard
                  key={a.name}
                  asset={a}
                  groupPath={g.path}
                  activeTags={activeTags}
                  onOpen={onOpen}
                  onTagToggle={toggleTag}
                  selectable={batchMode}
                  selected={selected && selected.has(`${g.path}/${a.name}`)}
                  onToggle={onToggle}
                  kind={kind}
                  quickAction={kind === 'color' ? {
                    label: 'Studio',
                    title: '打开全屏 ColorStudio(色盘 / 比例 / 笔刷)',
                    onClick: () => {
                      location.hash = `#/color/edit/${encodeURIComponent(g.path)}/${encodeURIComponent(a.name)}/full`;
                    },
                  } : null}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </>
  );
}
