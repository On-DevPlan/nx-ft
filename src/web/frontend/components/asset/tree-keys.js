// 资产域的路由 key 映射：hash ↔ 侧边栏行的身份。
//
// key 的三种形态（与 sidebar 的 NodeRow、use-tree-ops 的落点判定共用）：
//   dir:<kind>:<分组路径>      目录行
//   asset:<kind>:<组>/<名>     资源行
//   root:<kind>                整棵树（本域的根行）
//
// hash → key 只认 html/svg 共用的那层词汇（dir / edit 两段），与
// components/asset/index.jsx 的 parseRoute、modules/svg/view.jsx 的 parseSvgRoute 对齐；
// 两边的路由词汇改了要一起改。
const dec = (s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

// 去掉 key 的前缀部分：`dir:svg:a/b` → 'a/b'；`asset:svg:a/b` → 'a/b'
export const relOfKey = (key) => (key ? String(key).split(':').slice(2).join(':') : '');

// 选中项**所在的目录**：目录选中 = 它自己；资源选中 = 它所属的分组。
// 「+」新建落在哪里、删除后要不要退回，都看这个——直接用 relOfKey 会把资源名
// 也当成目录路径，建出来的目录就挂错了地方。
export function dirOfKey(key) {
  if (!key || key.startsWith('root:')) return ''; // 整棵树选中 = 建在最外层
  const rel = relOfKey(key);
  return key.startsWith('asset:') ? rel.split('/').slice(0, -1).join('/') : rel;
}

// hash → 选中 key。根路由（#/html、#/svg）= 「整棵树被选中」，不是「什么都没选」。
// 每段先剥 ?query 再解码（全屏 Studio 返回时 hash 带 ?group=<g>，与
// components/asset/index.jsx 的 parseRoute、modules/color/view.jsx 同一约定）。
export function keyFromHash(hash) {
  const segs = String(hash ?? '')
    .replace(/^#\/?/, '')
    .split('/')
    .filter(Boolean)
    .map((s) => dec(s.split('?')[0]));
  const kind = segs[0];
  if (segs[1] === 'dir' && segs.length >= 3) return `dir:${kind}:${segs.slice(2).join('/')}`;
  if (segs[1] === 'edit' && segs.length >= 4) {
    // svg 的整页预览多一段 /full（#/svg/edit/<组>/<名>/full）
    const rest = segs.slice(2);
    const hasFull = rest.length >= 3 && rest[rest.length - 1] === 'full';
    const cut = rest.length - (hasFull ? 2 : 1);
    const group = rest.slice(0, cut).join('/');
    const name = rest[cut];
    if (group && name) return `asset:${kind}:${group}/${name}`;
  }
  return kind ? `root:${kind}` : null;
}
