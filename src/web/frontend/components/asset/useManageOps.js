// 管理/工作台的操作集合：新建分组、改名/移动、删除分组、新建资源。
// 抽成独立文件：让 manage.jsx 与 svg 工作台都只负责「布局与浏览」一件事。
//
// 两个面板共用这一份（靠 kind 与 noun 参数区分）：html 说「资源」，svg 说「图标」。
// 共用而不是各写一份，是为了让「同一件事在两个面板里行为一致」成为结构事实——
// 分开写迟早会出现「html 能改名、svg 不能」这种没人注意到的缺口。
import { api } from '../../api/client.js';

export function makeManageOps({
  kind,
  dir,
  reload,
  setDir,
  dialog,
  guard,
  toast,
  onOpen,
  noun = '资源',
}) {
  // ---- 网盘式创建（免对话框）：只在当前目录里起名，回车即建 ----
  // addGroup / addAsset（对话框式）仍保留给 svg 工作台；html 管理页走这两个。

  const createGroup = async (parent, name) => {
    const path = parent ? `${parent}/${name}` : name;
    const r = await api(`/api/${kind}/groups`, { method: 'POST', body: { group: path } });
    await reload();
    setDir(r.path || path);
    if (r.status === 'skipped') toast.warn('分组已存在');
    else toast.ok('已创建文件夹: ' + (r.path || path));
    return r;
  };

  const createAsset = async (parent, name) => {
    const r = await api(`/api/${kind}/assets`, { method: 'POST', body: { group: parent, name } });
    await reload();
    toast(`已创建${noun}: ` + r.group + '/' + r.name);
    onOpen(r.group, r.name);
    return r;
  };

  const addGroup = (parent = dir) =>
    guard(async () => {
      const hint = parent ? parent + '/' : '';
      const path = await dialog({
        title: '新建分组',
        message: `最多 8 段路径（支持多层目录树）${parent ? `，当前目录: ${parent}` : ''}`,
        input: true,
        value: hint,
        placeholder: 'ui/buttons/primary',
        okText: '创建',
      });
      if (!path) return;
      const r = await api(`/api/${kind}/groups`, { method: 'POST', body: { group: path } });
      await reload();
      setDir(r.path || path);
      if (r.status === 'skipped') toast.warn('分组已存在');
      else toast.ok('已创建分组: ' + r.path);
    });

  // 改名 / 移动是同一件事（目录挪到新路径）。一个对话框问目标路径——
  // 只改路径 = 移动；展示名默认跟随目录名（不再追问第二个对话框）。
  const renameGroup = (path = dir) =>
    guard(async () => {
      if (!path) return;
      const to = await dialog({
        title: `移动或重命名 ${path}`,
        message: '改路径 = 整个目录挪过去（含资源与子分组）。',
        input: true,
        value: path,
        placeholder: 'ui/icons/nav',
        okText: '确定',
      });
      if (!to || to === path) return;
      const label = to.split('/').pop();
      const r = await api(`/api/${kind}/groups-rename`, {
        method: 'POST',
        body: { group: path, to, label },
      });
      if (r.status === 'blocked') {
        toast.bad(`没改成：${r.reason}`);
        return;
      }
      await reload();
      if (r.renamed) setDir(r.path);
      toast(r.renamed ? `已移动: ${path} → ${r.path}` : `已更新展示名: ${path}`);
    });

  const removeGroup = (path) =>
    guard(async () => {
      const ok = await dialog({
        title: `删除分组 ${path}？`,
        message: `分组内的${noun}、子分组、风格与历史会全部删除（非空需确认），不可恢复。`,
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
        title: `新建${noun}`,
        input: true,
        value: parent || '',
        placeholder: '分组路径，如 ui/buttons',
        message:
          kind === 'svg'
            ? '图标 = 一枚 SVG。建好后进入资源页，可直接写路径或让 AI 用 CLI 写。'
            : `${noun} = 一个场景（如「登录按钮」），创建后进入工作台加风格。`,
      });
      if (!group) return;
      const name = await dialog({
        title: '目录名',
        input: true,
        placeholder: kind === 'svg' ? 'add-icon（kebab-case）' : 'login-btn（kebab-case）',
      });
      if (!name) return;
      const label = await dialog({
        title: '展示名（回车跳过）',
        input: true,
        placeholder: kind === 'svg' ? '加号' : '登录按钮',
      });
      const r = await api(`/api/${kind}/assets`, {
        method: 'POST',
        body: { group, name, label: label || undefined },
      });
      await reload();
      toast(`已创建${noun}: ` + r.group + '/' + r.name);
      onOpen(r.group, r.name);
    });

  // 同级分组排序：与 manage.jsx 用的是同一组 API（POST groups-reorder，整层全量新顺序），
  // 把它做对的关键是先 filter 再找位次（向后拖才不会因索引左移被甩到队尾——见 use-tree-ops.js
  // 的同款注释）。入参 = 同级目录全量的 path 数组 + 父级（空 = 最外层）。
  const reorderGroups = async (parent, order) =>
    guard(async () => {
      await api(`/api/${kind}/groups-reorder`, {
        method: 'POST',
        body: { parent: parent || '', order },
      });
      await reload();
    });

  return { addGroup, renameGroup, removeGroup, addAsset, createGroup, createAsset, reorderGroups };
}
