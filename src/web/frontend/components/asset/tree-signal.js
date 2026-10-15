// 资源树变更信号：分组/资源的增删改完成后喊一声，让**另一棵组件树**也重取。
//
// 为什么需要：内容区（管理页）与侧边栏各持一份 /api/<kind>/tree，各自独立重取
// （内容区挂 hash / 筛选变化，侧边栏挂 hash / 窗口回焦）。少了这个信号，
// 「面板里导入一批资源」只会刷新内容区，侧边栏要等下一次跳转才跟上——
// 表现就是「库里有，树上没有」。
//
// 用 DOM 事件而不是共享 state：两者不在同一棵树里（侧边栏由壳层渲染），
// 走 window 的事件是零依赖、不动 Provider 的通路。事件不带数据，只当「该重取了」的铃，
// 谁听到谁自己拉最新——避免把树数据复制到第三个地方。
const EVENT = 'nx-ft:tree-changed';

export function notifyTreeChanged() {
  window.dispatchEvent(new Event(EVENT));
}

// 返回退订函数（直接作为 useEffect 的清理用）
export function onTreeChanged(fn) {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
