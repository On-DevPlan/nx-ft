// 侧边栏纯模型：过滤 / 展开判定 / 可见序。
// 不碰 DOM、不碰 React——渲染顺序与键盘导航顺序都从这里出，
// 保证「看到的行序」和「↑↓ 走的行序」永远是同一份。
//
// 节点形状（由 shell.jsx 组装）：
//   { name, path, key, kind?, nav?, children?, total? }
//   path  展开状态 Set 的身份（每行唯一，跨刷新稳定）
//   key   路由身份（selected 按它匹配；可路由行才有）

// 子树是否命中关键词：自身或任一后代的名字命中。
export function subtreeHit(node, kw) {
  if (!kw) return true;
  if ((node.label || node.name || '').toLowerCase().includes(kw)) return true;
  return (node.children || []).some((c) => subtreeHit(c, kw));
}

// 是否因搜索而强制展开：有任一子代命中时，父级跟随展开（不污染用户自己的展开状态）。
export function forceOpen(node, kw) {
  if (!kw || !node.children) return false;
  return node.children.some((c) => subtreeHit(c, kw));
}

// 可见行的扁平序（DOM 渲染与键盘导航共用）。
// kw 过滤：未命中的子树整枝隐藏；命中节点的祖先自动可见。
// 展开判定：用户展开的照常展开；搜索态下有命中的父级强制展开。
export function flattenVisible(nodes, kw, expanded, parent = null, out = []) {
  for (const n of nodes) {
    if (kw && !subtreeHit(n, kw)) continue;
    out.push({ node: n, parent });
    if (n.children && n.children.length && (expanded.has(n.path) || forceOpen(n, kw))) {
      flattenVisible(n.children, kw, expanded, n, out);
    }
  }
  return out;
}

// 按 key 找节点，返回含自身的祖先链（用于深链时自动展开沿途目录）。
export function chainByKey(nodes, key, chain = []) {
  for (const n of nodes) {
    const next = [...chain, n];
    if (n.key === key) return next;
    if (n.children) {
      const hit = chainByKey(n.children, key, next);
      if (hit) return hit;
    }
  }
  return null;
}
