// 全局侧边栏：iOS 风格的文件夹树（搜索过滤 / 展开动画 / 键盘导航）。
//
// 组件只管「树怎么长」：树里有什么、点了去哪，由调用方通过
// sections / selected / onSelect 决定（见 shell.jsx 的组装）。
// 分工与面板既有约定一致——展开/搜索是侧边栏自己的状态（storageKey 落
// localStorage），选中态永远跟路由走（selected 由调用方从 hash 派生）。
import { useEffect, useMemo, useRef, useState } from 'react';
import { Chevron, FolderGlyph, KindGlyph, RootGlyph } from './icons.jsx';
import { chainByKey, flattenVisible, forceOpen } from './model.js';
import { DragCtx, makeDragApi, useDrag } from './drag.jsx';
import { SidebarHead } from './head.jsx';

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

// 在被选中的那行里就地创建新目录：VS Code 风格——
// 跟父级那行同形（chev + 文件夹图标 + 输入框），出现在它 .gkids 里的最末。
// 重表单 → 极轻：无重框、聚焦一根细下边、Enter 提交、Escape/失焦 取消。
function InlineCreateRow({ parentLabel, onSubmit, onCancel }) {
  const ref = useRef(null);
  const [v, setV] = useState('');
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div
      className="gnode"
      role="presentation"
      data-testid="gside-create"
    >
      <div
        className="grow gside-create-row"
        role="treeitem"
        aria-level={2}
        aria-selected="true"
      >
        <span className="gchev leaf" aria-hidden="true">
          <Chevron />
        </span>
        <span className="gglyph">
          <FolderGlyph />
        </span>
        <input
          ref={ref}
          className="gside-create-input"
          value={v}
          spellCheck={false}
          placeholder="新名称"
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const n = v.trim();
              if (n) onSubmit(n);
            } else if (e.key === 'Escape') {
              onCancel();
            }
          }}
          onBlur={onCancel}
        />
      </div>
    </div>
  );
}

