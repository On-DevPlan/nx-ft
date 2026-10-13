// 管理页的「结果模式」视图：有搜索词或标签时，平铺显示命中的分组区块。
//
// 与 manage-browse.jsx 是同一页面的两个互斥分支。这里不显示目录树选中态，
// 因为「搜索」的语义是跨目录找东西，而不是「在某个目录里找」。
import { AssetCard } from './parts.jsx';

export function ManageResult({ tree, count, activeTags, toggleTag, onOpen, onClear }) {
  return (
    <>
      <div className="am-crumbbar">
        <span className="am-sec-title">
          搜索结果 · {count.assets} 个资源
          {activeTags.length ? '（' + activeTags.map((t) => '#' + t).join(' + ') + '）' : ''}
        </span>
        <div className="am-spacer" />
        <button className="btn small ghost" onClick={onClear}>清除筛选</button>
      </div>

      {!tree.groups.length ? (
        <div className="empty">没有匹配的资源（共 {tree.total.assets} 个）</div>
      ) : (
        tree.groups.map((g) => (
          <section key={g.path} className="am-group">
            <div className="am-group-head">
              <span className="am-group-name">{g.label}</span>
              <span className="mono muted am-group-path">{g.path}</span>
              <span className="tag">{g.assets.length} 资源</span>
            </div>
            <div className="am-cards">
              {g.assets.map((a) => (
                <AssetCard
                  key={a.name}
                  asset={a}
                  groupPath={g.path}
                  activeTags={activeTags}
                  onOpen={onOpen}
                  onTagToggle={toggleTag}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </>
  );
}
