// FlutterPlayground：单 Flutter iframe，与父页面 postMessage 通信。
//
// 时序（关键）：Flutter 的 Dart main() 是异步引导的——iframe onLoad 时它还没注册
// message listener，此时 postMessage 会丢。所以走握手：
//   1. iframe src 冻结在挂载时刻（带首屏路由）→ Flutter 自身解析 URL 先出画面；
//      **此后 src 永不改变**——切组件/变体只改 postMessage，引擎零重载。
//   2. Flutter 注册完 listener 主动 postMessage {type:'ready'}
//   3. 父页面收到 ready 后才开始发 {type:'render', payload:{component, props}}
import { useEffect, useRef, useState } from 'react';

export default function FlutterPlayground({ registry, height = 300 }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);

  // src 只取挂载那一刻的组件（组件切换靠 postMessage，不能改 src——改 src = 重载引擎）
  const initialSrc = useRef(
    `${registry.preview?.entry || '/flutter/'}#/preview/${registry.id}?variant=primary&size=md`
  ).current;

  // 2. 监听 Flutter 的 ready
  useEffect(() => {
    const onMsg = (e) => {
      if (e?.data?.type === 'ready') setReady(true);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // 3/4. ready 后推当前组件状态；组件切换时再推（src 不变）
  useEffect(() => {
    if (!ready || !ref.current?.contentWindow) return;
    ref.current.contentWindow.postMessage({
      type: 'render',
      payload: {
        component: registry.id,
        props: { variant: 'primary', size: 'md', disabled: 'false' },
      },
    }, '*');
  }, [ready, registry.id]);

  return (
    <iframe
      ref={ref}
      title={`flutter-${registry.id}`}
      onLoad={() => setReady(false) /* 若真发生重载（src 变/用户刷新），重新握手 */}
      src={initialSrc}
      style={{ width: '100%', height, border: 0, display: 'block', background: '#fff' }}
    />
  );
}
