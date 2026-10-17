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
import { buildTree, byOrder, findNode } from './tree.jsx';
import { relOfKey } from './tree-keys.js';
import { useZipIo } from './use-zip-io.jsx';
import { useTreeCreate } from './use-tree-create.js';

// 根层资源的保留分组（与 ManagePage 建资源同一约定：根层资源住「未分类」）
export const HOME_DIR = '未分类';

export function useTreeOps({ kind, groups, currentDir, selectedKey, goDir, refresh }) {
  const toast = useToast();
  const guard = useGuard();
  const { dialog, node: dlgNode } = useDialog();

  // 局部导入导出：右键目录时，目标分组锁定为该目录（命令式，见 use-zip-io.js）
  const { importToGroup, exportGroup, node: zipNode } = useZipIo(kind, { onChanged: refresh });
  const importToDir = (node) => importToGroup(relOfKey(node.path));
  const exportDirRow = (node) => exportGroup(relOfKey(node.path));

  // 新建命令（当前目录 / 右键目录建文件夹、右键目录建资源）：自成一簇，见 use-tree-create.js
  const { createAtSelected, createSubDir, createAssetInDir } = useTreeCreate({
    kind,
    currentDir,
    goDir,
    refresh,
    dialog,
    guard,
    toast,
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
    // 注意先把拖拽源从数组里拿掉、再在**新数组**里找目标位次——直接用旧索引
    // 会把「向后拖」插到队尾（from 之后的索引因 splice 左移了一格）。
    if (target.mode === 'before' || target.mode === 'after') {
      const targetRel = relOfKey(target.node.path);
      const parentRel = rel.split('/').slice(0, -1).join('');
      const parentNode = parentRel ? findNode(buildTree(groups), parentRel) : buildTree(groups);
      if (!parentNode) return;
      const order = parentNode.children.map((c) => c.path).filter((p) => p !== rel);
      const at = order.indexOf(targetRel);
      if (at < 0) return;
      order.splice(at + (target.mode === 'after' ? 1 : 0), 0, rel);
      guard(async () => {
        await api(`/api/${kind}/groups-reorder`, { method: 'POST', body: { parent: parentRel, order } });
        refresh();
      });
      return;
    }

    // 空白处 = 拖到自己当前同层末尾（不换父级；与 before/after 共用 groups-reorder，
    // order 末尾追加即可——视觉上像「拖到最后一格下方」）
    if (target.tail) {
      const parentRel = rel.split('/').slice(0, -1).join('');
      const parentNode = parentRel ? findNode(buildTree(groups), parentRel) : buildTree(groups);
      if (!parentNode) return;
      const siblings = parentNode.children.map((c) => c.path);
      // 已在末位就不发请求（避免无谓刷新）——判在移除 rel 之前，
      // 否则 rel 已被 filter 掉，这条永远不成立
      if (siblings[siblings.length - 1] === rel) return;
      const order = siblings.filter((p) => p !== rel);
      order.push(rel);
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

    // 同组排序（前后插）：与目录同级排序同构——按当前可见序组成全量新顺序，
    // 整组提交给 asset-reorder（根层资源住在「未分类」）。资源路径不变
    // （key 稳定 → 高亮不跳），变化的只有位次。
    if (target.mode === 'before' || target.mode === 'after') {
      const group = (groups || []).find((g) => g.path === fromGroup);
      if (!group) return;
      const targetName = relOfKey(target.node.path).split('/').pop();
      const order = (group.assets || [])
        .slice()
        .sort(byOrder)
        .map((a) => a.name)
        .filter((n) => n !== name);
      const at = order.indexOf(targetName);
      if (at < 0) return;
      order.splice(at + (target.mode === 'after' ? 1 : 0), 0, name);
      guard(async () => {
        await api(`/api/${kind}/asset-reorder`, {
          method: 'POST',
          body: { group: fromGroup || HOME_DIR, order },
        });
        refresh();
      });
      return;
    }

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

  // 资源改名（侧边栏菜单）：asset-rename 只改展示名——树里显示的就是 label || name
  // （assetNode 已把 label 合进 node.name），与编辑页的「修改展示名」同一端点同一口径。
  const renameAssetRow = (node) => {
    const rel = relOfKey(node.path);
    const name = rel.split('/').pop();
    const group = rel.split('/').slice(0, -1).join('/');
    dialog({
      title: `重命名 ${node.name}`,
      message: '改展示名；目录名 ' + name + ' 不变。',
      input: true,
      value: node.name,
      okText: '确定',
    }).then((label) => {
      if (!label || label === node.name) return;
      guard(async () => {
        await api(`/api/${kind}/asset-rename`, {
          method: 'POST',
          body: { group: group || HOME_DIR, name, label },
        });
        toast(`已改展示名: ${name} → ${label}`);
        refresh();
      });
    });
  };

  // 资源删除（侧边栏菜单）：与编辑页 removeAsset 同端点（force 连风格与历史一起删）。
  // 删的是当前打开的资源 → 退回所在分组，别让开着的编辑器指向不存在的资源。
  const removeAssetRow = (node) => {
    const rel = relOfKey(node.path);
    const name = rel.split('/').pop();
    const group = rel.split('/').slice(0, -1).join('/');
    dialog({
      title: `删除资源 ${name}？`,
      message: '该资源的全部风格、代码与历史将删除，不可恢复。',
      okText: '删除',
      danger: true,
    }).then((ok) => {
      if (!ok) return;
      guard(async () => {
        await api(`/api/${kind}/asset-remove`, {
          method: 'POST',
          body: { group: group || HOME_DIR, name, force: true },
        });
        toast('已删除资源: ' + name);
        if (selectedKey === node.key) goDir(group);
        refresh();
      });
    });
  };

  // 在系统文件管理器里打开（侧边栏菜单）：目录 = 该目录本身；资源 = 它的资源目录。
  // 由后端按 kind/group/name 解析绝对路径并 spawn（见 core/assets/groups.js revealDir）——
  // 前端不传路径，避免面板能打开机器上任意目录。
  const revealRow = (node) => {
    // 根行（或树空白处，node 为 null）：打开本域根目录——后端对「不带 group」
    // 短路到 groupsRoot（见 groups.revealDir），不走 HOME_DIR 那条替代路。
    if (!node || node.kind === 'root') {
      guard(async () => {
        const r = await api(`/api/${kind}/reveal`, { method: 'POST', body: { group: '' } });
        toast(`已在文件管理器中打开: ${r.path}`);
      });
      return;
    }
    const rel = relOfKey(node.path);
    const isAsset = node.kind === 'asset';
    const group = isAsset ? rel.split('/').slice(0, -1).join('/') : rel;
    const name = isAsset ? rel.split('/').pop() : undefined;
    guard(async () => {
      const r = await api(`/api/${kind}/reveal`, {
        method: 'POST',
        body: { group: group || HOME_DIR, name },
      });
      toast(`已在文件管理器中打开: ${r.path}`);
    });
  };

  // 统一的拖拽上报：目录走层级/排序，资源走换分组
  const onMoveRow = ({ node, target }) => {
    if (node.kind === 'asset') return moveAssetRow({ node, target });
    return moveDir({ node, target });
  };

  return {
    createAtSelected,
    createSubDir,
    createAssetInDir,
    renameDir,
    removeDir,
    moveDir,
    moveAssetRow,
    renameAssetRow,
    removeAssetRow,
    revealRow,
    importToDir,
    exportDirRow,
    onMoveRow,
    dlgNode,
    zipNode,
  };
}
