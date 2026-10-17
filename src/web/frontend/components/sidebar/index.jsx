// 全局侧边栏：iOS 风格的文件夹树（搜索过滤 / 展开动画 / 键盘导航）。
//
// 组件只管「树怎么长」：树里有什么、点了去哪，由调用方通过
// sections / selected / onSelect 决定（见 shell.jsx 的组装）。
// 分工与面板既有约定一致——展开/搜索是侧边栏自己的状态（storageKey 落
// localStorage），选中态永远跟路由走（selected 由调用方从 hash 派生）。
import { useEffect, useMemo, useRef, useState } from 'react';
import { chainByKey, flattenVisible } from './model.js';
import { DragCtx, makeDragApi } from './drag.jsx';
import { SidebarHead } from './head.jsx';
import { NodeRow } from './node-row.jsx';
import { RowMenu } from './row-menu.jsx';
import { loadDefault, saveDefault } from './settings.js';

function loadExpanded(key) {
  try {
    return new Set(JSON.parse(localStorage.getItem(key)) || []);
  } catch {
    return new Set();
  }
}

// 收起是 0/1，不进 expanded 那份 JSON——两个状态各落各的 key，互不踩
function loadFolded(key) {
  try {
    return localStorage.getItem(`${key}--fold`) === '1';
  } catch {
    return false;
  }
}

// 「文件夹默认收起」（2.3 第一条）：开启后初始展开态 = 空集（选中链 effect 兜底，
// 仍然显示深链所在的目录），手动展开照常记忆，但下次进入回到空集再由 effect 展开链。
// 「侧边栏默认收起」（2.3 第二条）：开启后初始 folded = true（整条侧边栏滑出），
// 手动展开照常记忆，但下次进入回到 folded=true——和文件夹是同一思路（每次进入
// 重置初值，本次会话内手动状态可改）。
// 两条的存取在 settings.js：**三域共享一份**（它们是使用习惯，不是领域数据，
// html / svg / color 不该各配各的；含老 key 的一次性迁移）。

// 从当前选中的 key 推出「新建目录要去的父级 key」。
// - 选中整树行：parent = 整树（根的子级）
// - 选中目录：parent = 该目录（其子级）
// - 选中资源：parent = 资源所属的目录
// - 兜底：没有合适 key 时取首段 sections 的 rootNode
function parentKeyForSelection(selected, sections) {
  if (!selected) return sections.find((s) => s.rootNode)?.rootNode?.key || null;
  if (selected.startsWith('asset:')) {
    // asset:<kind>:<group>/<name> → parent = dir:<kind>:<group>
    const rest = selected.split(':').slice(2).join(':');
    const parts = rest.split('/');
    const groupPath = parts.slice(0, -1).join('/');
    const kind = selected.split(':')[1];
    return `dir:${kind}:${groupPath}`;
  }
  return selected; // dir:<kind>:<path> 或 root:<kind> → 直接作为父级
}

