// SVG 面板路由：四层页面，**沿用资产域同一套 URL 词汇**（见 components/asset/index.jsx）：
//   #/svg                               → 看板（对应资产域的「管理页」）
//   #/svg/dir/<分组路径>                 → 分组页（对应 dir：定位到某个目录）
//   #/svg/edit/<分组路径>/<图标名>        → 资源页（对应 edit：进工作台改这一个）
//   #/svg/edit/<分组路径>/<图标名>/full   → 整页预览（本域扩展：放大核对线帽与网格）
//
// 为什么和资产域共用 dir/edit 而不是自造一套：用户在 html 与 svg 两个 tab 之间来回切，
// 两套 URL 形状意味着他得记两遍；而 dir/edit 的语义在这里完全成立。只多了一个后缀 full。
//
// 路由解析放在视图里（与 AssetView 一致），面板壳只取 hash 首段判视图、不下发 route——
// 这样同一个 tab 内的跳转不会被壳重写掉。
import { useEffect, useState } from 'react';
import Board from '../../web/frontend/components/svg/board.jsx';
import Detail from '../../web/frontend/components/svg/detail.jsx';
import FullScreen from '../../web/frontend/components/svg/fullscreen.jsx';
import Group from '../../web/frontend/components/svg/group.jsx';

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

  if (route.view === 'group') return <Group path={route.group} />;
  if (route.view === 'full') {
    return <FullScreen key={`${route.group}/${route.name}`} group={route.group} name={route.name} />;
  }
  if (route.view === 'asset') {
    return <Detail key={`${route.group}/${route.name}`} group={route.group} name={route.name} />;
  }
  return <Board />;
}
