// 管理页「浏览模式」：网盘式当前目录视图。
// 子目录卡片 + 资源卡片。与 manage-result.jsx 是同一页面的两个互斥分支（有筛选条件走结果视图）。
//
// 创建入口不在本视图：资源 = 工具区的「+ 新建资源」（manage-bar.jsx），
// 文件夹 = 侧边栏的「+」（asset/side-tree.jsx，定稿：文件夹归侧边栏管）。
import { Btn } from '../btn/index.jsx';
import { AssetCard, SubdirCard } from './parts.jsx';

export function ManageBrowse({
  count, dir, dirNode, dirGroup,
  activeTags, toggleTag, onOpen, pickDir, removeGroup,
  batchMode, selected, onToggle, selectedDirs, onToggleDir,
}) {
  if (dir && !dirNode) {
    return (
      <div className="empty">
        目录不存在或已删除
        <p className="muted">
          <Btn size="sm" onClick={() => pickDir('')}>回到全部</Btn>
        </p>
      </div>
    );
  }

  const subdirs = dirNode?.children || [];
  const assets = dirGroup?.assets || [];
  const empty = !subdirs.length && !assets.length;

  return (
    <>
      {subdirs.length ? (
        <>
          <div className="am-sec-title">文件夹</div>
          <div className="am-subdirs">
            {subdirs.map((c) => (
              <SubdirCard
                key={c.path}
                node={c}
                onSelect={pickDir}
                onRemove={(p) => removeGroup(p)}
                selectable={batchMode}
                selected={selectedDirs && selectedDirs.has(c.path)}
                onToggle={onToggleDir}
              />
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
              还没有任何内容。点顶部的「+ 新建资源」开始；文件夹在左侧目录树的「+」里新建。
            </>
          ) : (
            <>此文件夹为空</>
          )}
        </div>
      ) : null}
    </>
  );
}
