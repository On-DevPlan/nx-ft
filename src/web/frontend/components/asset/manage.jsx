// 分组管理页（网盘式）：面包屑当地址栏，整页只显示「当前目录」的内容。
// 没有左侧树——层级导航靠点文件夹卡片下行、点面包屑回跳，与网盘一致。
//
// 搜索/标签筛选时切换为「结果视图」（平铺分组区块，manage-result.jsx）；
// 浏览视图在 manage-browse.jsx。创建是内联输入行（只起名，不弹对话框）。
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client.js';
import { useDialog, useGuard, useToast } from '../ui.jsx';
import { TagCloud, BatchBar } from './parts.jsx';
import { buildTree, findNode } from './tree.jsx';
import { ManageBrowse } from './manage-browse.jsx';
import { ManageResult } from './manage-result.jsx';
import { makeManageOps } from './useManageOps.js';
import { useBatchOps } from './useBatchOps.js';
import { ManageBar } from './manage-bar.jsx';
import { ShellBar } from '../layout/index.jsx';
import { notifyTreeChanged, onTreeChanged } from './tree-signal.js';
import { useToolbarLayout } from './useToolbarLayout.js';
import { exportPickZip } from './zip-io.jsx';

const KIND_TITLE = { html: 'HTML 资源', svg: 'SVG 资源', color: '色彩资源' };
const KIND_NOUN = { html: '资源', svg: '资源', color: '调色板' };
const STATE_KEY = (kind) => `nx-ft-manage-${kind}`;

function loadState(kind) {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY(kind))) || {};
  } catch {
    return {};
  }
}

