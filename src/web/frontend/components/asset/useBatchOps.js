// 批量选择状态与动作：勾选资源/目录、全选/反选可见项、批量删除。
// 从 manage.jsx 拆出：ManagePage 剩下的职责是「布局与路由」，勾选这套
// 是自洽的小机器（自己的状态 + 一组动作），与 useManageOps 同一拆法。
//
// 资源 key = `${group}/${name}`；目录 value = path（与批量删除的 API 约定一致）。
import { useState } from 'react';
import { api } from '../../api/client.js';
import { findNode } from './tree.jsx';

export function useBatchOps({ kind, tree, root, dirNode, dir, filtered, dialog, toast, reloadTree }) {
  const [selected, setSelected] = useState(() => new Set());
  const [selectedDirs, setSelectedDirs] = useState(() => new Set());
  const [batchMode, setBatchMode] = useState(false);

  const toggleSelect = (groupPath, name) => {
    const key = `${groupPath}/${name}`;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setBatchMode(true);
  };

  const toggleSelectDir = (path) => {
    setSelectedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
    setBatchMode(true);
  };

  const enterBatch = () => setBatchMode(true);
  const cancelBatch = () => {
    setBatchMode(false);
    setSelected(new Set());
    setSelectedDirs(new Set());
  };

  const visibleAssets = () =>
    filtered
      ? (tree?.groups || []).flatMap((g) => g.assets.map((a) => [g.path, a.name]))
      : (tree?.groups.find((g) => g.path === dir)?.assets || []).map((a) => [dir, a.name]);

  const visibleDirs = () => (dirNode?.children || []).map((c) => c.path);

  const selectAllVisible = () => {
    const assets = visibleAssets();
    const dirs = visibleDirs();
    setSelected((prev) => {
      const next = new Set(prev);
      assets.forEach(([g, a]) => next.add(`${g}/${a}`));
      return next;
    });
    setSelectedDirs((prev) => {
      const next = new Set(prev);
      dirs.forEach((p) => next.add(p));
      return next;
    });
  };

  const invertVisible = () => {
    const assets = visibleAssets();
    const dirs = visibleDirs();
    setSelected((prev) => {
      const next = new Set(prev);
      assets.forEach(([g, a]) => {
        const key = `${g}/${a}`;
        if (next.has(key)) next.delete(key);
        else next.add(key);
      });
      return next;
    });
    setSelectedDirs((prev) => {
      const next = new Set(prev);
      dirs.forEach((p) => {
        if (next.has(p)) next.delete(p);
        else next.add(p);
      });
      return next;
    });
  };

  const batchDelete = async () => {
    if (selected.size === 0) return;
    const ok = await dialog({
      title: '批量删除资源',
      message: `将删除 ${selected.size} 个资源。此操作不可撤销。`,
      okText: '确认删除',
      danger: true,
    });
    if (!ok) return;
    let done = 0;
    const failed = [];
    for (const key of selected) {
      // key = `${groupPath}/${name}`；groupPath 可含 /（多级分组），
      // 按**最后一个** / 切分——`split('/')` 会把多级分组切碎（如 ui/buttons/x → ['ui','buttons','x']）。
      const at = key.lastIndexOf('/');
      const groupPath = at < 0 ? '' : key.slice(0, at);
      const name = at < 0 ? key : key.slice(at + 1);
      try {
        // HTTP 路由是 asset-remove（CLI 才是 `<kind> rm`；两者名字不同，别混用）
        await api(`/api/${kind}/asset-remove`, { method: 'POST', body: { group: groupPath, name, force: true } });
        done++;
      } catch (e) {
        failed.push({ key, reason: String((e && e.message) || e) });
      }
    }
    if (failed.length) {
      toast.bad(`批量删除资源完成（${done}/${selected.size}）· 失败 ${failed.length}：${failed[0].reason}`);
    } else {
      toast(`批量删除资源完成（${done}/${selected.size}）`);
    }
    cancelBatch();
    reloadTree();
  };

  const batchDeleteDirs = async () => {
    if (selectedDirs.size === 0) return;
    const impacted = { groups: 0, assets: 0 };
    const countIn = (nd) => {
      if (!nd) return;
      impacted.groups += 1;
      impacted.assets += nd.direct?.length || 0;
      (nd.children || []).forEach(countIn);
    };
    for (const p of selectedDirs) countIn(findNode(root, p));

    const ok = await dialog({
      title: '批量删除目录',
      message: `将删除 ${selectedDirs.size} 个目录，含 ${impacted.groups} 个子目录、${impacted.assets} 个资源与全部历史。此操作不可撤销。`,
      okText: '确认删除',
      danger: true,
    });
    if (!ok) return;

    // 深路径先删：先删父目录会让子目录路径失效
    const ordered = [...selectedDirs].sort((a, b) => b.split('/').length - a.split('/').length);
    let done = 0;
    const failed = [];
    for (const p of ordered) {
      try {
        await api(`/api/${kind}/groups-remove`, { method: 'POST', body: { group: p, force: true } });
        done++;
      } catch (e) {
        failed.push({ path: p, reason: String((e && e.message) || e) });
      }
    }
    if (failed.length) {
      toast.bad(`批量删除目录完成（${done}/${selectedDirs.size}）· 失败 ${failed.length}：${failed[0].reason}`);
    } else {
      toast(`批量删除目录完成（${done}/${selectedDirs.size}）`);
    }
    cancelBatch();
    reloadTree();
  };

  return {
    selected,
    selectedDirs,
    batchMode,
    setBatchMode,
    toggleSelect,
    toggleSelectDir,
    enterBatch,
    cancelBatch,
    visibleAssets,
    visibleDirs,
    selectAllVisible,
    invertVisible,
    batchDelete,
    batchDeleteDirs,
  };
}
