// FlutterPlayground：单 Flutter iframe，与父页面 postMessage 通信。
//
// 时序（关键）：Flutter 的 Dart main() 是异步引导的——iframe onLoad 时它还没注册
// message listener，此时 postMessage 会丢。所以走握手：
//   1. iframe src 冻结在挂载时刻（带首屏路由）→ Flutter 自身解析 URL 先出画面；
//      **此后 src 永不改变**——切组件/变体只改 postMessage，引擎零重载。
//   2. Flutter 注册完 listener 主动 postMessage {type:'ready'}
//   3. 父页面收到 ready 后才开始发 {type:'render', payload:{component, title, props}}
//
// 控件条：从 registry spec.props 生成——enum → 按钮组、boolean → 开关，
// 任何状态变化都 postMessage 下发（Dart 端 setState，引擎零重载）。
// registry 无 enum/boolean prop 时不出控件条，行为退回纯展示。
import { useEffect, useRef, useState } from 'react';

// spec.props → 控件初始值：enum 取 default ?? 首个 value，boolean 转 'true'/'false'
// 字符串（与 URL 协议和 Dart 端 `p['x'] == 'true'` 的解析同构）。
function initialProps(props) {
  const out = {};
  for (const [name, p] of Object.entries(props || {})) {
    if (p.type === 'enum') out[name] = p.default ?? p.values?.[0] ?? '';
    else if (p.type === 'boolean') out[name] = String(p.default ?? false);
  }
  return out;
}

export default function FlutterPlayground({ registry, height = 300 }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);

  // 控件状态 = spec 默认值 + 用户覆盖。组件切换时渲染期重置覆盖
  // （React 官方的「props 变化时调整 state」模式，避免 effect 时序竞态）。
  const [prevId, setPrevId] = useState(registry.id);
  const [overrides, setOverrides] = useState({});
  if (prevId !== registry.id) {
    setPrevId(registry.id);
    setOverrides({});
  }
  const vals = { ...initialProps(registry.props), ...overrides };

  // src 只取挂载那一刻的组件与默认 props（组件切换靠 postMessage，不能改 src——
  // 改 src = 重载引擎）。title 进 URL：深链/书签直接打开也有正确 label。
  const initialSrc = useRef(
    `${registry.preview?.entry || '/flutter/'}#/preview/${registry.id}?${new URLSearchParams({ ...vals, title: registry.title })}`
  ).current;

  // 2. 监听 Flutter 的 ready
  useEffect(() => {
    const onMsg = (e) => {
      if (e?.data?.type === 'ready') setReady(true);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // 3/4. ready 后推当前控件状态；组件/变体切换时再推（src 不变）
  useEffect(() => {
    if (!ready || !ref.current?.contentWindow) return;
    ref.current.contentWindow.postMessage({
      type: 'render',
      payload: { component: registry.id, title: registry.title, props: vals },
    }, '*');
  }, [ready, registry.id, registry.title, vals]);

  // 控件条：只收 enum / boolean（string 控件留待有真实需求再加）
  const controls = Object.entries(registry.props || {}).filter(
    ([, p]) => p.type === 'enum' || p.type === 'boolean'
  );

  return (
    <div>
      {controls.length > 0 && (
        <div
          style={{
            display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
            padding: '8px 10px', borderBottom: '1px solid var(--soft-2, #ebedf0)',
          }}
        >
          {controls.map(([name, p]) => (
            <span key={name} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
              <span className="muted" style={{ fontSize: 11 }}>{name}</span>
              {p.type === 'enum' ? p.values.map((v) => (
                <button
                  key={v}
                  className={'btn small' + (vals[name] === v ? '' : ' ghost')}
                  onClick={() => setOverrides((o) => ({ ...o, [name]: v }))}
                >
                  {v}
                </button>
              )) : (
                <button
                  className={'btn small' + (vals[name] === 'true' ? '' : ' ghost')}
                  onClick={() => setOverrides((o) => ({ ...o, [name]: vals[name] === 'true' ? 'false' : 'true' }))}
                >
                  {name}={vals[name]}
                </button>
              )}
            </span>
          ))}
          {!ready && <span className="muted" style={{ fontSize: 11, marginLeft: 'auto' }}>Flutter 引擎引导中…</span>}
        </div>
      )}
      <iframe
        ref={ref}
        title={`flutter-${registry.id}`}
        onLoad={() => setReady(false) /* 若真发生重载（src 变/用户刷新），重新握手 */}
        src={initialSrc}
        style={{ width: '100%', height, border: 0, display: 'block', background: '#fff' }}
      />
    </div>
  );
}
