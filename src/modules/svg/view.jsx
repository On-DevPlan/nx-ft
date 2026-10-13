// SVG 面板路由：三层页面，**沿用资产域同一套 URL 词汇**（见 components/asset/index.jsx）：
//   #/svg                               → 网盘页（根目录，面包屑 + 内联创建，与 html 同一套）
//   #/svg/dir/<分组路径>                 → 网盘页（当前目录内容）
//   #/svg/edit/<分组路径>/<图标名>        → 资源页（对应 edit：改这一枚）
//   #/svg/edit/<分组路径>/<图标名>/full   → 整页预览（本域扩展：放大核对线帽与网格）
//
// 看板/分组页合并为同一组件的历史理由不变：本来就是「当前目录」一件事。
// 现在换成与 html 一致的网盘布局（ManagePage），svg 特有的批量动作走 toolbar 插槽。
import { useEffect, useState } from 'react';
import Detail from '../../web/frontend/components/svg/detail.jsx';
import FullScreen from '../../web/frontend/components/svg/fullscreen.jsx';
import { SvgDrive } from '../../web/frontend/components/svg/drive.jsx';

const dec = (s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

// 资源名恒为最后一段（名字不含 /），其余段拼回分组路径（1~8 段）。
// `full` 只在「去掉它之后还剩 group + name 两段」时才算关键字——
// 否则 `#/svg/edit/ui/full` 里那枚叫 full 的图标就永远打不开了。
export function parseSvgRoute(hash) {
  const segs = String(hash ?? '')
    .replace(/^#\/?/, '')
    .split('/')
    .filter(Boolean)
    .map(dec);

  if (segs[0] !== 'svg') return { view: 'board' };

  if (segs[1] === 'dir' && segs.length >= 3) {
    return { view: 'group', group: segs.slice(2).join('/') };
  }

  if (segs[1] === 'edit' && segs.length >= 4) {
    const rest = segs.slice(2);
    const hasFull = rest.length >= 3 && rest[rest.length - 1] === 'full';
    const cut = rest.length - (hasFull ? 2 : 1);
    const group = rest.slice(0, cut).join('/');
    const name = rest[cut];
    if (group && name) {
      return hasFull ? { view: 'full', group, name } : { view: 'asset', group, name };
    }
  }

  return { view: 'board' };
}

export default function SvgView() {
  const [route, setRoute] = useState(() =>
    parseSvgRoute(typeof location !== 'undefined' ? location.hash : '')
  );

  useEffect(() => {
    const onHash = () => setRoute(parseSvgRoute(location.hash));
    window.addEventListener('hashchange', onHash);
    onHash();
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (route.view === 'full') {
    return <FullScreen key={`${route.group}/${route.name}`} group={route.group} name={route.name} />;
  }
  if (route.view === 'asset') {
    return <Detail key={`${route.group}/${route.name}`} group={route.group} name={route.name} />;
  }
  return <SvgDrive path={route.group || ''} />;
}
