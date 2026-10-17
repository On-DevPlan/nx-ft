// 侧边栏的行渲染：整树行 / 目录行 / 资源叶子的递归节点，与 VS Code 风格的
// 「在被选中的行里就地新建目录」编辑行。只管「一行怎么长」，状态与语义
// （选中、展开、创建落点）全部由 index.jsx 的 Sidebar 下发。
import { useEffect, useRef, useState } from 'react';
import { Chevron, FolderGlyph, KindGlyph, MoreGlyph, RootGlyph } from './icons.jsx';
import { forceOpen } from './model.js';
import { useDrag } from './drag.jsx';

// 在被选中的那行里就地创建新目录：VS Code 风格——
// 跟父级那行同形（chev + 文件夹图标 + 输入框），出现在它 .gkids 里的最末。
// 重表单 → 极轻：无重框、聚焦一根细下边、Enter 提交、Escape/失焦 取消。
function InlineCreateRow({ onSubmit, onCancel }) {
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

export function NodeRow({
  node,
  depth,
  selected,
  kw,
  expanded,
  onSelect,
  onToggle,
  // 「更多操作」：给了 rowMenu 才在目录行/资源行显示「⋯」并响应右键；
  // 菜单里有什么、点了干什么，由调用方的 rowMenu(node) 给出（见 asset/side-tree.jsx）。
  // anchor 传唤起元素（⋯ 按钮）或光标坐标，菜单贴着它定位（弹层由 Sidebar 统一渲染）。
  rowMenu,
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
  // 落点：目录行（放进目录 / 同级前后插）、整树行（移到最外层）、
  // 资源行（只作同组资源的前后插落点——资源不是容器，接收不代表「能放进去」，
  // 具体合法性在 drag.jsx 的 resolve 里判，这里只负责把事件接上）。
  const acceptDrop = !!(drag && (node.kind === 'dir' || isRoot || node.kind === 'asset'));
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
        // 根行也有右键菜单（新建 / 在文件管理器中打开，见调用方的 rowMenu）——
        // 「整个侧边栏都该有右键」是明确要求，根行不该是例外。
        onContextMenu={
          rowMenu
            ? (e) => {
                e.preventDefault();
                rowMenu(node, { x: e.clientX, y: e.clientY });
              }
            : undefined
        }
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
        {rowMenu ? (
          <span className="gacts" onClick={(e) => e.stopPropagation()}>
            <button
              title="更多操作"
              aria-label={`更多操作：${node.label || node.name}`}
              onClick={(e) => {
                // 锚点用整行的 rect，不用 ⋯ 按钮自己的：.gacts 平时 display:none
                // （hover / 选中才出），键盘唤起时按钮 rect 全 0，菜单会飘到左上角。
                // 行永远有真实 rect，菜单落在行下方，位置永远说得通。
                const r = (e.currentTarget.closest('.grow') || e.currentTarget).getBoundingClientRect();
                rowMenu(node, { x: r.left, y: r.bottom + 4 });
              }}
            >
              <MoreGlyph />
            </button>
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
                rowMenu={rowMenu}
                creatingFor={creatingFor}
                onSubmitCreate={onSubmitCreate}
                onCancelCreate={onCancelCreate}
              />
            ))}
            {/* 就地创建：在这行的 .gkids 末追加一个 VS Code 风的编辑行。
                提交后整树重取，目录按名字自然排入；取消就消失。 */}
            {creatingFor === node.key && (node.kind === 'root' || node.kind === 'dir') ? (
              <InlineCreateRow
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
