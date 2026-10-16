// 子目录卡片：目录树之外的第二种钻取入口。
// 计数只报「直接子项」（本文件夹直属资源 + 子文件夹数），不递归后代——
// 递归总数会把子文件夹内部的内容量泄露到上一层（03 主页面任务的差距 #2）。
// 批量模式下显示勾选框；点勾选不触发钻取。
// 1.2 起：批量模式下右上「▸」可展开，列出本目录直属子文件（从 tree.groups 查），逐个勾选。
// 父勾选三态：未选 / 部分（–） / 整选（整选 = 递归包含子目录全部资源，目录整选 + 子文件可混选）。
// 删除按钮常驻可见（ui-ux-pro-max Priority 2 反模式「hover only」——
// hover 才出现的破坏性操作等于不存在）。
import { useState } from 'react';
import { byOrder } from './tree.jsx';

export function SubdirCard({
  node, onSelect, onRemove,
  selectable = false,
  selected = new Set(),        // Set<`组/资源名`>：散选子文件的 key 集（浏览器/画廊都传）
  selectedDirs = new Set(),    // Set<目录 path>：整选（递归）的目录路径
  onToggle = () => {},         // 兼容老调用（svg/gallery.jsx 只传 node+onSelect）：无 handler 时不崩
  onToggleDir = () => {},
  tree,
}) {
  // 同 AssetCard：只在 onClick 里 toggle 一次，onChange 置空（防 double-toggle）。
  const handleCheck = (e) => {
    e.stopPropagation();
    onToggleDir && onToggleDir(node.path);
  };
  const direct = node.direct?.length ?? 0;
  const subs = node.children?.length ?? 0;
  const meta = [
    direct > 0 ? `${direct} 资源` : '',
    subs > 0 ? `${subs} 文件夹` : '',
  ].filter(Boolean).join(' · ') || '空';

  // 1.2 展开：批量模式 + tree.groups 里有本目录记录 → 列出直属子文件供勾选
  const [expanded, setExpanded] = useState(false);
  // 按 byOrder 排（与主页面卡片、侧边栏同序）——批量勾选列表的序不能另起一套
  const childAssets = ((tree?.groups || []).find((g) => g.path === node.path)?.assets || [])
    .slice()
    .sort(byOrder);
  const canExpand = !!selectable && childAssets.length > 0;
  // 整选（selectedDirs 含本 path）= 父被整选 → 子全算选中。
  // 注意：选中态一律从 selectedDirs 派生，不用 selected（那是 Set，恒 truthy，会把每个卡都点亮）。
  const wholeSelected = selectedDirs.has(node.path);
  // 散选子文件：本目录直属资源里、被 selected 命中的（key = `path/name`）
  const childPicked = new Set();
  if (!wholeSelected) {
    for (const a of childAssets) {
      if (selected.has(`${node.path}/${a.name}`)) childPicked.add(a.name);
    }
  }
  // 父勾选三态：整选→checked；散选部分→partial（–）；其它→unchecked
  const parentIndeterminate = !wholeSelected && childPicked.size > 0;
  const parentChecked = wholeSelected;

  const handleChildClick = (name) => (e) => {
    e.stopPropagation();
    if (wholeSelected) {
      // 整选中点掉一个子文件 = 转为「其余子文件逐个选中」（与原型 v3 一致）
      onToggleDir(node.path);
      for (const a of childAssets) {
        if (a.name !== name) onToggle(node.path, a.name);
      }
    } else {
      onToggle(node.path, name);
    }
  };

  const handleExpandToggle = (e) => {
    e.stopPropagation();
    setExpanded((v) => !v);
  };

  return (
    <div
      className={'am-subdir' + (wholeSelected ? ' selected' : '')}
      onClick={() => !selectable && onSelect(node.path)}
      title={node.path}
      data-testid={`subdir-card-${node.path}`}
    >
      <div className="am-subdir-row">
        {selectable ? (
          <input
            type="checkbox"
            className="am-subdir-check"
            aria-label={`选择目录 ${node.path}`}
            checked={parentChecked}
            ref={(el) => { if (el) el.indeterminate = parentIndeterminate; }}
            onClick={handleCheck}
            onChange={() => {}}
            data-testid={`subdir-check-${node.path}`}
          />
        ) : null}
        {canExpand ? (
          <button
            type="button"
            className="am-subdir-expand"
            onClick={handleExpandToggle}
            title={expanded ? '收起子文件' : '展开勾选子文件'}
            data-testid={`subdir-expand-${node.path}`}
          >
            {expanded ? '▾' : '▸'}
          </button>
        ) : null}
        <span className="am-subdir-name">{node.label || node.name}</span>
        <span className="am-subdir-count" title={`本文件夹直属 ${direct} 个资源，子文件夹 ${subs} 个`}>{meta}</span>
        {!selectable && onRemove ? (
          <button
            className="am-subdir-x"
            title={`删除目录 ${node.path}`}
            aria-label={`删除目录 ${node.label || node.name}`}
            data-testid={`subdir-remove-${node.path}`}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(node.path);
            }}
          >
            ×
          </button>
        ) : null}
      </div>
      {canExpand && expanded ? (
        <div className="am-subdir-children" data-testid={`subdir-children-${node.path}`}>
          {childAssets.map((a) => {
            const on = wholeSelected || childPicked.has(a.name);
            return (
              <div
                key={a.name}
                className={'am-subdir-child' + (on ? ' pick' : '')}
                onClick={handleChildClick(a.name)}
                title={`${node.path}/${a.name}`}
                data-testid={`subdir-child-${a.name}`}
              >
                <span className="am-subdir-child-cb" />
                <span className="am-subdir-child-nm mono">{a.name}</span>
                {a.label && a.label !== a.name ? (
                  <span className="am-subdir-child-lbl muted">{a.label}</span>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
