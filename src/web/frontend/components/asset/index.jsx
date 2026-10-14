// 资产域路由（html / svg 共用）：
//   #/html                             → 第一层：分组管理页（目录树 + 卡片网格）
//   #/html/dir/<组路径>                → 管理页并定位到该目录（工作台面包屑回跳用）
//   #/html/edit/<组路径>/<资源名>       → 第二层：全屏工作台（编辑 + 预览）
// 子路由由本组件解释；面板壳只取 hash 首段判视图（见 App.jsx），互不打架。
import { useEffect, useState } from 'react';
import { ManagePage } from './manage.jsx';
import { WorkbenchPage } from './workbench.jsx';

const enc = encodeURIComponent;
const dec = (s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

const encPath = (path) => path.split('/').map(enc).join('/');

// 资源名恒为最后一段（名字不含 /），其余段拼回分组路径（1~8 段）。
export function parseRoute(kind, hash) {
  const h = String(hash ?? '').replace(/^#\/?/, '');
  const segs = h.split('/').filter(Boolean).map(dec);
  if (segs[0] !== kind) return { mode: 'manage', dir: null };
  if (segs[1] === 'edit' && segs.length >= 4) {
    const name = segs[segs.length - 1];
    const group = segs.slice(2, -1).join('/');
    if (group && name) return { mode: 'edit', group, name };
  }
  if (segs[1] === 'dir' && segs.length >= 3) {
    return { mode: 'manage', dir: segs.slice(2).join('/') };
  }
  return { mode: 'manage', dir: null };
}

export function AssetView({ kind, toolbar, emptyState }) {
  const [route, setRoute] = useState(() => parseRoute(kind, typeof location !== 'undefined' ? location.hash : ''));

  useEffect(() => {
    const onHash = () => setRoute(parseRoute(kind, location.hash));
    window.addEventListener('hashchange', onHash);
    onHash();
    return () => window.removeEventListener('hashchange', onHash);
  }, [kind]);

  const goManage = (dir) => {
    location.hash = dir ? `#/${kind}/dir/${encPath(dir)}` : `#/${kind}`;
  };
  const openAsset = (group, name) => {
    location.hash = `#/${kind}/edit/${encPath(group)}/${enc(name)}`;
  };

  if (route.mode === 'edit') {
    return (
      <WorkbenchPage
        key={`${kind}:${route.group}/${route.name}`}
        kind={kind}
        group={route.group}
        name={route.name}
        onNavigate={goManage}
      />
    );
  }
  return <ManagePage kind={kind} initialDir={route.dir} onOpen={openAsset} onNavigate={goManage} toolbar={toolbar} emptyState={emptyState} />;
}
