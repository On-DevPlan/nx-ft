// 管理页的「浏览模式」视图：当前目录的面包屑 + 子目录卡片 + 本目录资源卡片。
//
// 与 manage-result.jsx 是同一页面的两个互斥分支（有筛选条件走结果视图，否则走这里）。
// 从 manage.jsx 拆出来只是因为那一支 JSX 太长——拆完两边都只剩一屏能读完。
import { AssetCard, Crumbs, SubdirCard } from './parts.jsx';

export function ManageBrowse({
  tree, count, dir, dirNode, dirGroup, crumbItems,
  activeTags, toggleTag, onOpen, pickDir, removeGroup, addGroup, addAsset,
  batchMode, selected, onToggle,
}) {
  if (dir && !dirNode) {
    return (
      <div className="empty">
        目录不存在或已删除
        <p className="muted">
          <button className="btn small" onClick={() => pickDir('')}>回到全部</button>
        </p>
      </div>
    );
  }

  const subdirs = dirNode?.children || [];
  const assets = dirGroup?.assets || [];
  const empty = !subdirs.length && !assets.length;

  return (
    <>
      <div className="am-crumbbar">
        <Crumbs items={crumbItems} />
        <div className="am-spacer" />
        {dir && dirGroup ? (
          <button className="btn small ghost" onClick={() => removeGroup(dir)}>删除当前分组</button>
        ) : null}
      </div>

      {subdirs.length ? (
        <>
          <div className="am-sec-title">子目录</div>
          <div className="am-subdirs">
            {subdirs.map((c) => (
              <SubdirCard key={c.path} node={c} onSelect={pickDir} onRemove={(p) => removeGroup(p)} />
            ))}
          </div>
        </>
      ) : null}

      {assets.length ? (
        <>
          <div className="am-sec-title">资源</div>
          <div className="am-cards">
            {assets.map((a) => (
              <AssetCard
                key={a.name}
                asset={a}
                groupPath={dirGroup.path}
                activeTags={activeTags}
                onOpen={onOpen}
                onTagToggle={toggleTag}
                selectable={batchMode}
                selected={selected && selected.has(`${dirGroup.path}/${a.name}`)}
                onToggle={onToggle}
              />
            ))}
          </div>
        </>
      ) : null}

      {empty ? (
        <div className="empty">
          {count.groups === 0 ? (
            <>
              还没有任何资源。先{' '}
              <button className="btn small" onClick={() => addGroup()}>新建分组</button>
              {' '}再{' '}
              <button className="btn small" onClick={() => addAsset()}>新建资源</button>
              <p className="muted">存储位置: <span className="mono">{tree.root}</span></p>
            </>
          ) : (
            <>
              此目录为空
              <p className="muted">
                <button className="btn small" onClick={() => addAsset()}>在此新建资源</button>
                {' '}
                <button className="btn small" onClick={() => addGroup()}>新建子分组</button>
              </p>
            </>
          )}
        </div>
      ) : null}
    </>
  );
}
