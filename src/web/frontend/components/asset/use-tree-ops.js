// 资产侧边栏的变更操作（新建、改名 / 移动、删除、拖拽换层级与排序、资源换分组）。
//
// 全部是「命令」：入参来自 UI，出参是 API 调用 + toast + 两棵树的重取。
// 状态不在这里——groups / currentDir / selectedKey 由调用方（AssetSidebar）持有，
// 这里只拿引用；变更完成后通过 goDir（跳转，hash 一变两边都刷新）
// 与 refresh（不跳转的变更：删除未选中目录、同级排序）回传。
//
// 拖拽的上报形状见 sidebar/drag.jsx：target = { node, mode } 或 { root: true }，
//   mode = 'into'（放进目录 / 回到最外层）| 'before' | 'after'（同级排序）。
import { api } from '../../api/client.js';
import { useDialog, useGuard, useToast } from '../ui.jsx';
import { notifyTreeChanged } from './tree-signal.js';
import { buildTree, findNode } from './tree.jsx';
import { relOfKey } from './tree-keys.js';

// 根层资源的保留分组（与 ManagePage 建资源同一约定：根层资源住「未分类」）
export const HOME_DIR = '未分类';

export function useTreeOps({ kind, groups, currentDir, selectedKey, goDir, refresh }) {
  const toast = useToast();
  const guard = useGuard();
  const { dialog, node: dlgNode } = useDialog();

  // 新建：落在当前目录下（没选中 = 根），建完跳进去
  const createAtSelected = (name) =>
    guard(async () => {
      const path = [currentDir, name].filter(Boolean).join('/');
      await api(`/api/${kind}/groups`, { method: 'POST', body: { group: path } });
      toast(`已创建目录 ${path}`);
      refresh();
      goDir(path);
    });

  const renameDir = (node) => {
    const rel = relOfKey(node.path);
    dialog({
      title: `重命名 / 移动 ${rel}`,
      message: '改路径 = 整个目录挪过去（含资源与子分组）。',
      input: true,
      value: rel,
      placeholder: 'ui/icons/nav',
      okText: '确定',
    }).then((to) => {
      if (!to || to === rel) return;
      guard(async () => {
        const r = await api(`/api/${kind}/groups-rename`, {
          method: 'POST',
          body: { group: rel, to, label: to.split('/').pop() },
        });
        if (r.status === 'blocked') {
          toast.bad(`没改成：${r.reason}`);
          return;
        }
        toast(`已移动: ${rel} → ${r.path || to}`);
        refresh();
        goDir(r.path || to);
      });
    });
  };

  const removeDir = (node) => {
    const rel = relOfKey(node.path);
    dialog({
      title: `删除目录 ${rel}？`,
      message: '目录内的资源、子目录、风格与历史会全部删除（非空需确认），不可恢复。',
      okText: '连同内容一起删除',
      danger: true,
    }).then((ok) => {
      if (!ok) return;
      guard(async () => {
        await api(`/api/${kind}/groups-remove`, { method: 'POST', body: { group: rel, force: true } });
        toast('已删除目录: ' + rel);
        // 删的是当前所在（或其祖先）→ 退回上一级，靠 hashchange 让两边都刷新；
        // 否则停在原地，必须喊信号——内容区（另一棵树）不会知道目录没了。
        // 建目录/改名都伴随跳转，故那两处不需要喊。
        if (currentDir === rel || currentDir.startsWith(rel + '/')) {
          goDir(rel.split('/').slice(0, -1).join('/'));
        } else {
          notifyTreeChanged();
        }
        refresh();
      });
    });
  };

  const moveDir = ({ node, target }) => {
    const rel = relOfKey(node.path);
    const name = rel.split('/').pop();

    // 同级排序（前后插）：before/after 只在「与拖拽源同一父级」时出现
    // （判定在 sidebar/drag.jsx 的 resolve），交给 groups-reorder 重排该层级；
    // 拖拽源路径不变（key 稳定 → 高亮不跳），变化的只有位次。
    if (target.mode === 'before' || target.mode === 'after') {
      const targetRel = relOfKey(target.node.path);
      const parentRel = rel.split('/').slice(0, -1).join('');
      const parentNode = parentRel ? findNode(buildTree(groups), parentRel) : buildTree(groups);
      if (!parentNode) return;
      const order = parentNode.children.map((c) => c.path);
      const from = order.indexOf(rel);
      const at = order.indexOf(targetRel);
      if (from < 0 || at < 0 || from === at) return;
      order.splice(from, 1);
      order.splice(Math.max(0, at + (target.mode === 'after' ? 1 : 0)), 0, rel);
      guard(async () => {
        await api(`/api/${kind}/groups-reorder`, { method: 'POST', body: { parent: parentRel, order } });
        refresh();
      });
      return;
    }

    // 放进某目录 / 拖回最外层：groups-rename 就是「移动」这一件事
    const intoRoot = target.root || target.node.kind === 'root';
    const targetDir = intoRoot ? '' : relOfKey(target.node.path);
    const to = [targetDir, name].filter(Boolean).join('/');
    if (to === rel) return; // 拖回原位：静默（不是错误）
    // 目标里已有同名目录：先在本地拦（省一次往返，提示也更准）。
    // 只比目录——资源可以跟目录同名（两个命名空间）。
    if ((target.node.children || []).some((c) => c.kind === 'dir' && c.name === node.name)) {
      toast.bad(`没移成：${targetDir || '最外层'} 里已有同名目录`);
      return;
    }
    guard(async () => {
      const r = await api(`/api/${kind}/groups-rename`, {
        method: 'POST',
        body: { group: rel, to, label: name },
      });
      if (r.status === 'blocked') {
        toast.bad(`没移成：${r.reason}`);
        return;
      }
      toast(`已移动: ${rel} → ${to}`);
      refresh();
      // 挪的是当前所在（或其祖先）→ 跟到新路径，别把「我在哪」留在旧地址上
      if (currentDir === rel || currentDir.startsWith(rel + '/')) goDir(r.path || to);
    });
  };

  // 资源行拖拽：拖到某目录（或整树行/空白 → 「未分类」）= 换分组。
  // 与工具区「新建资源」同一套约定：根层资源住在保留分组「未分类」里。
  // 目标分组不存在时顺手建（与目录拖拽的宽容度一致）。
  // 挪的是当前打开（选中）的资源 → 跟到新地址，别让开着的编辑器往旧路径写回。
  const moveAssetRow = ({ node, target }) => {
    const rel = relOfKey(node.path);
    const name = rel.split('/').pop();
    const fromGroup = rel.split('/').slice(0, -1).join('/');
    const intoRoot = target.root || target.node.kind === 'root';
    const toGroup = intoRoot ? HOME_DIR : relOfKey(target.node.path);
    if (fromGroup === toGroup) return;
    guard(async () => {
      if (!(groups || []).some((g) => g.path === toGroup)) {
        await api(`/api/${kind}/groups`, { method: 'POST', body: { group: toGroup } });
      }
      const r = await api(`/api/${kind}/asset-move`, {
        method: 'POST',
        body: { group: fromGroup, name, to: toGroup },
      });
      toast(`已移动: ${fromGroup}/${name} → ${toGroup}`);
      if (selectedKey === node.key) {
        location.hash = `#/${kind}/edit/${toGroup.split('/').map(encodeURIComponent).join('/')}/${encodeURIComponent(name)}`;
      }
      refresh();
      return r;
    });
  };

  // 统一的拖拽上报：目录走层级/排序，资源走换分组
  const onMoveRow = ({ node, target }) => {
    if (node.kind === 'asset') return moveAssetRow({ node, target });
    return moveDir({ node, target });
  };

  return { createAtSelected, renameDir, removeDir, moveDir, moveAssetRow, onMoveRow, dlgNode };
}
