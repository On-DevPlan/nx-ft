// 资产侧边栏的「新建」命令集合：新建文件夹（当前目录 / 右键目录）、新建资源。
//
// 从 use-tree-ops.js 拆出：那一份已逼近 300 行上限，而新建这三件事自成一簇
// （都是 POST groups / assets + 跳进去），拆出去后两边都更聚焦。
// 入参（kind / currentDir / 各 UI 命令）由 useTreeOps 透传，这里不持有状态。
import { api } from '../../api/client.js';
import { relOfKey } from './tree-keys.js';

export function useTreeCreate({ kind, currentDir, goDir, refresh, dialog, guard, toast }) {
  // 新建文件夹：落在当前目录下（没选中 = 根），建完跳进去
  const createAtSelected = (name) =>
    guard(async () => {
      const path = [currentDir, name].filter(Boolean).join('/');
      await api(`/api/${kind}/groups`, { method: 'POST', body: { group: path } });
      toast(`已创建目录 ${path}`);
      refresh();
      goDir(path);
    });

  // 右键目录：在该目录下新建子文件夹（父分组锁定，只问单段名字）
  const createSubDir = (node) => {
    const parent = relOfKey(node.path);
    dialog({
      title: `在 ${parent || '最外层'} 下新建文件夹`,
      message: '只填单段名字（kebab-case）；多级路径请用重命名 / 移动。',
      input: true,
      placeholder: 'new-folder',
      okText: '创建',
    }).then((name) => {
      if (!name || !name.trim()) return;
      const nm = name.trim();
      if (nm.includes('/')) {
        toast.bad('单段名字不能含 /');
        return;
      }
      guard(async () => {
        const path = [parent, nm].filter(Boolean).join('/');
        await api(`/api/${kind}/groups`, { method: 'POST', body: { group: path } });
        toast(`已创建目录 ${path}`);
        refresh();
        goDir(path);
      });
    });
  };

  // 右键目录：在该目录下新建资源（group 锁定，问名字、展示名，建完进编辑器）
  const createAssetInDir = (node) => {
    const group = relOfKey(node.path);
    dialog({
      title: `在 ${group || '最外层'} 下新建资源`,
      message:
        kind === 'svg'
          ? '图标 = 一枚 SVG，建好进入资源页。'
          : '资源 = 一个场景（如「登录按钮」），建好进入工作台。',
      input: true,
      placeholder: kind === 'svg' ? 'new-icon（kebab-case）' : 'new-btn（kebab-case）',
      okText: '创建',
    }).then((name) => {
      if (!name || !name.trim()) return;
      const nm = name.trim();
      if (nm.includes('/')) {
        toast.bad('单段名字不能含 /');
        return;
      }
      dialog({
        title: '展示名（回车跳过）',
        input: true,
        placeholder: kind === 'svg' ? '加号' : '登录按钮',
      }).then((label) => {
        guard(async () => {
          const r = await api(`/api/${kind}/assets`, {
            method: 'POST',
            body: { group, name: nm, label: label ? label.trim() : undefined },
          });
          toast(`已创建资源: ${r.group}/${r.name}`);
          refresh();
          const gp = (r.group || group).split('/').map(encodeURIComponent).join('/');
          location.hash = `#/${kind}/edit/${gp}/${encodeURIComponent(r.name)}`;
        });
      });
    });
  };

  return { createAtSelected, createSubDir, createAssetInDir };
}
