// 编辑区默认布局的落盘：用户显式「设为默认」才写；打开任意同 layoutKey 资源时读。
// 与「拖动过程不自动持久化」不冲突——只有这一个入口会写 localStorage。
import { snapshotLayout, layoutFromSnapshot } from './panel-layout.js';

const keyOf = (kind) => `nx-ft-wb-layout-${kind}`;

export function loadDefaultLayout(kind, slots) {
  try {
    const raw = localStorage.getItem(keyOf(kind));
    if (!raw) return null;
    return layoutFromSnapshot(JSON.parse(raw), slots);
  } catch {
    return null;
  }
}

export function saveDefaultLayout(kind, state) {
  try {
    localStorage.setItem(keyOf(kind), JSON.stringify(snapshotLayout(state)));
    return true;
  } catch {
    return false;
  }
}
