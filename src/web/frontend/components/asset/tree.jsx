// 目录树：由分组的扁平清单（listTree.groups）在前端重建层级。
// 同级顺序 = group.order（侧边栏拖拽排序写入）在前，没排序的按名字跟在后面。
//
// 中间层目录可能没有自己的 group.json（只是路径容器），树节点因此有两种形态：
//   路径容器：只有子节点，没有直接资源
//   分组本体：有 group.json（label / 直接资源），也可以同时有子节点
// 展开状态与选中态由管理页持有（持久化）。
import { Fragment } from 'react';

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
    node.direct = g.assets;
    node.order = g.order ?? null;
  }

  const count = (n) => {
    n.total = n.direct.length + n.children.reduce((s, c) => s + count(c), 0);
    return n.total;
  };
  count(root);
  // 逐层排序：有 order 的按序在前，没 order 的按名字垫底（reorder 只写点过名的）
  const byOrder = (a, b) =>
    (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
    a.name.localeCompare(b.name);
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

function Node({ node, depth, sel, expanded, onSelect, onToggle }) {
  const open = expanded.has(node.path);
  const hasChildren = node.children.length > 0;
  return (
    <div className="tm-node">
      <div
        className={'tm-row' + (sel === node.path ? ' active' : '')}
        style={{ paddingLeft: 6 + depth * 14 }}
        onClick={() => onSelect(node.path)}
        title={node.path || '全部'}
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
              />
            </Fragment>
          ))
        : null}
    </div>
  );
}

export function TreePanel({ root, sel, expanded, onSelect, onToggle }) {
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
        <Node key={c.path} node={c} depth={0} sel={sel} expanded={expanded} onSelect={onSelect} onToggle={onToggle} />
      ))}
      {!root.children.length ? <div className="muted tm-empty">暂无目录</div> : null}
    </div>
  );
}
