// 色彩资源面板路由:
//   #/color                            → 网盘页 (管理分组/资源)
//   #/color/edit/<g>/<p>               → 工作台 (DATA 槽位 JSON 编辑 + swatch 预览)
//   #/color/edit/<g>/<p>/full          → 全屏 ColorStudio (强制 fixed:inset:0,1:1 复刻)
//
// 全屏页用 src/web/frontend/external/color-studio/index.jsx 默认导出的 <ColorStudio />,
// 通过 URL 的 ?group=<g> 告诉 store 哪个分组作为 doc 容器(避免硬编码)。
import { useEffect, useState } from 'react';
import { AssetView } from '../../web/frontend/components/asset/index.jsx';
import { ColorStudioFullscreen } from '../../web/frontend/external/color-studio/index.jsx';
import { EmptyColorState } from '../../web/frontend/external/color-studio/components/EmptyColorState.jsx';
import { useToast } from '../../web/frontend/components/ui.jsx';

function parseRoute(hash) {
  const h = String(hash ?? '').replace(/^#\/?/, '');
  // 每段要去掉可能的 ?query 后缀(URL 把 ?view=... 拼在 # 后面)
  const segs = h.split('/').filter(Boolean).map((s) => s.split('?')[0]);
  if (segs[0] !== 'color') return { mode: 'manage' };
  if (segs[1] === 'edit' && segs.length >= 4) {
    const name = segs[segs.length - 1];
    const group = segs.slice(2, -1).join('/');
    if (segs[segs.length - 1] === 'full' && segs.length >= 5) {
      return { mode: 'full', group: segs.slice(2, -2).join('/'), name: segs[segs.length - 2] };
    }
    if (group && name) return { mode: 'edit', group, name };
  }
  if (segs[1] === 'dir' && segs.length >= 3) {
    return { mode: 'manage', dir: segs.slice(2).join('/') };
  }
  return { mode: 'manage' };
}

export default function ColorView() {
  const [route, setRoute] = useState(() => parseRoute(typeof location !== 'undefined' ? location.hash : ''));
  const toast = useToast();

  useEffect(() => {
    const onHash = () => setRoute(parseRoute(location.hash));
    window.addEventListener('hashchange', onHash);
    onHash();
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (route.mode === 'full') {
    return <ColorStudioFullscreen key={`${route.group}/${route.name}`} group={route.group} name={route.name} />;
  }

  // 打开全屏 Studio:动态从树里找第一个有 palette 的组,找不到就 toast 提示
  const openStudio = async () => {
    try {
      const res = await fetch('/api/color/tree?search=&tags=');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const env = await res.json();
      const tree = env.data || env;
      for (const g of tree.groups || []) {
        if (g.assets && g.assets.length) {
          const first = g.assets[0].name;
          location.hash = `#/color/edit/${encodeURIComponent(g.path)}/${encodeURIComponent(first)}/full`;
          return;
        }
      }
    } catch (e) {
      toast(`打开 Studio 失败: ${e?.message ?? e}\n请确认 7869 后端是否启动`);
      return;
    }
    toast('还没有调色板 — 请先在网盘新建一个,或从 CLI 导入。');
  };

  return (
    <AssetView
      kind="color"
      emptyState={<EmptyColorState />}
      toolbar={() => (
        <div className="am-tools" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn small primary"
            onClick={openStudio}
            title="打开全屏 ColorStudio(色盘 / 比例 / 笔刷 三视图,1:1 复刻自 ve 项目)"
            data-testid="open-color-studio"
          >
            打开全屏 Studio →
          </button>
        </div>
      )}
    />
  );
}
