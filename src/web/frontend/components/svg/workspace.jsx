// SVG 工作台：左边常驻目录树（可拖宽），右边是当前目录的内容。
//
// 为什么把「看板」和「分组页」合成一页：
//   原来是两个路由两套页面，后果是——进了分组就看不到目录树，要换目录得先退出去；
//   而空分组点进去是**死路**（页面里没有任何新建入口），用户的原话是
//   「连资源页面都进不去」。现在只有一页：树常驻，切目录 = 换右边的内容。
//
// 路由仍是 #/svg 与 #/svg/dir/<组>（前者是根目录 path=''），
// 地址栏与「当前在哪个目录」始终一致，可分享、可后退。
import { useMemo, useState } from 'react';
import { useStore } from '../../store.jsx';
import { useDialog, useGuard, useToast } from '../ui.jsx';
import { ancestorsOf, buildTree, findNode, TreePanel } from '../asset/tree.jsx';
import { makeManageOps } from '../asset/useManageOps.js';
import { useBatch } from './batch.jsx';
import { Empty, IconTile, StatBar, TagCloud } from './parts.jsx';
import { useBoard, useDebounced, useNav } from './useSvg.js';
import { BatchHints, DirCard, ResultView } from './workspace-views.jsx';
import {
  loadSavedFilter,
  subtreeStats,
  useAutoExpand,
  usePaneWidth,
  useSavedFilter,
} from './useWorkspaceState.js';

export default function Workspace({ path = '' }) {
  const toast = useToast();
  const guard = useGuard();
  const { dialog, node: dlgNode } = useDialog();
  const { boot } = useStore();
  const nav = useNav();
  const bin = boot?.app?.name || 'nx-ft';

  const saved = loadSavedFilter();
  const [searchInput, setSearchInput] = useState(saved.search);
  const [tags, setTags] = useState(saved.tags);
  const search = useDebounced(searchInput);
  useSavedFilter(searchInput, tags);

  const { data, err, busy, reload } = useBoard({ search, tags });
  const pane = usePaneWidth();
  const batch = useBatch({ bin, dialog, guard, toast, reload, group: path });

  const root = useMemo(() => buildTree(data?.groups || []), [data]);
  const node = useMemo(() => findNode(root, path), [root, path]);
  const filtered = !!search || tags.length > 0;
  const exists = !path || !!node;
  const realPaths = useMemo(() => (data?.groups || []).map((g) => g.path), [data]);
  const scope = useMemo(() => subtreeStats(node, realPaths), [node, realPaths]);

  // 展开状态依赖 root 算默认值，所以必须排在 root 之后
  const { expanded, toggle } = useAutoExpand(root, path, ancestorsOf);

  const ops = makeManageOps({
    kind: 'svg',
    dir: path,
    reload,
    setDir: (p) => (p ? nav.group(p) : nav.board()),
    dialog,
    guard,
    toast,
    onOpen: (g, n) => nav.asset(g, n),
    noun: '图标',
  });

  const toggleTag = (t) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  const clearFilters = () => {
    setSearchInput('');
    setTags([]);
  };

  const segs = path ? path.split('/') : [];
  const dirs = node?.children || [];
  const own = node?.direct || [];

  return (
    <div className="ws">
      <aside className="ws-tree" style={{ width: pane.w }}>
        <div className="ws-tree-head">
          <span className="ws-tree-title">目录</span>
          <button className="btn small ghost" onClick={() => ops.addGroup()} title="新建分组">
            + 分组
          </button>
        </div>
        <div className="ws-tree-body">
          <TreePanel
            root={root}
            sel={filtered ? null : path}
            expanded={expanded}
            onSelect={(p) => (p ? nav.group(p) : nav.board())}
            onToggle={toggle}
          />
        </div>
      </aside>

      <div
        className="ws-split"
        role="separator"
        aria-orientation="vertical"
        title="拖动调宽，双击复位"
        onPointerDown={pane.onDown}
        onDoubleClick={pane.reset}
      />

      <section className="ws-main">
        <div className="page-head">
          <nav className="crumb">
            <button
              className={segs.length ? 'crumb-seg' : 'crumb-cur'}
              onClick={() => nav.board()}
            >
              SVG 看板
            </button>
            {segs.map((seg, i) => {
              const upto = segs.slice(0, i + 1).join('/');
              const n = findNode(root, upto);
              return (
                <span key={upto}>
                  <span className="crumb-sep">/</span>
                  <button
                    className={i < segs.length - 1 ? 'crumb-seg' : 'crumb-cur'}
                    title={upto}
                    onClick={() => nav.group(upto)}
                  >
                    {n?.label || seg}
                  </button>
                </span>
              );
            })}
          </nav>
          <div className="page-head-acts">
            <button className="btn" onClick={() => ops.addAsset()}>
              新建图标
            </button>
            <button className="btn ghost" onClick={() => ops.addGroup()}>
              新建子分组
            </button>
            <button className="btn ghost" onClick={() => ops.renameGroup()} disabled={!path}>
              改名 / 移动
            </button>
            <button
              className="btn ghost danger"
              onClick={() => ops.removeGroup(path)}
              disabled={!path}
            >
              删除本组
            </button>
          </div>
        </div>

        <div className="board-bar">
          <div className="board-bar-top">
            <input
              className="board-search"
              spellCheck="false"
              placeholder="搜索图标名 / 分组 / 标签 / 风格"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <div className="board-acts">
              <button className="btn ghost" onClick={() => batch.importDir()}>
                批量导入
              </button>
              <button className="btn ghost" onClick={() => batch.exportDir()}>
                批量导出
              </button>
              <button className="btn ghost" onClick={() => batch.check()}>
                规范自检
              </button>
              <button className="btn ghost" onClick={() => batch.fix()}>
                一键归一化
              </button>
            </div>
          </div>
          <TagCloud
            tags={data?.availableTags || []}
            active={tags}
            onToggle={toggleTag}
            onClear={() => setTags([])}
          />
        </div>

        {err ? <div className="empty bad">接口调用失败：{err}</div> : null}

        <div className="ws-body">
          {!data && busy ? <Empty>加载中…</Empty> : null}
          {data && filtered ? (
            <ResultView
              data={data}
              tags={tags}
              onOpen={(g, n) => nav.asset(g, n)}
              onClear={clearFilters}
            />
          ) : null}
          {data && !filtered && !exists ? (
            <Empty>
              分组 <code className="mono">{path}</code> 不存在（或已删除）。
              <button className="btn small ghost" onClick={() => nav.board()}>
                回到根目录
              </button>
            </Empty>
          ) : null}
          {data && !filtered && exists ? (
            <DirBody
              path={path}
              dirs={dirs}
              own={own}
              scope={scope}
              data={data}
              bin={bin}
              ops={ops}
              nav={nav}
              batch={batch}
            />
          ) : null}
        </div>

        <div className="board-foot">
          <BatchHints bin={bin} />
        </div>
      </section>

      {batch.node}
      {dlgNode}
    </div>
  );
}

