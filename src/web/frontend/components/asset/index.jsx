// 资产域路由（html / svg 共用）：
//   #/html                             → 第一层：分组管理页（目录树 + 卡片网格）
//   #/html/dir/<组路径>                → 管理页并定位到该目录（工作台面包屑回跳用）
//   #/html/edit/<组路径>/<资源名>       → 第二层：全屏工作台（编辑 + 预览）
// 子路由由本组件解释；面板壳只取 hash 首段判视图（见 App.jsx），互不打架。
import { useEffect, useState } from 'react';
import { ManagePage } from './manage.jsx';
import { WorkbenchPage } from './workbench.jsx';
import { AssetZipIoBtns } from './zip-io.jsx';
import { useStore } from '../../store.jsx';

// 用「一资源一目录三件套」zip 约定（core/assets/set.js）的 kind——目前只有 html。
// svg 的平铺单文件约定由 SvgDrive 自己接（components/svg/zip-io.jsx），两条约定
// 服务端不同，前端各配各的 strategy 子组件，不做成一个通用件猜 kind。
const ZIP_IO_KINDS = ['html'];

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

export function AssetView({ kind }) {
  const [route, setRoute] = useState(() => parseRoute(kind, typeof location !== 'undefined' ? location.hash : ''));
  const { boot } = useStore();
  const bin = boot?.app?.name || 'nx-ft';

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
  // 领域扩展插槽：html 域在这里挂 zip 导入 / 导出（goManage 之外的页面级动作）。
  // 导入的默认分组 / 导出的作用域 = 当前（= 侧边栏高亮）目录；根路由 = 全库。
  const ioGroup = route.mode === 'edit' ? route.group : route.dir || '';
  const toolbar = ZIP_IO_KINDS.includes(kind)
    ? (reload) => <AssetZipIoBtns kind={kind} bin={bin} group={ioGroup} onDone={reload} />
    : undefined;
  return (
    <ManagePage
      kind={kind}
      initialDir={route.dir}
      onOpen={openAsset}
      onNavigate={goManage}
      toolbar={toolbar}
    />
  );
}
