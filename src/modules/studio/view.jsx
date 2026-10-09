// studio 模块的 React 视图：面板打开时第一个 tab。
//
// 它示范三件事，照着改就能长自己的面板：
//   1. 数据从 /api 拉（不是硬编码），失败有兜底
//   2. 每个 Web 操作都配一行等价的 CLI 命令，两端不会分叉
//   3. 用 .card / .row / .tag 这些原子类，不自己写样式
import { useEffect, useState } from 'react';
import { api } from '../../studio/api/client.js';
import { CliHints } from '../../studio/components/CliHints.jsx';
import { useStore } from '../../studio/store.jsx';

export default function StudioHome() {
  const { boot } = useStore();
  const [routes, setRoutes] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/api/routes')
      .then(setRoutes)
      .catch((e) => setErr(String(e.message || e)));
  }, []);

  if (err) return <div className="empty bad">接口调用失败：{err}</div>;

  const lib = boot?.library || { components: 0, styles: 0 };

  return (
    <div className="stack">
      <div className="card">
        <div className="colhead">库概览</div>
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
            <dt>组件</dt>
            <dd>
              <span className="tag">{lib.components}</span>
              <span className="muted" style={{ marginLeft: 8 }}>件</span>
            </dd>
          </div>
          <div className="kv-row">
            <dt>风格包</dt>
            <dd>
              <span className="tag">{lib.styles}</span>
              <span className="muted" style={{ marginLeft: 8 }}>个（tokens × 方言正交）</span>
            </dd>
          </div>
          <div className="kv-row">
            <dt>存储</dt>
            <dd className="mono nowrap">{boot?.storePath || '—'}</dd>
          </div>
        </dl>
      </div>

      <div className="card">
        <div className="colhead">
          <span>CLI 命令与 HTTP 路由（同源）</span>
          <span className="tag">{routes ? routes.count : '…'} 条</span>
        </div>
        {(routes?.routes || []).map((r) => (
          <div key={r.id} className="row">
            <div className="name mono">{r.cli}</div>
            <div className="desc mono muted">{r.http || '(仅 CLI)'}</div>
            <div className="acts">
              <span className="tag">{r.module}</span>
            </div>
          </div>
        ))}
        {routes && !routes.routes.length && <div className="empty">暂无命令</div>}
        <CliHints command="{name} routes" note="这两张表由同一份 action 声明派生" />
      </div>

      <div className="card">
        <div className="colhead">Agent I/O 入口</div>
        <div className="row">
          <div className="name mono">GET /api/studio/manifest[?style=paper]</div>
          <div className="desc muted">机器可读清单——agent 一个请求摸清整库（多包聚合，每个组件带 pack 字段）</div>
        </div>
        <div className="row">
          <div className="name mono">{`GET /api/studio/component/<id>?style=paper&tokens=light`}</div>
          <div className="desc muted">单件深读：spec + 该 pack 的 css + 继承自 extends 链的 React 绑定</div>
        </div>
        <div className="row">
          <div className="name mono">GET /api/studio/packs</div>
          <div className="desc muted">已安装风格包清单（含 extends 关系）</div>
        </div>
        <div className="row">
          <div className="name mono">{`GET /api/studio/preview/<id>?style=paper`}</div>
          <div className="desc muted">渲染好的自包含 HTML 片段（无浏览器依赖）</div>
        </div>
        <CliHints command="{name} skill install" note="离线通道：把库的契约与用法装给本机 agent" />
      </div>
    </div>
  );
}
