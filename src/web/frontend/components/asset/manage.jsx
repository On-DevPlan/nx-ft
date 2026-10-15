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
import { ManageBar } from './manage-bar.jsx';
import { ShellBar } from '../layout/index.jsx';
import { notifyTreeChanged, onTreeChanged } from './tree-signal.js';

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
}) {
  const toast = useToast();
  const guard = useGuard();
  const { dialog, node } = useDialog();

  const [tree, setTree] = useState(null);
  // dir 只认 URL（initialDir 来自 hash）：侧边栏高亮与这里必须同源——
  // 「新建落在哪」看的就是它。从 localStorage 恢复上次目录会让两边错位
  // （实测过：侧边栏高亮着根，新建却落进了上次打开的子目录）。
  const [dir, setDir] = useState(() => initialDir ?? '');
  const [searchInput, setSearchInput] = useState(() => loadState(kind).search || '');
  const [search, setSearch] = useState(searchInput);
  const [activeTags, setActiveTags] = useState(() => loadState(kind).tags || []);
  const [viewId, setViewId] = useState(() => loadState(kind).view || 'default');
  const [err, setErr] = useState('');
  // 批量选择：资源 key = `${group}/${name}`；目录 value = path
  const [selected, setSelected] = useState(() => new Set());
  const [selectedDirs, setSelectedDirs] = useState(() => new Set());
  const [batchMode, setBatchMode] = useState(false);

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

  // ---- 批量选择 ----
  const toggleSelect = (groupPath, name) => {
    const key = `${groupPath}/${name}`;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setBatchMode(true);
  };

  const toggleSelectDir = (path) => {
    setSelectedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
    setBatchMode(true);
  };

  const enterBatch = () => setBatchMode(true);
  const cancelBatch = () => {
    setBatchMode(false);
    setSelected(new Set());
    setSelectedDirs(new Set());
  };

  const visibleAssets = () =>
    filtered
      ? (tree?.groups || []).flatMap((g) => g.assets.map((a) => [g.path, a.name]))
      : (tree?.groups.find((g) => g.path === dir)?.assets || []).map((a) => [dir, a.name]);

  const visibleDirs = () => (dirNode?.children || []).map((c) => c.path);

  const selectAllVisible = () => {
    const assets = visibleAssets();
    const dirs = visibleDirs();
    setSelected((prev) => {
      const next = new Set(prev);
      assets.forEach(([g, a]) => next.add(`${g}/${a}`));
      return next;
    });
    setSelectedDirs((prev) => {
      const next = new Set(prev);
      dirs.forEach((p) => next.add(p));
      return next;
    });
  };

  const invertVisible = () => {
    const assets = visibleAssets();
    const dirs = visibleDirs();
    setSelected((prev) => {
      const next = new Set(prev);
      assets.forEach(([g, a]) => {
        const key = `${g}/${a}`;
        if (next.has(key)) next.delete(key);
        else next.add(key);
      });
      return next;
    });
    setSelectedDirs((prev) => {
      const next = new Set(prev);
      dirs.forEach((p) => {
        if (next.has(p)) next.delete(p);
        else next.add(p);
      });
      return next;
    });
  };

  const batchDelete = async () => {
    if (selected.size === 0) return;
    const ok = await dialog({
      title: '批量删除资源',
      message: `将删除 ${selected.size} 个资源。此操作不可撤销。`,
      okText: '确认删除',
      danger: true,
    });
    if (!ok) return;
    let done = 0;
    for (const key of selected) {
      const [groupPath, name] = key.split('/');
      try {
        await api(`/api/${kind}/rm`, { method: 'POST', body: { group: groupPath, name, force: true } });
        done++;
      } catch {
        /* 单条失败不阻断其它 */
      }
    }
    toast(`批量删除资源完成（${done}/${selected.size}）`);
    cancelBatch();
    reloadTree();
  };

  const batchDeleteDirs = async () => {
    if (selectedDirs.size === 0) return;
    const impacted = { groups: 0, assets: 0 };
    const countIn = (nd) => {
      if (!nd) return;
      impacted.groups += 1;
      impacted.assets += nd.direct?.length || 0;
      (nd.children || []).forEach(countIn);
    };
    for (const p of selectedDirs) countIn(findNode(root, p));

    const ok = await dialog({
      title: '批量删除目录',
      message: `将删除 ${selectedDirs.size} 个目录，含 ${impacted.groups} 个子目录、${impacted.assets} 个资源与全部历史。此操作不可撤销。`,
      okText: '确认删除',
      danger: true,
    });
    if (!ok) return;

    // 深路径先删：先删父目录会让子目录路径失效
    const ordered = [...selectedDirs].sort((a, b) => b.split('/').length - a.split('/').length);
    let done = 0;
    for (const p of ordered) {
      try {
        await api(`/api/${kind}/groups-remove`, { method: 'POST', body: { group: p, force: true } });
        done++;
      } catch {
        /* 单条失败不阻断其它 */
      }
    }
    toast(`批量删除目录完成（${done}/${selectedDirs.size}）`);
    cancelBatch();
    reloadTree();
  };

  const count = tree?.count || { groups: 0, assets: 0 };

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
          Layout 的工具条；视图切换 / 领域批量（svg）/ 目录动作收进菜单。 */}
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
          searchPlaceholder={kind === 'color' ? '搜索调色板 / 分组 / 标签' : undefined}
          viewId={viewId}
          onView={setViewId}
          defaultViewLabel={defaultViewLabel}
          views={views}
          onBatch={enterBatch}
          extra={typeof toolbar === 'function' ? toolbar(reloadTree) : toolbar}
        />
      </ShellBar>

      <div className="am-head">
        <span className="am-title">{KIND_TITLE[kind]}</span>
        <span className="muted am-count">
          {tree ? `${count.groups} 个分组 · ${count.assets} 个${noun || KIND_NOUN[kind] || '资源'}` : '加载中…'}
          {tree && filtered && tree.total.assets !== count.assets ? `（筛选自 ${tree.total.assets} 个）` : ''}
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
              search,
              activeTags,
              onOpen,
              pickDir,
              batchMode,
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
