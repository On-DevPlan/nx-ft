// 侧边栏的拖拽换层级：状态机 + 「能不能放进」的判据。
//
// 组件（index.jsx）不认识「移到哪」的语义——这里只产出四个 handler，
// 把「谁被拖到了谁身上」上报给调用方（onMove({ node, target })，
// target 为 { node } 或 { root: true }）；最终路径怎么拼、调哪个接口，全在调用方。
//
// 放独立文件是为了给 index.jsx 留行数余量（300 行闸门），顺带让这套状态机
// 自成一块：NodeRow 通过 useDrag() 读它，不必逐层透传四个 handler。
import { createContext, useContext } from 'react';

export const DragCtx = createContext(null);

export function useDrag() {
  return useContext(DragCtx);
}

// 能不能把 a 放进 b：不能放自己，也不能放进自己的后代。
// key/path 都带「前缀即子树」的形状（`dir:<kind>:<路径>`），前缀一比就是答案。
export function canDropInto(a, b) {
  if (!a || !b || a.key === b.key) return false;
  return !String(b.path).startsWith(String(a.path) + '/');
}

// 造 handler 组。不传 onMove 时返回 null —— 调用方据此完全不渲染拖拽属性。
// node 传 null 表示「落在根一级」（标题行 / 树的空白处）。
//
// 拖拽源同时存 ref 与 state：**判定逻辑只读 ref**，state 只用来画高亮。
// 只读 state 的话，dragstart → dragover 落在同一帧时 handler 闭包里还是旧值
// （React 尚未重渲染），逻辑会整段失效——真实拖拽有帧间隔碰不到，
// 但让「能不能放下」依赖中间恰好重渲染一次，是把正确性押在时序上。
// 是否同一父级：同级才能用「前后插入」的排序落点
const sameParent = (p1, p2) => p1.slice(0, p1.lastIndexOf('/')) === p2.slice(0, p2.lastIndexOf('/'));

export function makeDragApi({ dragRef, dropKey, setDropKey, onMove }) {
  if (!onMove) return null;
  const current = () => dragRef.current;
  // 落点判定：返回 { dropKey, payload } 或 null（不接受的落点）。
  //   整树行 / 空白         → 回到最外层（root）
  //   目录行的中间 40%      → 放进该目录（into）
  //   目录行的上/下边缘     → 排到它前/后（仅限同级拖拽；跨层一律 into——
  //     让指示线永远等于真实结果，不做落地后才修正的假提示）
  const resolve = (node, e) => {
    const from = current();
    if (!from) return null;
    if (!node) return { dropKey: 'root', payload: { root: true } };
    if (!canDropInto(from, node)) return null;
    if (sameParent(from.path, node.path) && node.kind === 'dir') {
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = rect.height ? (e.clientY - rect.top) / rect.height : 0.5;
      if (e.currentTarget.dataset) {
        e.currentTarget.dataset.ratio = ratio.toFixed(3);
        e.currentTarget.dataset.cy = String(e.clientY);
        e.currentTarget.dataset.rt = rect.top.toFixed(1);
      }
      if (ratio < 0.3) return { dropKey: node.key + '|before', payload: { node, mode: 'before' } };
      if (ratio > 0.7) return { dropKey: node.key + '|after', payload: { node, mode: 'after' } };
    }
    return { dropKey: node.key + '|into', payload: { node, mode: 'into' } };
  };

  return {
    dropKey, // 行高亮读它（漏了这个字段，落点描边就永远不出现——真踩过）
    start: (node, e) => {
      dragRef.current = node;
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        // Firefox 不 setData 就不算开始拖（Chrome 无所谓），一行的事
        e.dataTransfer.setData('text/plain', node.key);
      }
    },
    over: (node, e) => {
      const hit = resolve(node, e);
      if (!hit) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      setDropKey(hit.dropKey);
    },
    leave: (key) => setDropKey((k) => (k === key ? null : k)),
    drop: (node, e) => {
      const hit = resolve(node, e);
      if (!hit) return;
      e.preventDefault();
      const from = current();
      dragRef.current = null;
      setDropKey(null);
      onMove({ node: from, target: hit.payload });
    },
    end: () => {
      dragRef.current = null;
      setDropKey(null);
    },
  };
}
