// 管理页操作集合：新建分组 / 删除分组 / 新建资源（三组弹窗流程）。
// 抽成独立文件：让 manage.jsx 保持「布局与浏览逻辑」一件事。
import { api } from '../../api/client.js';

export function makeManageOps({ kind, dir, reload, setDir, dialog, guard, toast, onOpen }) {
  const addGroup = (parent = dir) =>
    guard(async () => {
      const hint = parent ? parent + '/' : '';
      const path = await dialog({
        title: '新建分组',
        message: `1~8 段路径（支持多层目录树）${parent ? `，当前目录: ${parent}` : ''}`,
        input: true,
        value: hint,
        placeholder: 'ui/buttons/primary',
        okText: '创建',
      });
      if (!path) return;
      const r = await api(`/api/${kind}/groups`, { method: 'POST', body: { group: path } });
      await reload();
      setDir(r.path || path);
      toast(r.status === 'skipped' ? '分组已存在' : '已创建分组: ' + r.path);
    });

  const removeGroup = (path) =>
    guard(async () => {
      const ok = await dialog({
        title: `删除分组 ${path}？`,
        message: '分组内的资源、子分组、风格与历史会全部删除（非空需确认），不可恢复。',
        okText: '连同内容一起删除',
        danger: true,
      });
      if (!ok) return;
      await api(`/api/${kind}/groups-remove`, { method: 'POST', body: { group: path, force: true } });
      if (dir === path || dir.startsWith(path + '/')) {
        setDir(path.split('/').slice(0, -1).join('/'));
      }
      await reload();
      toast('已删除分组: ' + path);
    });

  const addAsset = (parent = dir) =>
    guard(async () => {
      const group = await dialog({
        title: '新建资源',
        input: true,
        value: parent || '',
        placeholder: '分组路径，如 ui/buttons',
        message: '资源 = 一个场景（如「登录按钮」），创建后进入工作台加风格。',
      });
      if (!group) return;
      const name = await dialog({
        title: '资源名',
        input: true,
        placeholder: 'login-btn（目录名，用 kebab-case）',
      });
      if (!name) return;
      const label = await dialog({ title: '展示名（回车跳过）', input: true, placeholder: '登录按钮' });
      const r = await api(`/api/${kind}/assets`, {
        method: 'POST',
        body: { group, name, label: label || undefined },
      });
      await reload();
      toast('已创建资源: ' + r.group + '/' + r.name);
      onOpen(r.group, r.name);
    });

  return { addGroup, removeGroup, addAsset };
}
