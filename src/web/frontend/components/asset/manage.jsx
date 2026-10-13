// 分组管理页（第一层）：左侧多层目录树，右侧当前目录（面包屑 + 子目录 + 资源卡片）。
// 搜索/标签筛选时切换为「结果视图」（平铺分组区块）；点树即回到浏览模式。
//
// 两个视图各成一个文件（manage-result.jsx / manage-browse.jsx）：这支 JSX 太长，
// 混在一起时「改搜索结果样式」和「改目录浏览样式」会不停互相干扰。
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client.js';
import { useDialog, useGuard, useToast } from '../ui.jsx';
import { TagCloud, BatchBar } from './parts.jsx';
import { ancestorsOf, buildTree, findNode, TreePanel } from './tree.jsx';
import { ManageBrowse } from './manage-browse.jsx';
import { ManageResult } from './manage-result.jsx';
import { makeManageOps } from './useManageOps.js';
import { SplitPane } from './SplitPane.jsx';

const KIND_TITLE = { html: 'HTML 资源', svg: 'SVG 资源' };
const STATE_KEY = (kind) => `nx-ft-manage-${kind}`;

function loadState(kind) {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY(kind))) || {};
  } catch {
    return {};
  }
}

export function ManagePage({ kind, initialDir, onOpen }) {
  const toast = useToast();
  const guard = useGuard();
  const { dialog, node } = useDialog();

  const [tree, setTree] = useState(null);
  const [dir, setDir] = useState(() => initialDir ?? loadState(kind).dir ?? '');
  const [expanded, setExpanded] = useState(() => new Set(loadState(kind).expanded || []));
  const [searchInput, setSearchInput] = useState(() => loadState(kind).search || '');
  const [search, setSearch] = useState(searchInput);
  const [activeTags, setActiveTags] = useState(() => loadState(kind).tags || []);
  const [err, setErr] = useState('');
  // 批量选择状态：key = `${groupPath}/${name}`
  const [selected, setSelected] = useState(() => new Set());
  // 批量选择目录：value = 目录 path
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
        JSON.stringify({ dir, expanded: [...expanded], search: searchInput, tags: activeTags })
      );
    } catch {
      /* 隐私模式静默 */
    }
  }, [dir, expanded, searchInput, activeTags, kind]);

  // 批量操作切换（资源）
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

  // 批量操作切换（目录）
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

  const selectAllVisible = (assetList, dirList = []) => {
    setSelected((prev) => {
      const next = new Set(prev);
      assetList.forEach(([g, a]) => next.add(`${g}/${a}`));
      return next;
    });
    setSelectedDirs((prev) => {
      const next = new Set(prev);
      dirList.forEach((p) => next.add(p));
      return next;
    });
  };

  const invertVisible = (assetList, dirList = []) => {
    setSelected((prev) => {
      const next = new Set(prev);
      assetList.forEach(([g, a]) => {
        const key = `${g}/${a}`;
        if (next.has(key)) next.delete(key);
        else next.add(key);
      });
      return next;
    });
    setSelectedDirs((prev) => {
      const next = new Set(prev);
      dirList.forEach((p) => {
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
        await api(`/api/${kind}/rm`, {
          method: 'POST',
          body: { group: groupPath, name, force: true },
        });
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
    // 统计影响范围（含子目录与资源）
    const impacted = { groups: 0, assets: 0 };
    const countIn = (node) => {
      if (!node) return;
      impacted.groups += 1;
      impacted.assets += node.direct?.length || 0;
      (node.children || []).forEach(countIn);
    };
    for (const p of selectedDirs) countIn(findNode(root, p));

    const ok = await dialog({
      title: '批量删除目录',
      message: `将删除 ${selectedDirs.size} 个目录，含 ${impacted.groups} 个子目录、${impacted.assets} 个资源与全部历史。此操作不可撤销。`,
      okText: '确认删除',
      danger: true,
    });
    if (!ok) return;

    // 先删子目录（路径短的先删会让父目录路径失效；按路径长度降序）
    const ordered = [...selectedDirs].sort((a, b) => b.split('/').length - a.split('/').length);
    let done = 0;
    for (const p of ordered) {
      try {
        await api(`/api/${kind}/groups-remove`, {
          method: 'POST',
          body: { group: p, force: true },
        });
        done++;
      } catch {
        /* 单条失败不阻断其它 */
      }
    }
    toast(`批量删除目录完成（${done}/${selectedDirs.size}）`);
    cancelBatch();
    reload();
  };

  // 选中目录的祖先链自动展开（从深链/持久化进来的目录立刻可见）
  useEffect(() => {
    if (!dir) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const a of ancestorsOf(dir)) {
        if (!next.has(a)) {
          next.add(a);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [dir]);

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
    setDir(path);
    setSearchInput('');
    setSearch('');
    setActiveTags([]); // 点树 = 回浏览模式
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setActiveTags([]);
  };

  const toggleExpand = (path) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const { addGroup, removeGroup, addAsset } = makeManageOps({ kind, dir, reload, setDir, dialog, guard, toast, onOpen });

  const count = tree?.count || { groups: 0, assets: 0 };

  // 面包屑：全部 / ui / buttons（每段可点回该层）
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
        <button className="btn" onClick={() => addGroup()} data-testid="manage-new-group">新建分组</button>
        <button className="btn" onClick={() => addAsset()} data-testid="manage-new-asset">新建资源</button>
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
          total={
            (filtered
              ? (tree?.groups || []).reduce((s, g) => s + g.assets.length, 0)
              : (tree?.groups.find((g) => g.path === dir)?.assets.length || 0)) +
            (filtered ? (dirNode?.children?.length || 0) : (dirNode?.children?.length || 0))
          }
          onSelectAll={() => {
            const assetList = filtered
              ? (tree?.groups || []).flatMap((g) => g.assets.map((a) => [g.path, a.name]))
              : (tree?.groups.find((g) => g.path === dir)?.assets || []).map((a) => [dir, a.name]);
            const dirList = (dirNode?.children || []).map((c) => c.path);
            selectAllVisible(assetList, dirList);
          }}
          onInvert={() => {
            const assetList = filtered
              ? (tree?.groups || []).flatMap((g) => g.assets.map((a) => [g.path, a.name]))
              : (tree?.groups.find((g) => g.path === dir)?.assets || []).map((a) => [dir, a.name]);
            const dirList = (dirNode?.children || []).map((c) => c.path);
            invertVisible(assetList, dirList);
          }}
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
      ) : (
        <div className="am-tools">
          <button className="btn small ghost" onClick={enterBatch} data-testid="enter-batch">
            批量操作
          </button>
        </div>
      )}

      {err ? <div className="empty bad">{err}</div> : null}

      {tree ? (
        <SplitPane
          direction="horizontal"
          initialPct={22}
          minPct={15}
          maxPct={45}
          persistKey={`nx-ft-am-split-${kind}`}
          testId="am-split"
          left={
            <aside className="am-split-tree">
              <TreePanel
                root={root}
                sel={filtered ? null : dir}
                expanded={expanded}
                onSelect={pickDir}
                onToggle={toggleExpand}
              />
            </aside>
          }
          right={
            <section className="am-split-content">
              {filtered ? (
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
                  tree={tree}
                  count={count}
                  dir={dir}
                  dirNode={dirNode}
                  dirGroup={dirGroup}
                  crumbItems={crumbItems}
                  activeTags={activeTags}
                  toggleTag={toggleTag}
                  onOpen={onOpen}
                  pickDir={pickDir}
                  removeGroup={removeGroup}
                  addGroup={addGroup}
                  addAsset={addAsset}
                  batchMode={batchMode}
                  selected={selected}
                  onToggle={toggleSelect}
                  selectedDirs={selectedDirs}
                  onToggleDir={toggleSelectDir}
                />
              )}
            </section>
          }
        />
      ) : null}
      {node}
    </div>
  );
}
