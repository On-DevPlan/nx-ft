// 分组管理页（网盘式）：面包屑当地址栏，整页只显示「当前目录」的内容。
// 没有左侧树——层级导航靠点文件夹卡片下行、点面包屑回跳，与网盘一致。
//
// 搜索/标签筛选时切换为「结果视图」（平铺分组区块，manage-result.jsx）；
// 浏览视图在 manage-browse.jsx。创建是内联输入行（只起名，不弹对话框）。
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client.js';
import { useDialog, useGuard, useToast } from '../ui.jsx';
import { TagCloud, BatchBar, Crumbs } from './parts.jsx';
import { buildTree, findNode } from './tree.jsx';
import { ManageBrowse } from './manage-browse.jsx';
import { ManageResult } from './manage-result.jsx';
import { makeManageOps } from './useManageOps.js';

const KIND_TITLE = { html: 'HTML 资源', svg: 'SVG 资源' };
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
  noun = '资源',
  views = [],
  defaultViewLabel = '列表',
}) {
  const toast = useToast();
  const guard = useGuard();
  const { dialog, node } = useDialog();

  const [tree, setTree] = useState(null);
  const [dir, setDir] = useState(() => initialDir ?? loadState(kind).dir ?? '');
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
      localStorage.setItem(
        STATE_KEY(kind),
        JSON.stringify({ dir, search: searchInput, tags: activeTags, view: viewId })
      );
    } catch {
      /* 隐私模式静默 */
    }
  }, [dir, searchInput, activeTags, viewId, kind]);

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
    reload,
    setDir,
    dialog,
    guard,
    toast,
    onOpen,
    noun,
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
    reload();
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
    reload();
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

  return (
    <div className="asset-manage">
      <div className="am-head">
        <span className="am-title">{KIND_TITLE[kind]}</span>
        <span className="muted am-count">
          {tree ? `${count.groups} 个分组 · ${count.assets} 个资源` : '加载中…'}
          {tree && filtered && tree.total.assets !== count.assets ? `（筛选自 ${tree.total.assets} 个）` : ''}
        </span>
        <div className="am-spacer" />
        <input
          className="am-search"
          spellCheck="false"
          placeholder="搜索名称 / 分组 / 标签 / 风格"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          data-testid="manage-search"
        />
        {views.length ? (
          <div className="am-views" role="group" aria-label="视图切换">
            <button
              className={'btn small' + (viewId === 'default' ? ' primary' : '')}
              onClick={() => setViewId('default')}
              data-testid="view-default"
            >
              {defaultViewLabel}
            </button>
            {views.map((v) => (
              <button
                key={v.id}
                className={'btn small' + (viewId === v.id ? ' primary' : '')}
                onClick={() => setViewId(v.id)}
                data-testid={`view-${v.id}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* 地址栏：页面级，所有视图（列表 / 画廊 / 搜索结果）共用——
          放在视图内部的话，换视图就会把「我在哪」弄丢（真踩过：画廊模式没面包屑）。 */}
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

      <TagCloud
        tags={tree?.availableTags || []}
        active={activeTags}
        onToggle={toggleTag}
        onClear={() => setActiveTags([])}
      />

      {/* 领域扩展插槽：svg 看板动作等；函数形态收 reload 供动作完成后刷新列表 */}
      {typeof toolbar === 'function' ? toolbar(reload) : toolbar}

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
              reload,
            })
        ) : filtered ? (
          <ManageResult
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
            createGroup={createGroup}
            createAsset={createAsset}
            guard={guard}
            batchMode={batchMode}
            selected={selected}
            onToggle={toggleSelect}
            selectedDirs={selectedDirs}
            onToggleDir={toggleSelectDir}
          />
        )
      ) : null}
      {!batchMode ? (
        <div className="am-tools">
          <button className="btn small ghost" onClick={enterBatch} data-testid="enter-batch">
            批量操作
          </button>
        </div>
      ) : null}
      {node}
    </div>
  );
}