function NodeRow({
  node,
  depth,
  selected,
  kw,
  expanded,
  onSelect,
  onToggle,
  renderRowActions,
  // 就地创建：creatingFor === node.key 时，在这行的 .gkids 里插入一行编辑器
  creatingFor,
  onSubmitCreate,
  onCancelCreate,
}) {
  const hasKids = !!(node.children && node.children.length);
  // 目录节点（kind: 'dir'）即使暂无子目录也用文件夹图标——它仍然是文件夹，
  // 只是暂时没有下级；能不能展开由 hasKids 决定，与图标无关。
  const folder = node.kind === 'dir' || hasKids;
  const open = folder && hasKids && (expanded.has(node.path) || forceOpen(node, kw));
  const on = selected === node.key;

  // 三种节点：整棵树（root，本区的头一行）/ 目录（dir）/ 资源（叶子）。
  // 目录与资源都可拖（资源拖到别的目录 = 换分组）；整树行不可拖。
  // 落点接受目录与整棵树（资源不是容器；拖到整树上 = 资源落到最外层分组「未分类」）。
  const isRoot = node.kind === 'root';
  const drag = useDrag();
  const draggable = !!(drag && (node.kind === 'dir' || node.kind === 'asset'));
  const acceptDrop = !!(drag && (node.kind === 'dir' || isRoot));
  const myDrop = drag ? drag.dropKey : null;
  const dropping = myDrop === node.key + '|into';
  const lineTop = myDrop === node.key + '|before';
  const lineBottom = myDrop === node.key + '|after';
  return (
    <div className={'gnode' + (open ? ' open' : '')} role="presentation">
      <div
        className={
          'grow' + (on ? ' on' : '') + (isRoot ? ' root' : '') +
          (dropping ? ' drop-on' : '') + (lineTop ? ' drop-line-top' : '') + (lineBottom ? ' drop-line-bottom' : '')
        }
        style={{ paddingLeft: 6 + depth * 14 }}
        role="treeitem"
        aria-level={depth + 1}
        aria-expanded={hasKids ? open : undefined}
        aria-selected={on}
        data-testid="gside-row"
        data-key={node.key}
        data-drop={dropping ? 'into' : lineTop ? 'before' : lineBottom ? 'after' : undefined}
        title={node.label || node.name}
        onClick={() => onSelect(node)}
        onDoubleClick={() => hasKids && onToggle(node.path)}
        draggable={draggable || undefined}
        onDragStart={draggable ? (e) => drag.start(node, e) : undefined}
        onDragEnd={drag ? drag.end : undefined}
        onDragOver={acceptDrop ? (e) => drag.over(node, e) : undefined}
        onDragLeave={acceptDrop ? () => drag.leave(node.key) : undefined}
        onDrop={acceptDrop ? (e) => drag.drop(node, e) : undefined}
      >
        <button
          className={'gchev' + (hasKids ? '' : ' leaf')}
          tabIndex={-1}
          aria-hidden="true"
          onClick={(e) => {
            e.stopPropagation();
            if (hasKids) onToggle(node.path);
          }}
        >
          <Chevron />
        </button>
        <span className="gglyph">
          {isRoot ? <RootGlyph /> : folder ? <FolderGlyph /> : <KindGlyph kind={node.kind} />}
        </span>
        <span className="gname">{node.label || node.name}</span>
        {folder && node.total > 0 ? <span className="gcount">{node.total}</span> : null}
        {renderRowActions && node.kind === 'dir' ? (
          <span className="gacts" onClick={(e) => e.stopPropagation()}>
            {renderRowActions(node)}
          </span>
        ) : null}
      </div>
      {hasKids ? (
        <div className="gkids" role="group">
          <div className="gkids-in">
            {node.children.map((c) => (
              <NodeRow
                key={c.path}
                node={c}
                depth={depth + 1}
                selected={selected}
                kw={kw}
                expanded={expanded}
                onSelect={onSelect}
                onToggle={onToggle}
                renderRowActions={renderRowActions}
                creatingFor={creatingFor}
                onSubmitCreate={onSubmitCreate}
                onCancelCreate={onCancelCreate}
              />
            ))}
            {/* 就地创建：在这行的 .gkids 末追加一个 VS Code 风的编辑行。
                提交后整树重取，目录按名字自然排入；取消就消失。 */}
            {creatingFor === node.key && (node.kind === 'root' || node.kind === 'dir') ? (
              <InlineCreateRow
                parentLabel={node.label || node.name}
                onSubmit={async (name) => {
                  await onSubmitCreate(name);
                }}
                onCancel={onCancelCreate}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Sidebar({
  sections,
  selected,
  onSelect,
  storageKey,
  placeholder = '搜索目录与组件',
  // 目录管理（都是可选的）：给了 onCreateAtSelected 才出头部「+」，
  // 给了 renderRowActions 才在目录行显示行内操作——组件本身不认识「新建/改名/删除」，
  // 语义与落到哪个上级目录，全由调用方决定（见 asset/side-tree.jsx）。
  onCreateAtSelected,
  renderRowActions,
  // 拖拽换层级：给了 onMove 才启用。回调只有一个形状——onMove({ node, target })，
  // target = { node } 表示拖进了某个目录，{ root: true } 表示拖到了根。
  onMove,
}) {
  const [expanded, setExpanded] = useState(() => loadExpanded(storageKey));
  // 收起/展开整条侧边栏：也是侧边栏自己的 UI 状态，随 storageKey 落盘。
  // 收起时整列用负 margin 滑出去（见 sidebar.css），把手（.gside-collapse）
  // 搭着车走，永远停在侧边栏右缘——收起后就是 main 左缘的「›」。
  const [folded, setFolded] = useState(() => loadFolded(storageKey));
  const [kwRaw, setKwRaw] = useState('');
  // 就地创建：null = 没在创建；否则 = 父级 key（在该行 .gkids 里插入编辑行）。
  // 落点由 selected 决定（侧边栏高亮 = 父级），让侧边栏和「+」同源。
  const [creatingFor, setCreatingFor] = useState(null);
  const dragRef = useRef(null); // 拖拽源。只存 ref：dragstart 期间渲染会取消拖拽（见 drag.jsx）
  const [dropKey, setDropKey] = useState(null); // 命中的落点 key；'root' = 根
  const kw = kwRaw.trim().toLowerCase();

  const dragApi = makeDragApi({ dragRef, dropKey, setDropKey, onMove });

  // 首次见到整树行时默认把它展开：否则第一眼只有一个收起的大行，什么都看不到。
  // 只在本 storageKey 从没有过存档时播一次——用户后来手动收起，重开也不该被掰回来。
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
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
  }, [sections, storageKey]);

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
          onCollapseToggle={() => setFolded((f) => !f)}
          folded={folded}
        />
        <div
          className="gside-tree"
          role="tree"
          aria-label="全局目录"
          tabIndex={0}
          onKeyDown={onKeyDown}
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
                  renderRowActions={renderRowActions}
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
      </div>
    </DragCtx.Provider>
  );
}