// 导航走 onNavigate（调用方写 hash，hash 回流 initialDir）——URL 与视图保持同一写者。
// toolbar 可以是节点，也可以是 (reload) => 节点 的函数（svg 看板动作需要 reload）。
// views 是领域扩展的额外视图（如 svg 画廊）：[{ id, label, render(ctx) }]，
// 「编辑模式」是默认视图（defaultViewLabel 可改），切换状态与筛选一起持久化。
export function ManagePage({
  kind,
  initialDir,
  onOpen,
  onNavigate,
  toolbar,
  noun,
  views = [],
  defaultViewLabel = '列表',
  emptyState = null,
  // 1.1 工具栏可编排：父级（AssetView）预渲染的 zip-io 单边按钮；html 域会有，svg/color 没有。
  exportBtn = null,
  importBtn = null,
}) {
  const toast = useToast();
  const guard = useGuard();
  const { dialog, node } = useDialog();

  const [tree, setTree] = useState(null);
  // 1.1 工具栏可编排：模块表 + 持久化到 localStorage（与侧边栏 storageKey 同模式）
  const { layout, setLayout } = useToolbarLayout(kind);
  // dir 只认 URL（initialDir 来自 hash）：侧边栏高亮与这里必须同源——
  // 「新建落在哪」看的就是它。从 localStorage 恢复上次目录会让两边错位
  // （实测过：侧边栏高亮着根，新建却落进了上次打开的子目录）。
  const [dir, setDir] = useState(() => initialDir ?? '');
  const [searchInput, setSearchInput] = useState(() => loadState(kind).search || '');
  const [search, setSearch] = useState(searchInput);
  const [activeTags, setActiveTags] = useState(() => loadState(kind).tags || []);
  const [viewId, setViewId] = useState(() => loadState(kind).view || 'default');
  const [err, setErr] = useState('');

  // 深链（#/html/dir/…）带来的目录变化
  useEffect(() => {
    if (initialDir != null) setDir(initialDir);
  }, [initialDir]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    try {
      // dir 不落盘：它由 URL 负责（见上），落盘反而造成两边错位
      localStorage.setItem(STATE_KEY(kind), JSON.stringify({ search: searchInput, tags: activeTags, view: viewId }));
    } catch {
      /* 隐私模式静默 */
    }
  }, [searchInput, activeTags, viewId, kind]);

  const reload = useCallback(async () => {
    const q = new URLSearchParams();
    if (search) q.set('search', search);
    if (activeTags.length) q.set('tags', activeTags.join(','));
    const qs = q.toString();
    const t = await api(`/api/${kind}/tree${qs ? '?' + qs : ''}`);
    setTree(t);
    return t;
  }, [kind, search, activeTags]);

  useEffect(() => {
    guard(() => reload().catch(() => setErr('加载失败')));
  }, [reload]);

  // 「会改动数据」的动作走这个：重取本页的树 + 喊一声让侧边栏（另一棵树）也重取。
  // 筛选/搜索引起的重取仍走 reload —— 别拿信号去吵侧边栏。
  const reloadTree = useCallback(async () => {
    const t = await reload();
    notifyTreeChanged();
    return t;
  }, [reload]);

  // 反向：侧边栏（或别处）改了目录，本页跟着重取
  useEffect(() => onTreeChanged(() => guard(() => reload().catch(() => {}))), [reload]);

  // 路由是真相：hash 一变就重取树。侧边栏建目录/改名后会跳进新目录，
  // 内容区（子目录卡片、资源列表）必须跟着换数据，否则会停在上一代树上。
  useEffect(() => {
    const onHash = () => guard(() => reload().catch(() => {}));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [reload]);

  const root = useMemo(() => buildTree(tree?.groups || []), [tree]);
  const dirNode = useMemo(() => findNode(root, dir), [root, dir]);
  const dirGroup = useMemo(
    () => (tree?.groups || []).find((g) => g.path === dir) || null,
    [tree, dir]
  );
  const filtered = !!search || activeTags.length > 0;

  const toggleTag = (tag) =>
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]));

  const pickDir = (path) => {
    go(path);
    setSearchInput('');
    setSearch('');
    setActiveTags([]); // 点目录 = 回浏览模式
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setActiveTags([]);
  };

  const { removeGroup, createGroup, createAsset, renameGroup } = makeManageOps({
    kind,
    dir,
    reload: reloadTree,
    setDir,
    dialog,
    guard,
    toast,
    onOpen,
    noun: noun || KIND_NOUN[kind] || '资源',
  });

  // 目录跳转 = 本地立即切换 + 通知调用方写 URL（不变则无 hashchange，无回环）
  const go = (path) => {
    setDir(path);
    onNavigate?.(path);
  };

  // ---- 批量选择（状态与动作在 useBatchOps） ----
  const {
    selected,
    selectedDirs,
    batchMode,
    setBatchMode,
    toggleSelect,
    toggleSelectDir,
    enterBatch,
    cancelBatch,
    visibleAssets,
    visibleDirs,
    selectAllVisible,
    invertVisible,
    batchDelete,
    batchDeleteDirs,
  } = useBatchOps({ kind, tree, root, dirNode, dir, filtered, dialog, toast, reloadTree });

  const count = tree?.count || { groups: 0, assets: 0 };

  // 1.2 选区构建：selectedDirs 整选（递归），selected 子文件（key = `groupPath/name`）。
  // 整选与同 key 的子文件会被服务端去重（collectExports 的 seen Set），前端不去重
  // 也行——重复就是再次校验而已。为了 dialog 概要更短，前端去重。
  const buildPick = () => {
    const pick = [];
    for (const d of selectedDirs) pick.push({ type: 'dir', path: d });
    for (const k of selected) pick.push({ type: 'asset', key: k });
    return pick;
  };
  const onExportPick = () => {
    const pick = buildPick();
    if (!pick.length) return;
    exportPickZip({ kind, pick, toast, guard, dialog });
  };

  // 面包屑：全部 / ui / buttons（每段可点回该层）——这就是网盘的地址栏
  const crumbItems = [
    { label: '全部', onClick: dir ? () => pickDir('') : undefined },
    ...(dir ? dir.split('/') : []).map((seg, i, all) => {
      const prefix = all.slice(0, i + 1).join('/');
      const n = findNode(root, prefix);
      return {
        label: n?.label || seg,
        mono: !n?.label,
        title: prefix,
        onClick: i < all.length - 1 ? () => pickDir(prefix) : undefined,
      };
    }),
  ];

  // 工具区的「新建子目录」：落在当前（= 侧边栏高亮）目录下，建完跳进去——
  // 与侧边栏头部那个「+」同一套语义，两处入口不该有两套规矩。
  const createDirIn = async (name) => {
    // createGroup 已 toast（ok / warn），这里不再叠一条「已创建目录」
    await createGroup(dir, name);
    setSearchInput('');
    setSearch('');
    setActiveTags([]);
    setViewId('default');
    setBatchMode(false);
    // 「建完跳进去」：跳的是新子目录的完整路径（根目录下建的就是它自己）
    go(dir ? `${dir}/${name}` : name);
  };

  // 工具区的「新建资源」：根目录下的资源要落进保留文件夹「未分类」
  // （存储模型要求资源必须住在文件夹里，网盘的根目录也能放文件）。
  // 建完清筛选，让新资源在列表里可见。
  const createAssetIn = async (name) => {
    const HOME_DIR = '未分类';
    if (!dir) await createGroup('', HOME_DIR);
    await createAsset(dir || HOME_DIR, name);
    setSearchInput('');
    setSearch('');
    setActiveTags([]);
    setViewId('default');
    setBatchMode(false);
    await reloadTree();
  };

  return (
    <div className="asset-manage">
      {/* V3 工具区：面包屑 + 新建资源 + 搜索 + 更多菜单，经 ShellBar 传送进
          Layout 的工具条；视图切换 / 领域批量（svg）/ 目录动作收进菜单。
          1.1 起按 layout 模块表渲染；export/import 由父级 AssetView 预渲染后传入。 */}
      <ShellBar>
        <ManageBar
          crumbs={crumbItems}
          inDir={!!(dir && dirGroup)}
          onRenameDir={() => renameGroup(dir)}
          onRemoveDir={() => removeGroup(dir)}
          onCreateAsset={createAssetIn}
          onCreateDir={createDirIn}
          search={searchInput}
          onSearch={setSearchInput}
          searchPlaceholder={kind === 'color' ? '全库搜索 调色板 / 分组 / 标签' : undefined}
          viewId={viewId}
          onView={setViewId}
          defaultViewLabel={defaultViewLabel}
          views={views}
          onBatch={enterBatch}
          extra={typeof toolbar === 'function' ? toolbar(reloadTree) : toolbar}
          layout={layout}
          setLayout={setLayout}
          exportBtn={exportBtn}
          importBtn={importBtn}
        />
      </ShellBar>

      <div className="am-head">
        <span className="am-title">{KIND_TITLE[kind]}</span>
        <span className="muted am-count">
          {tree ? (
            dir && dirGroup ? (
              // 目录内报「本目录直接子项」统计——全库数字在子目录里只会误导
              //（03 主页面任务的差距 #3）；全库统计只在根（=「全部」）给。
              `本目录 ${dirNode?.children.length ?? 0} 个文件夹 · ${dirGroup.assets.length} 个${noun || KIND_NOUN[kind] || '资源'}`
            ) : (
              <>
                {`${count.groups} 个分组 · ${count.assets} 个${noun || KIND_NOUN[kind] || '资源'}`}
                {filtered && tree.total.assets !== count.assets ? `（筛选自 ${tree.total.assets} 个）` : ''}
              </>
            )
          ) : '加载中…'}
        </span>
      </div>

      <TagCloud
        tags={tree?.availableTags || []}
        active={activeTags}
        onToggle={toggleTag}
        onClear={() => setActiveTags([])}
      />

      {batchMode ? (
        <BatchBar
          count={selected.size}
          dirCount={selectedDirs.size}
          total={visibleAssets().length + visibleDirs().length}
          onSelectAll={selectAllVisible}
          onInvert={invertVisible}
          onCancel={cancelBatch}
          actions={[
            {
              label: `导出选中${selected.size + selectedDirs.size ? ` (${selected.size + selectedDirs.size})` : ''}`,
              testId: 'batch-export-pick',
              onClick: onExportPick,
              disabled: selected.size === 0 && selectedDirs.size === 0,
            },
            {
              label: `批量删除资源${selected.size ? ` (${selected.size})` : ''}`,
              testId: 'batch-delete',
              onClick: batchDelete,
              disabled: selected.size === 0,
              danger: true,
            },
            {
              label: `批量删除目录${selectedDirs.size ? ` (${selectedDirs.size})` : ''}`,
              testId: 'batch-delete-dirs',
              onClick: batchDeleteDirs,
              disabled: selectedDirs.size === 0,
              danger: true,
            },
          ]}
        />
      ) : null}

      {err ? <div className="empty bad">{err}</div> : null}

      {tree ? (
        views.find((v) => v.id === viewId) ? (
          // 领域扩展视图（如 svg 画廊）：拿同一份 ctx，自己决定怎么展示当前文件夹
          views
            .find((v) => v.id === viewId)
            .render({
              kind,
              dir,
              dirGroup,
              dirNode,
              tree,
              search,
              activeTags,
              onOpen,
              pickDir,
              batchMode,
              selected,
              selectedDirs,
              onToggle: toggleSelect,
              onToggleDir: toggleSelectDir,
              reload: reloadTree,
            })
        ) : filtered ? (
          <ManageResult
            kind={kind}
            tree={tree}
            count={count}
            activeTags={activeTags}
            toggleTag={toggleTag}
            onOpen={onOpen}
            onClear={clearFilters}
            batchMode={batchMode}
            selected={selected}
            onToggle={toggleSelect}
          />
        ) : (
          <ManageBrowse
            count={count}
            dir={dir}
            dirNode={dirNode}
            dirGroup={dirGroup}
            tree={tree}
            activeTags={activeTags}
            toggleTag={toggleTag}
            onOpen={onOpen}
            pickDir={pickDir}
            removeGroup={removeGroup}
            batchMode={batchMode}
            selected={selected}
            onToggle={toggleSelect}
            selectedDirs={selectedDirs}
            onToggleDir={toggleSelectDir}
            emptyState={emptyState}
            kind={kind}
          />
        )
      ) : null}
      {node}
    </div>
  );
}
