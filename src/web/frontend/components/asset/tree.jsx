// 工作台/管理页的目录树（被 svg 工作台右窄栏 TreePanel 与 html 管理页 manage.jsx 共同使用）。
// 显示用 buildTree（无任何 UI 状态）；拖拽换层级/排序由调用方通过 onMove 注入，组件本身
// 只管「能不能放、放下后给调用方一个 target」，target 形状 = { node, mode }，mode ∈
// { 'into', 'before', 'after' }。节点自身不持拖拽状态——由 TreePanel 统一管 dragFrom / dropKey。
import { Fragment, useState } from 'react';

export const byOrder = (a, b) =>
  (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
  String(a.name).localeCompare(String(b.name));

export function buildTree(groups) {
  const root = { name: '全部', path: '', label: null, children: [], direct: [], total: 0 };
  const byPath = new Map([['', root]]);

  const ensure = (path) => {
    if (byPath.has(path)) return byPath.get(path);
    const segs = path.split('/');
    const parent = ensure(segs.slice(0, -1).join('/'));
    const node = { name: segs[segs.length - 1], path, label: null, order: null, children: [], direct: [], total: 0 };
    parent.children.push(node);
    byPath.set(path, node);
    return node;
  };

  for (const g of groups) {
    const node = ensure(g.path);
    node.label = g.label;
    // 资源也按 byOrder 排（asset-reorder 写入的 order 优先，没有的按名字垫底）——
    // 与下面的 sortLevel 一起，让「树里看到的序」= 主页面卡片序 = 拖拽提交的序，
    // 三处共用同一份比较器，不会分叉。API 返回的是 manifest 迭代序（无序），
    // 所以这里必须显式排。
    node.direct = [...(g.assets || [])].sort(byOrder);
    node.order = g.order ?? null;
  }

  const count = (n) => {
    n.total = n.direct.length + n.children.reduce((s, c) => s + count(c), 0);
    return n.total;
  };
  count(root);
  // 逐层排序：byOrder（模块级导出）= 有 order 的按序在前，没 order 的按名字垫底
  const sortLevel = (n) => {
    n.children.sort(byOrder);
    n.children.forEach(sortLevel);
  };
  sortLevel(root);
  return root;
}

export function findNode(root, path) {
  if (!path) return root;
  let node = root;
  for (const seg of path.split('/')) {
    node = node.children.find((c) => c.name === seg);
    if (!node) return null;
  }
  return node;
}

export function ancestorsOf(path) {
  const segs = path ? path.split('/') : [];
  const out = [];
  for (let i = 1; i <= segs.length; i++) out.push(segs.slice(0, i).join('/'));
  return out;
}

function Node({ node, depth, sel, expanded, onSelect, onToggle, dragCtx }) {
  const open = expanded.has(node.path);
  const hasChildren = node.children.length > 0;
  const { dragFromPath, dropKey } = dragCtx || {};
  const myDrop = dropKey && dropKey.startsWith(node.path + '|') ? dropKey.split('|')[1] : null;
  const lineTop = myDrop === 'before';
  const lineBottom = myDrop === 'after';
  const dropping = myDrop === 'into';
  const isDragging = dragFromPath === node.path;
  return (
    <div className="tm-node">
      <div
        className={
          'tm-row' + (sel === node.path ? ' active' : '') + (isDragging ? ' dragging' : '') +
          (dropping ? ' drop-on' : '') + (lineTop ? ' drop-line-top' : '') +
          (lineBottom ? ' drop-line-bottom' : '')
        }
        style={{ paddingLeft: 6 + depth * 14 }}
        onClick={() => onSelect(node.path)}
        title={node.path || '全部'}
        draggable={!!dragCtx && hasChildren}
        onDragStart={
          dragCtx
            ? (e) => {
                dragCtx.start(node, e);
              }
            : undefined
        }
        onDragOver={
          dragCtx
            ? (e) => {
                dragCtx.over(node, e);
              }
            : undefined
        }
        onDragLeave={
          dragCtx
            ? () => {
                dragCtx.leave(node.path);
              }
            : undefined
        }
        onDrop={
          dragCtx
            ? (e) => {
                dragCtx.drop(node, e);
              }
            : undefined
        }
        onDragEnd={dragCtx ? () => dragCtx.end() : undefined}
      >
        {hasChildren ? (
          <button
            className="tm-arrow"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.path);
            }}
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="tm-arrow tm-arrow-empty">·</span>
        )}
        <span className="tm-name">{node.label || node.name}</span>
        {node.total > 0 ? <span className="tm-count">{node.total}</span> : null}
      </div>
      {hasChildren && open
        ? node.children.map((c) => (
            <Fragment key={c.path}>
              <Node
                node={c}
                depth={depth + 1}
                sel={sel}
                expanded={expanded}
                onSelect={onSelect}
                onToggle={onToggle}
                dragCtx={dragCtx}
              />
            </Fragment>
          ))
        : null}
    </div>
  );
}

