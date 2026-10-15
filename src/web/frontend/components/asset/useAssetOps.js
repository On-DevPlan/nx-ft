// 工作台操作集合：保存 / 风格（建、删、描述）/ 资源（改名、删）/ 标签。
// 管理页的分组与建资源操作在 manage.jsx 内自实现（那边没有 sel 上下文）。
import { api } from '../../api/client.js';

export function makeAssetOps({
  kind,
  sel,
  asset,
  ready,
  readCode,
  isDirty,
  loadAsset,
  dialog,
  guard,
  toast,
  onExit,
}) {
  const save = () =>
    guard(async () => {
      if (!sel.group || !sel.name || !sel.style || !ready) {
        if (ready && !sel.style) toast.warn('先新建一个风格（右上角「新风格」）');
        return;
      }
      if (!isDirty()) return;
      const r = await api(`/api/${kind}/asset-code`, {
        method: 'POST',
        body: { group: sel.group, name: sel.name, style: sel.style, ...readCode() },
      });
      await loadAsset(sel);
      if (r.status === 'skipped') toast.warn('内容无变化');
      else toast.ok('已保存（改动前状态已进历史）');
    });

  const newStyle = () =>
    guard(async () => {
      const name = await dialog({
        title: '新增风格',
        message: '风格数量不限：同一个资源并存多套实现用于对比；新风格会复制当前代码。',
        input: true,
        placeholder: '如 dark / glass / compact',
        okText: '创建并复制当前代码',
      });
      if (!name) return;
      const body = { group: sel.group, name: sel.name, style: name };
      if (sel.style) body['copy-from'] = sel.style;
      await api(`/api/${kind}/styles`, { method: 'POST', body });
      await loadAsset({ ...sel, style: name });
      toast('已新增风格: ' + name);
    });

  const setStyleDesc = () =>
    guard(async () => {
      const cur = (asset?.styles || []).find((s) => s.name === sel.style);
      const desc = await dialog({
        title: `风格描述 · ${sel.style || ''}`,
        message: '一句话说明这套实现的特征（对比多套风格时扫一眼就懂）。留空即清除。',
        input: true,
        value: cur?.desc || '',
        placeholder: '如：圆角玻璃拟态，主色紫，带柔和阴影',
        okText: '保存描述',
      });
      if (desc === null) return;
      await api(`/api/${kind}/style-desc`, {
        method: 'POST',
        body: { group: sel.group, name: sel.name, style: sel.style, text: desc },
      });
      await loadAsset(sel);
      toast(desc ? '已更新风格描述' : '已清除风格描述');
    });

  const removeStyle = () =>
    guard(async () => {
      const ok = await dialog({
        title: `删除风格 ${sel.style}？`,
        message: '该风格的代码与全部编辑历史会一并删除，不可恢复。',
        okText: '删除',
        danger: true,
      });
      if (!ok) return;
      await api(`/api/${kind}/style-remove`, {
        method: 'POST',
        body: { group: sel.group, name: sel.name, style: sel.style },
      });
      await loadAsset({ ...sel, style: '' });
      toast('已删除风格: ' + sel.style);
    });

  const renameAsset = () =>
    guard(async () => {
      const label = await dialog({
        title: '修改展示名',
        input: true,
        value: asset.label,
        message: '只改展示名，目录名 ' + sel.name + ' 不变。',
      });
      if (!label) return;
      await api(`/api/${kind}/asset-rename`, {
        method: 'POST',
        body: { group: sel.group, name: sel.name, label },
      });
      await loadAsset(sel);
      toast('已重命名');
    });

  const removeAsset = () =>
    guard(async () => {
      const ok = await dialog({
        title: `删除资源 ${sel.name}？`,
        message: '含 ' + (asset.styles.length || 0) + ' 个风格，全部代码与历史将删除，不可恢复。',
        okText: '删除',
        danger: true,
      });
      if (!ok) return;
      await api(`/api/${kind}/asset-remove`, {
        method: 'POST',
        body: { group: sel.group, name: sel.name, force: true },
      });
      toast('已删除资源');
      onExit && onExit();
    });

  const addTags = () =>
    guard(async () => {
      const raw = await dialog({
        title: '添加标签',
        message: '逗号分隔可多个；小写存储，支持汉字。标签用于管理页筛选与搜索。',
        input: true,
        placeholder: 'button, login',
        okText: '添加',
      });
      if (!raw) return;
      const tags = String(raw).split(/[,，]/).map((s) => s.trim()).filter(Boolean);
      if (!tags.length) return;
      const r = await api(`/api/${kind}/tags-add`, {
        method: 'POST',
        body: { group: sel.group, name: sel.name, tags },
      });
      await loadAsset(sel);
      if (r.status === 'skipped') toast.warn('标签已存在');
      else toast.ok('已加标签: ' + (r.added || []).join(', '));
    });

  const removeTag = (tag) =>
    guard(async () => {
      await api(`/api/${kind}/tags-remove`, {
        method: 'POST',
        body: { group: sel.group, name: sel.name, tags: [tag] },
      });
      await loadAsset(sel);
      toast('已移除标签: ' + tag);
    });

  return { save, newStyle, setStyleDesc, removeStyle, renameAsset, removeAsset, addTags, removeTag };
}
