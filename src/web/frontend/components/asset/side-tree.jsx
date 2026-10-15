// 资产域侧边栏：当前领域（html / svg）的分组与资源树 + 目录管理（新建 / 改名 / 删除 /
// 拖拽换层级与排序 / 资源换分组）。
//
// 数据 = /api/<kind>/tree 的 groups（与网盘页同一份），层级重建复用 tree.jsx 的 buildTree；
// 交互与命令在 use-tree-ops.js（useTreeOps），key 与路由的换算在 tree-keys.js。
//
// 「路由真相只有一份」（见 App.jsx）：点击行 / 拖拽落点都只写 hash，
// 选中态永远从 hash 派生——侧边栏与内容区不会各持一套「我在哪」。
//
// 结构（three selectable kinds，参照 VS Code 资源管理器）：
//   root:<kind>   整棵树（本区的头一行）——选中 = 选中整棵树，「+」建在最外层，
//                 拖到它身上 / 拖到空白处 = 移到最外层
//   dir:<kind>:…  目录——可拖（换层级 / 同级排序），行内操作改名 / 删除
//   asset:<kind>… 资源——可拖（换分组），点开进编辑页
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client.js';
import { Sidebar } from '../sidebar/index.jsx';
import { DeleteGlyph, RenameGlyph } from '../sidebar/icons.jsx';
import { buildTree } from './tree.jsx';
import { VIEWS } from '../../registry.js';
import { onTreeChanged } from './tree-signal.js';
import { dirOfKey, keyFromHash } from './tree-keys.js';
import { useTreeOps } from './use-tree-ops.js';

const encPath = (p) => p.split('/').map(encodeURIComponent).join('/');

// 领域标题取自 registry（视图表是它的真相来源，别在这里再抄一份）
const KIND_TITLE = Object.fromEntries(VIEWS.map((v) => [v.id, v.title]));

const byName = (a, b) => String(a.name).localeCompare(String(b.name));

// 资源叶子：点开 = 进编辑页（html 的 workbench / svg 的资源页）。
// kind 固定 'asset'——它是**语义**（可拖换分组），不是图标；叶子图标统一用 doc。
// （第一版把 kind 写成 'code'/'doc' 当图标用，导致资源行的 draggable 判定永远为假
//  ——「无法拖动」的最终根因。语义与长相必须分开。）
const assetNode = (kind, groupPath) => (a) => ({
  name: a.label || a.name,
  path: `asset:${kind}:${groupPath}/${a.name}`,
  key: `asset:${kind}:${groupPath}/${a.name}`,
  kind: 'asset',
  nav: `#/${kind}/edit/${encPath(groupPath)}/${encodeURIComponent(a.name)}`,
});

// buildTree 的节点 → 侧边栏节点：目录在先、资源在后（文件管理器的次序）。
// **资源叶子必须映射**——buildTree 只建目录层级，资源在 node.direct 里；
// 漏了它，导入的资源就不会出现在侧边栏（真踩过：导入 49 枚后树上空空）。
// 目录的 total 已经含后代资源（buildTree 算好的），所以收起时也看得见数量。
function toNode(kind) {
  const walk = (n) => ({
    name: n.label || n.name,
    path: `dir:${kind}:${n.path}`,
    key: `dir:${kind}:${n.path}`,
    kind: 'dir',
    nav: n.path ? `#/${kind}/dir/${encPath(n.path)}` : `#/${kind}`,
    children: [
      ...n.children.map(walk),
      ...(n.direct || []).slice().sort(byName).map(assetNode(kind, n.path)),
    ],
    total: n.total,
  });
  return walk;
}

// 整棵树 = 一个可选的根行（与 VS Code 资源管理器的工作区行同一个角色）
function treeRoot(kind, groups) {
  const root = buildTree(groups);
  return {
    name: KIND_TITLE[kind] || kind,
    path: `root:${kind}`,
    key: `root:${kind}`,
    kind: 'root',
    nav: `#/${kind}`,
    children: root.children.map(toNode(kind)),
    total: root.total,
  };
}

export function AssetSidebar({ kind }) {
  const [groups, setGroups] = useState(null); // null = 加载中，[] = 空
  const [tick, setTick] = useState(0); // 不跳转的变更（删除未选中目录、排序）后的重取信号

  const goDir = (path) => {
    location.hash = `#/${kind}/dir/${encPath(path)}`;
  };
  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    let alive = true;
    // 四条重取通路，各管一类变化：
    //   hashchange       进出目录（跳转伴随数据变化）
    //   变更信号         面板里的导入/批量删除等（见 tree-signal.js）
    //   visibilitychange 切标签页回来（别的终端改了状态）
    //   window focus     从终端切回浏览器窗口（CLI 导入等，标签页一直可见时 visibility 不变）
    // tick 覆盖本组件自己发起的、不跳转的变更
    const load = () =>
      api(`/api/${kind}/tree`)
        .then((t) => alive && setGroups(t?.groups || []))
        .catch(() => {});
    load();
    const onHash = () => load();
    const onVis = () => {
      if (document.visibilityState === 'visible') load();
    };
    const offSignal = onTreeChanged(load);
    window.addEventListener('hashchange', onHash);
    window.addEventListener('focus', load);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false;
      offSignal();
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('focus', load);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [kind, tick]);

  // 选中态（hash 派生）与「当前目录」（新建 / 删除退回的基准，见 tree-keys.js）
  const selectedKey = keyFromHash(typeof location !== 'undefined' ? location.hash : '');
  const currentDir = dirOfKey(selectedKey);

  const { createAtSelected, renameDir, removeDir, onMoveRow, dlgNode } = useTreeOps({
    kind,
    groups,
    currentDir,
    selectedKey,
    goDir,
    refresh,
  });

  const sections = useMemo(() => {
    const title = KIND_TITLE[kind] || kind;
    if (!groups) {
      // 加载中：还没有树，先立个朴素标题（并给出提示）
      return [{ id: 'tree', title, hint: '加载中…', nodes: [] }];
    }
    const root = treeRoot(kind, groups);
    // rootNode 让「整棵树」成为可选中、可作落点的头一行；nodes 只放它一个
    return [{ id: 'tree', title, rootNode: root, nodes: [root] }];
  }, [groups, kind]);

  const rowActions = (node) => (
    <>
      <button title="重命名 / 移动" aria-label="重命名目录" onClick={() => renameDir(node)}>
        <RenameGlyph />
      </button>
      <button title="删除目录" aria-label="删除目录" onClick={() => removeDir(node)}>
        <DeleteGlyph />
      </button>
    </>
  );

  return (
    <>
      <Sidebar
        sections={sections}
        selected={selectedKey}
        onSelect={(n) => {
          if (n.nav && location.hash !== n.nav) location.hash = n.nav;
        }}
        storageKey={`nx-ft-side-${kind}`}
        placeholder="搜索资源与目录"
        onCreateAtSelected={createAtSelected}
        renderRowActions={rowActions}
        onMove={onMoveRow}
      />
      {dlgNode}
    </>
  );
}
