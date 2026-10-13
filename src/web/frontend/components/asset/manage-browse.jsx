// 管理页「浏览模式」：网盘式当前目录视图。
// 地址栏（面包屑）+ 工具行（内联新建）+ 子目录卡片 + 资源卡片。
// 与 manage-result.jsx 是同一页面的两个互斥分支（有筛选条件走结果视图）。
import { useState } from 'react';
import { AssetCard, Crumbs, InlineCreateRow, SubdirCard } from './parts.jsx';

export function ManageBrowse({
  count, dir, dirNode, dirGroup, crumbItems,
  activeTags, toggleTag, onOpen, pickDir, removeGroup, renameGroup,
  createGroup, createAsset, guard,
  batchMode, selected, onToggle, selectedDirs, onToggleDir,
}) {
  const [creating, setCreating] = useState(null); // null | 'dir' | 'asset'

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

  // 根目录不禁止建资源：自动落进保留文件夹「未分类」（不存在则顺手建）——
  // 网盘的根目录也能放文件，只是这个存储模型要求资源必须住在某个文件夹里。
  const HOME_DIR = '未分类';
  const submitDir = (name) =>
    guard(async () => {
      await createGroup(dir, name);
      setCreating(null);
    });
  const submitAsset = (name) =>
    guard(async () => {
      if (!dir) await createGroup('', HOME_DIR);
      await createAsset(dir || HOME_DIR, name);
      setCreating(null);
    });

  return (
    <>
      <div className="am-crumbbar">
        <Crumbs items={crumbItems} />
        <div className="am-spacer" />
        {dir && dirGroup ? (
          <>
            <button className="btn small ghost" onClick={() => renameGroup(dir)} data-testid="rename-current-group">
              改名 / 移动
            </button>
            <button className="btn small ghost danger" onClick={() => removeGroup(dir)} data-testid="remove-current-group">
              删除当前文件夹
            </button>
          </>
        ) : null}
      </div>

      {/* 网盘式工具行：内联新建，只起名，不弹对话框。
          资源必须住在文件夹里（存储模型决定），根目录下禁用并提示。 */}
      {!batchMode ? (
        <div className="am-actions">
          {creating === 'dir' ? (
            <InlineCreateRow
              placeholder="文件夹名称，可用 / 一次建多层，如 ui/buttons"
              confirmText="创建文件夹"
              onConfirm={submitDir}
              onCancel={() => setCreating(null)}
              testId="inline-create-dir"
            />
          ) : (
            <button className="btn small" onClick={() => setCreating('dir')} data-testid="new-dir">
              + 新建文件夹
            </button>
          )}
          {creating === 'asset' ? (
            <InlineCreateRow
              placeholder={dir ? '资源名称，如 login-btn —— 创建后直接进入编辑' : `资源名称，如 login-btn（将创建在「未分类」文件夹）`}
              confirmText="创建并打开"
              onConfirm={submitAsset}
              onCancel={() => setCreating(null)}
              testId="inline-create-asset"
            />
          ) : (
            <button className="btn small primary" onClick={() => setCreating('asset')} data-testid="new-asset">
              + 新建资源
            </button>
          )}
        </div>
      ) : null}

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
            <>还没有任何内容。点上方「+ 新建文件夹」或「+ 新建资源」开始。</>
          ) : (
            <>此文件夹为空</>
          )}
        </div>
      ) : null}
    </>
  );
}