export function TreePanel({ root, sel, expanded, onSelect, onToggle, onMove }) {
  // 拖拽状态机：dragFromPath 记被拖的 path；dropKey 记命中落点（含模式）。
  // 起在面板层而不是 Node 内部：兄弟节点需要共享同一份「我正在拖」的真值。
  const [dragFromPath, setDragFromPath] = useState(null);
  const [dropKey, setDropKey] = useState(null);
  // 同父级判定：路径按 '/' 切，去掉末段，剩的是父级。'fr' 与 'test' 都 → '' 同级；
  // 'ui' 与 'ui/icons' → '' vs 'ui' 不同（不同层）。
  const sameParent = (p1, p2) => {
    const a = p1.split('/').slice(0, -1).join('/');
    const b = p2.split('/').slice(0, -1).join('/');
    return a === b;
  };
  const dragCtx = onMove
    ? {
        dragFromPath,
        dropKey,
        start: (n, e) => {
          if (!e.dataTransfer) return;
          setDragFromPath(n.path);
          e.dataTransfer.effectAllowed = 'move';
          try { e.dataTransfer.setData('text/plain', n.path); } catch {}
        },
        over: (n, e) => {
          if (!dragFromPath) return;
          // 不能拖到自己或自己的后代（前者直接挡，后者用前缀比较：子路径以「父路径 + '/'」开头）
          if (n.path === dragFromPath) return;
          if (dragFromPath && (n.path === dragFromPath || n.path.startsWith(dragFromPath + '/'))) {
            setDropKey(null);
            return;
          }
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
          const r = e.currentTarget.getBoundingClientRect();
          const ratio = r.height ? (e.clientY - r.top) / r.height : 0.5;
          let mode;
          if (sameParent(dragFromPath, n.path) && ratio < 0.3) mode = 'before';
          else if (sameParent(dragFromPath, n.path) && ratio > 0.7) mode = 'after';
          else mode = 'into';
          setDropKey(n.path + '|' + mode);
        },
        leave: (p) => setDropKey((k) => (k && k.startsWith(p + '|') ? null : k)),
        drop: (n, e) => {
          e.preventDefault();
          if (!dragFromPath) return;
          const r = e.currentTarget.getBoundingClientRect();
          const ratio = r.height ? (e.clientY - r.top) / r.height : 0.5;
          let mode;
          if (sameParent(dragFromPath, n.path) && ratio < 0.3) mode = 'before';
          else if (sameParent(dragFromPath, n.path) && ratio > 0.7) mode = 'after';
          else mode = 'into';
          const targetPath = n.path;
          const fromPath = dragFromPath;
          setDragFromPath(null);
          setDropKey(null);
          onMove(fromPath, targetPath, mode);
        },
        end: () => { setDragFromPath(null); setDropKey(null); },
      }
    : null;
  return (
    <div className="tm-tree">
      <div
        className={'tm-row tm-root' + (sel === '' ? ' active' : '')}
        onClick={() => onSelect('')}
      >
        <span className="tm-name">全部</span>
        {root.total > 0 ? <span className="tm-count">{root.total}</span> : null}
      </div>
      {root.children.map((c) => (
        <Node
          key={c.path}
          node={c}
          depth={0}
          sel={sel}
          expanded={expanded}
          onSelect={onSelect}
          onToggle={onToggle}
          dragCtx={dragCtx}
        />
      ))}
      {!root.children.length ? <div className="muted tm-empty">暂无目录</div> : null}
    </div>
  );
}
