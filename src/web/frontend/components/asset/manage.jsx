// 分组管理页（第一层）：左侧多层目录树，右侧当前目录（面包屑 + 子目录 + 资源卡片）。
// 搜索/标签筛选时切换为「结果视图」（平铺分组区块）；点树即回到浏览模式。
//
// 两个视图各成一个文件（manage-result.jsx / manage-browse.jsx）：这支 JSX 太长，
// 混在一起时「改搜索结果样式」和「改目录浏览样式」会不停互相干扰。
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client.js';
import { useDialog, useGuard, useToast } from '../ui.jsx';
import { TagCloud } from './parts.jsx';
import { ancestorsOf, buildTree, findNode, TreePanel } from './tree.jsx';
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
        />
        <button className="btn" onClick={() => addGroup()}>新建分组</button>
        <button className="btn" onClick={() => addAsset()}>新建资源</button>
      </div>

      <TagCloud
        tags={tree?.availableTags || []}
        active={activeTags}
        onToggle={toggleTag}
        onClear={() => setActiveTags([])}
      />

      {err ? <div className="empty bad">{err}</div> : null}

      {tree ? (
        <div className="am-body">
          <aside className="am-tree">
            <TreePanel
              root={root}
              sel={filtered ? null : dir}
              expanded={expanded}
              onSelect={pickDir}
              onToggle={toggleExpand}
            />
          </aside>

          <section className="am-content">
            {filtered ? (
              <ManageResult
                tree={tree}
                count={count}
                activeTags={activeTags}
                toggleTag={toggleTag}
                onOpen={onOpen}
                onClear={clearFilters}
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
              />
            )}
          </section>
        </div>
      ) : null}
      {node}
    </div>
  );
}