export function Sidebar({
  sections,
  selected,
  onSelect,
  storageKey,
  placeholder = '搜索目录与组件',
  // 目录管理（都是可选的）：给了 onCreateAtSelected 才出头部「+」。
  // 行操作走 rowMenu 协议：rowMenu(node) 返回菜单项数组 [{ label, icon?, danger?, run }]
  // （或 null = 该行无操作）——组件本身不认识「重命名/删除」的语义，
  // 弹层与开关时机在这里，条目与行为全由调用方决定（见 asset/side-tree.jsx）。
  onCreateAtSelected,
  rowMenu,
  // 拖拽换层级：给了 onMove 才启用。回调只有一个形状——onMove({ node, target })，
  // target = { node } 表示拖进了某个目录，{ root: true } 表示拖到了根。
  onMove,
}) {
  // 「文件夹默认收起」开着 → 初值从空集开始（当前链由下面的选中链 effect 展开），
  // 不读上次的展开存档；关着 → 保持旧行为（读存档，首次见到根行时播种全展开）。
  const [expanded, setExpanded] = useState(() =>
    loadDefault('folders') ? new Set() : loadExpanded(storageKey)
  );
  // 收起/展开整条侧边栏：也是侧边栏自己的 UI 状态，随 storageKey 落盘。
  // 收起时整列用负 margin 滑出去（见 sidebar.css），把手（.gside-collapse）
  // 搭着车走，永远停在侧边栏右缘——收起后就是 main 左缘的「›」。
  // 「侧边栏默认收起」开着 → 每次进入都从 folded=true 出发（忽略上次落盘值），
  // 本次会话内手动展开仍可改，但下次进入回到默认。
  const [folded, setFolded] = useState(() =>
    loadDefault('sidebar') ? true : loadFolded(storageKey)
  );
  const [kwRaw, setKwRaw] = useState('');
  // 就地创建：null = 没在创建；否则 = 父级 key（在该行 .gkids 里插入编辑行）。
  // 落点由 selected 决定（侧边栏高亮 = 父级），让侧边栏和「+」同源。
  const [creatingFor, setCreatingFor] = useState(null);
  const dragRef = useRef(null); // 拖拽源。只存 ref：dragstart 期间渲染会取消拖拽（见 drag.jsx）
  const [dropKey, setDropKey] = useState(null); // 命中的落点 key；'root' = 根
  // 行操作菜单：{ node, items, at } | null。at 是 ⋯ 按钮（{anchor}）或光标（{x,y}）。
  const [menu, setMenu] = useState(null);
  // 两条默认收起：三域共享一份——文件夹管展开态初值，侧边栏管 folded 初值。
  const [defaultFolders, setDefaultFolders] = useState(() => loadDefault('folders'));
  const [defaultSidebar, setDefaultSidebar] = useState(() => loadDefault('sidebar'));
  const kw = kwRaw.trim().toLowerCase();

  const dragApi = makeDragApi({ dragRef, dropKey, setDropKey, onMove });

  // 首次见到整树行时默认把它展开：否则第一眼只有一个收起的大行，什么都看不到。
  // 只在本 storageKey 从没有过存档时播一次——用户后来手动收起，重开也不该被掰回来。
  // 「文件夹默认收起」开着则不播：初值就是空集，展开到当前链路由选中链 effect 负责。
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || defaultFolders) return;
    const roots = sections.filter((s2) => s2.rootNode).map((s2) => s2.rootNode.path);
    if (!roots.length) return;
    seeded.current = true;
    let had = null;
    try {
      had = localStorage.getItem(storageKey);
    } catch {
      /* 隐私模式：按「没有存档」处理，展开就好 */
    }
    if (had == null) setExpanded((prev) => new Set([...prev, ...roots]));
  }, [sections, storageKey, defaultFolders]);

  // 开关落盘（共享 key）：只影响「下次进入」的初值策略，本次会话的展开/folded 态不动
  const setDefaultFoldersPersisted = (on) => {
    setDefaultFolders(on);
    saveDefault('folders', on);
  };
  const setDefaultSidebarPersisted = (on) => {
    setDefaultSidebar(on);
    saveDefault('sidebar', on);
  };

  // 展开状态落盘（与面板「UI 状态持久化是硬标准」同规矩）
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...expanded]));
    } catch {
      /* 隐私模式静默 */
    }
  }, [expanded, storageKey]);

  // 收起状态同样落盘（与 expanded 的 key 各落各的，互不踩）
  useEffect(() => {
    try {
      localStorage.setItem(`${storageKey}--fold`, folded ? '1' : '0');
    } catch {
      /* 隐私模式静默 */
    }
  }, [folded, storageKey]);

  // 选中态来自路由：深链直达深层目录时，自动展开沿途父级（不动选中行自己）
  useEffect(() => {
    if (!selected) return;
    for (const s of sections) {
      const chain = chainByKey(s.nodes, selected);
      if (!chain) continue;
      setExpanded((prev) => {
        const next = new Set(prev);
        for (const n of chain.slice(0, -1)) next.add(n.path);
        return next.size === prev.size ? prev : next;
      });
      break;
    }
  }, [selected, sections]);

  const rows = useMemo(
    () => sections.flatMap((s) => flattenVisible(s.nodes, kw, expanded)),
    [sections, kw, expanded]
  );

  const toggle = (path) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const onKeyDown = (e) => {
    if (!rows.length) return;
    const idx = rows.findIndex((r) => r.node.key === selected);
    const pick = (i) => {
      const n = rows[(i + rows.length) % rows.length].node;
      onSelect(n);
      document.querySelector(`[data-key="${CSS.escape(n.key)}"]`)?.scrollIntoView({ block: 'nearest' });
    };
    const cur = idx >= 0 ? rows[idx] : null;
    if (e.key === 'ArrowDown') pick(idx + 1);
    else if (e.key === 'ArrowUp') pick(idx - 1);
    else if (e.key === 'ArrowRight') {
      if (cur && cur.node.children?.length && !expanded.has(cur.node.path)) toggle(cur.node.path);
      else pick(idx + 1);
    } else if (e.key === 'ArrowLeft') {
      if (cur && cur.node.children?.length && expanded.has(cur.node.path)) toggle(cur.node.path);
      else if (cur && cur.parent) pick(rows.findIndex((r) => r.node === cur.parent));
    } else if (e.key === 'Enter' && cur) {
      onSelect(cur.node);
    } else {
      return;
    }
    e.preventDefault();
  };

  return (
    <DragCtx.Provider value={dragApi}>
      <div
        className={'gside' + (folded ? ' fold' : '')}
        data-testid="gside"
        data-folded={folded ? '1' : '0'}
      >
        <SidebarHead
          placeholder={placeholder}
          kw={kwRaw}
          onKw={setKwRaw}
          creating={creatingFor}
          // 顶部 +：把「就地创建」按钮变成「在选中行的 .gkids 里插入」——与父级同源
          onToggleCreate={() => {
            const target = parentKeyForSelection(selected, sections);
            if (!target) return;
            setCreatingFor(target);
            // 展开父级（落点行要看得见才方便编辑）：选目录则展开它
            const parentPath = target.startsWith('root:')
              ? null
              : target.split(':').slice(2).join(':');
            if (parentPath) setExpanded((prev) => new Set([...prev, parentPath]));
            // 滚到编辑行可见
            requestAnimationFrame(() => {
              setTimeout(() => {
                const el = document.querySelector('[data-testid="gside-create"] input');
                el?.scrollIntoView({ block: 'nearest' });
              }, 0);
            });
          }}
          createKey={creatingFor}
          defaultFolders={defaultFolders}
          onDefaultFolders={setDefaultFoldersPersisted}
          defaultSidebar={defaultSidebar}
          onDefaultSidebar={setDefaultSidebarPersisted}
          onCollapseToggle={() => setFolded((f) => !f)}
          folded={folded}
        />
        <div
          className={
            'gside-tree' +
            (dropKey === 'tail' ? ' drop-tail' : '') +
            (dropKey === 'root' ? ' drop-root' : '')
          }
          role="tree"
          aria-label="全局目录"
          tabIndex={0}
          onKeyDown={onKeyDown}
          // 树一滚动，钉在行上的菜单就指错了地方——直接收掉
          onScroll={() => setMenu(null)}
          // 空白处也是「根」的落点（只在事件落在容器自己身上时算，行上的拖放由行处理）
          onDragOver={
            dragApi
              ? (e) => {
                  if (e.target === e.currentTarget) dragApi.over(null, e);
                }
              : undefined
          }
          onDrop={
            dragApi
              ? (e) => {
                  if (e.target === e.currentTarget) dragApi.drop(null, e);
                }
              : undefined
          }
          // 空白处的右键 = 「最外层」的菜单（rowMenu(null)，调用方决定给什么）。
          // 行上的右键由行自己处理，这里只接行之外的目标（区标题 / 提示 / 容器空隙）。
          onContextMenu={
            rowMenu
              ? (e) => {
                  if (e.target.closest('.grow')) return;
                  e.preventDefault();
                  const items = rowMenu(null);
                  if (items?.length) setMenu({ node: null, items, at: { x: e.clientX, y: e.clientY } });
                }
              : undefined
          }
        >
          {sections.map((s) => (
            <section key={s.id} className="gsec">
              {/* 有 rootNode 的区：整棵树那一行就是本区的头（与 VS Code 资源管理器的
                  根行同一个角色）——选中它 = 选中整棵树，拖到它身上 = 回到最外层 */}
              {s.rootNode ? null : <div className="gsec-title">{s.title}</div>}
              {s.hint ? <div className="gsec-hint">{s.hint}</div> : null}
              {s.nodes.map((n) => (
                <NodeRow
                  key={n.path}
                  node={n}
                  depth={0}
                  selected={selected}
                  kw={kw}
                  expanded={expanded}
                  onSelect={onSelect}
                  onToggle={toggle}
                  rowMenu={
                    rowMenu
                      ? (node, at) => {
                          const items = rowMenu(node);
                          if (items?.length) setMenu({ node, items, at });
                        }
                      : undefined
                  }
                  creatingFor={creatingFor}
                  onSubmitCreate={async (name) => {
                    await onCreateAtSelected(name);
                    setCreatingFor(null);
                  }}
                  onCancelCreate={() => setCreatingFor(null)}
                />
              ))}
              {!s.nodes.length && !s.hint ? <div className="gsec-hint">暂无目录</div> : null}
            </section>
          ))}
          {kw && !rows.length ? <div className="gside-empty">没有包含「{kwRaw.trim()}」的目录</div> : null}
        </div>
        {menu ? <RowMenu items={menu.items} at={menu.at} onClose={() => setMenu(null)} /> : null}
      </div>
    </DragCtx.Provider>
  );
}
