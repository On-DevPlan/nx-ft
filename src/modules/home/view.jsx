// 首页：项目信息 + 资源概览。落地页保持简洁——面板内不展示 CLI 相关内容。
import { useEffect, useState } from 'react';
import { api } from '../../web/frontend/api/client.js';
import { useStore } from '../../web/frontend/store.jsx';

export default function HomeView() {
  const { boot, patchUi } = useStore();
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.all([api('/api/html/tree'), api('/api/svg/tree')])
      .then(([h, s]) => setStats({ html: h.count, svg: s.count }))
      .catch((e) => setErr(String(e.message || e)));
  }, []);

  if (err) return <div className="empty bad">接口调用失败：{err}</div>;

  return (
    <div className="stack">
      <div className="card">
        <div className="colhead">项目信息</div>
        <dl className="kv">
          <div className="kv-row">
            <dt>名称</dt>
            <dd className="mono">{boot?.app?.name || '—'}</dd>
          </div>
          <div className="kv-row">
            <dt>版本</dt>
            <dd className="mono">{boot?.app?.version || '—'}</dd>
          </div>
          <div className="kv-row">
            <dt>存储</dt>
            <dd className="mono nowrap">{boot?.storePath || '—'}</dd>
          </div>
          <div className="kv-row">
            <dt>默认路径</dt>
            <dd className="mono nowrap">{boot?.storeDefault || '—'}</dd>
          </div>
        </dl>
      </div>

      <div className="card">
        <div className="colhead">资源概览</div>
        <button className="row home-entry" onClick={() => patchUi({ view: 'html' })}>
          <span className="name">HTML 资源</span>
          <span className="desc muted">
            {stats ? `${stats.html.groups} 个分组 · ${stats.html.assets} 个资源` : '加载中…'}
          </span>
          <span className="acts"><span className="tag">打开</span></span>
        </button>
        <button className="row home-entry" onClick={() => patchUi({ view: 'svg' })}>
          <span className="name">SVG 资源</span>
          <span className="desc muted">
            {stats ? `${stats.svg.groups} 个分组 · ${stats.svg.assets} 个资源` : '加载中…'}
          </span>
          <span className="acts"><span className="tag">打开</span></span>
        </button>
      </div>
    </div>
  );
}
