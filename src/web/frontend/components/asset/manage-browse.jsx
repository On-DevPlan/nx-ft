// 管理页「浏览模式」：网盘式当前目录视图。
// 子目录卡片 + 资源卡片。与 manage-result.jsx 是同一页面的两个互斥分支（有筛选条件走结果视图）。
//
// 创建入口不在本视图：资源 = 工具区的「+ 新建资源」（manage-bar.jsx），
// 文件夹 = 侧边栏的「+」（asset/side-tree.jsx，定稿：文件夹归侧边栏管）。
import { Btn } from '../btn/index.jsx';
import { AssetCard, SubdirCard } from './parts.jsx';

export function ManageBrowse({
  count, dir, dirNode, dirGroup, tree, kind = 'html',
  activeTags, toggleTag, onOpen, pickDir, removeGroup,
  batchMode, selected, onToggle, selectedDirs, onToggleDir,
  emptyState = null,
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
  // 资源取树节点的 direct（buildTree 已按 byOrder 排过），不直接吃 API 的
  // raw group.assets——那份是 manifest 迭代序，没跟随手动排序。
  // dirGroup 仍用于取 path（卡片路由）与空态判断。
  const assets = dirNode?.direct || [];
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
                selectedDirs={selectedDirs || new Set()}
                selected={selected || new Set()}
                onToggleDir={onToggleDir}
                onToggle={onToggle}
                tree={tree}
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
                kind={kind}
                quickAction={kind === 'color' ? {
                  label: 'Studio',
                  title: '打开全屏 ColorStudio(色盘 / 比例 / 笔刷)',
                  onClick: () => {
                    location.hash = `#/color/edit/${encodeURIComponent(dirGroup.path)}/${encodeURIComponent(a.name)}/full`;
                  },
                } : null}
              />
            ))}
          </div>
        </>
      ) : null}

      {empty ? (
        emptyState ? (
          <div className="empty empty-custom">{emptyState}</div>
        ) : (
          <div className="empty">
            {count.groups === 0 ? (
              <>还没有任何内容。点顶部的「+ 新建资源」开始；文件夹在左侧目录树的「+」里新建。</>
            ) : (
              <>此文件夹为空</>
            )}
          </div>
        )
      ) : null}
    </>
  );
}
