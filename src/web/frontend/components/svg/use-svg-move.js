// 把 TreePanel 的「from/target/mode」拖拽语义翻译成 svg 后端命令：
//   before/after = 同级前后插 → ops.reorderGroups（整层全量新序，避免「向后拖插到队尾」的老坑）
//   into = 挪进目标目录 → groups-rename（to = target/name）
// 失败静默到 console（caller 一般通过 onTreeChanged 触发 reload 拉新数据）。
import { useCallback } from 'react';
import { api } from '../../api/client.js';

export function useSvgMove(root, ops) {
  return useCallback(async (from, target, mode) => {
    if (mode === 'before' || mode === 'after') {
      const parent = from.includes('/') ? from.split('/').slice(0, -1).join('/') : '';
      const siblings = root.children
        .filter((c) => (parent
          ? c.path.startsWith(parent + '/') && c.path.split('/').length === parent.split('/').length + 1
          : !c.path.includes('/')))
        .map((c) => c.path)
        .filter((p) => p !== from);
      const at = siblings.indexOf(target);
      if (at < 0) return;
      siblings.splice(at + (mode === 'after' ? 1 : 0), 0, from);
      await ops.reorderGroups(parent, siblings);
      return;
    }
    if (mode === 'into') {
      const name = from.split('/').pop();
      const to = target ? target + '/' + name : name;
      if (to === from) return;
      await api(`/api/svg/groups-rename`, {
        method: 'POST',
        body: { group: from, to, label: name },
      }).catch(() => {});
    }
  }, [root, ops]);
}