// 当前目录的内容：统计 → 子目录 → 本层图标 → 空态。
// 空态是重点：这个目录什么都没有的时候，必须给出「下一步能做什么」，不能只留一句提示。
function DirBody({ path, dirs, own, scope, data, bin, ops, nav, batch }) {
  return (
    <>
      <StatBar
        count={{ groups: scope.groups, assets: scope.icons }}
        total={{ assets: scope.icons }}
        stats={scope}
        spec={data.spec}
      />

      {dirs.length ? (
        <>
          <div className="am-sec-title">子目录 · {dirs.length}</div>
          <div className="ws-dirs">
            {dirs.map((c) => (
              <DirCard
                key={c.path}
                node={c}
                onOpen={() => nav.group(c.path)}
                onRename={() => ops.renameGroup(c.path)}
                onRemove={() => ops.removeGroup(c.path)}
              />
            ))}
          </div>
        </>
      ) : null}

      {own.length ? (
        <>
          <div className="am-sec-title">图标 · {own.length}</div>
          <div className="icon-grid">
            {own.map((a) => (
              <IconTile
                key={a.name}
                asset={a}
                groupPath={path}
                onOpen={() => nav.asset(path, a.name)}
                onFull={() => nav.full(path, a.name)}
              />
            ))}
          </div>
        </>
      ) : null}

      {!dirs.length && !own.length ? (
        <Empty>
          {path ? (
            <>
              这个目录还是空的。先{' '}
              <button className="btn small" onClick={() => ops.addAsset()}>
                新建图标
              </button>{' '}
              放一枚进来，或{' '}
              <button className="btn small ghost" onClick={() => ops.addGroup()}>
                建个子分组
              </button>
              分类。也可以让 AI 直接写：
              <code className="mono">
                {bin} svg put {path} add-icon --style default --code -
              </code>
            </>
          ) : (
            <>
              还没有任何目录。
              <button className="btn small" onClick={() => ops.addGroup()}>
                新建分组
              </button>{' '}
              开始，或{' '}
              <button className="btn small ghost" onClick={() => batch.importDir()}>
                批量导入
              </button>
              一个现成的图标目录——两棵树的根目录是分开的，这里的目录只属于 SVG。
            </>
          )}
        </Empty>
      ) : null}
    </>
  );
}
