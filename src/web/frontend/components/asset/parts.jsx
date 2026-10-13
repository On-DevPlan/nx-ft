// 资产域共享的呈现件：面包屑、标签云、相对时间、资源卡片、子目录卡片。
import { Fragment } from 'react';

export function relTime(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const d = Date.now() - t;
  if (d < 60_000) return '刚刚';
  if (d < 3_600_000) return Math.floor(d / 60_000) + ' 分钟前';
  if (d < 86_400_000) return Math.floor(d / 3_600_000) + ' 小时前';
  if (d < 30 * 86_400_000) return Math.floor(d / 86_400_000) + ' 天前';
  return new Date(t).toISOString().slice(0, 10);
}

// 面包屑：items = [{ label, onClick?, mono?, title? }]
// 带 onClick 的段可点（返回上一层）；最后一段通常是当前页（不可点）。
export function Crumbs({ items }) {
  return (
    <nav className="crumbs" aria-label="breadcrumb" data-testid="crumbs">
      {items.map((it, i) => (
        <Fragment key={i}>
          {i > 0 ? <span className="crumb-sep">/</span> : null}
          {it.onClick ? (
            <button
              className="crumb-link"
              onClick={it.onClick}
              title={it.title}
              data-testid={`crumb-${i}`}
            >
              {it.label}
            </button>
          ) : (
            <span
              className={'crumb-cur' + (it.mono ? ' mono' : '')}
              title={it.title}
              data-testid={`crumb-${i}-current`}
            >
              {it.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}

// 标签云：管理页的筛选轴。点击切换选中（多选 = AND），带计数与清除。
export function TagCloud({ tags, active = [], onToggle, onClear }) {
  if (!tags?.length) return null;
  const hasActive = active.length > 0;
  return (
    <div className="tag-cloud">
      {tags.map((t) => (
        <button
          key={t.name}
          className={'tag-chip' + (active.includes(t.name) ? ' active' : '')}
          title={`${t.count} 个资源`}
          onClick={() => onToggle(t.name)}
        >
          {t.name}
          <span className="tag-chip-count">{t.count}</span>
        </button>
      ))}
      {hasActive ? (
        <button className="tag-chip ghost" onClick={onClear}>清除筛选</button>
      ) : null}
    </div>
  );
}

// 资源卡片：点卡片进工作台；标签片可点即筛（不发散冒泡）。
// 可选勾选框：批量模式下显示。选中态与父级 selected 集合联动。
export function AssetCard({ asset, groupPath, activeTags = [], onOpen, onTagToggle, selectable, selected, onToggle }) {
  // 修：勾选框需要 onClick + onChange 双拦截，否则冒泡到外层 div 会触发 onOpen 跳转。
  const handleCheck = (e) => {
    e.stopPropagation();
    onToggle && onToggle(groupPath, asset.name);
  };
  return (
    <div
      className={'am-card' + (selected ? ' selected' : '')}
      onClick={() => !selectable && onOpen(groupPath, asset.name)}
      title={`打开工作台: ${groupPath}/${asset.name}`}
      data-testid={`asset-card-${asset.name}`}
    >
      {selectable ? (
        <input
          type="checkbox"
          className="am-card-check"
          aria-label={`选择 ${asset.name}`}
          checked={!!selected}
          onClick={handleCheck}
          onChange={handleCheck}
          data-testid={`asset-card-check-${asset.name}`}
        />
      ) : null}
      <div className="am-card-label">{asset.label}</div>
      <div className="am-card-name mono">{asset.name}</div>
      <div className="am-card-tags">
        {asset.tags.map((t) => (
          <span
            key={t}
            className="tag-chip"
            title="点击按此标签筛选"
            onClick={(e) => {
              e.stopPropagation();
              if (!activeTags.includes(t)) onTagToggle(t);
            }}
          >
            {t}
          </span>
        ))}
      </div>
      <div className="am-card-foot">
        <span>{asset.styles} 风格</span>
        <span className="mono">{asset.activeStyle || '-'}</span>
        <span>{relTime(asset.updatedAt)}</span>
      </div>
    </div>
  );
}

// 批量操作条：进入批量模式后顶部出现，列出「已选 N」「全选」「反选」「取消」+ 一组批量动作。
// actions: [{ label, testId, onClick, danger, disabled }] —— 支持资源与目录不同动作。
export function BatchBar({ count, dirCount = 0, total, onSelectAll, onInvert, onCancel, actions = [] }) {
  return (
    <div className="batch-bar" role="toolbar" aria-label="批量操作" data-testid="batch-bar">
      <div className="batch-bar-left">
        <button className="btn small" onClick={onSelectAll} data-testid="batch-select-all">
          全选当前页
        </button>
        <button className="btn small ghost" onClick={onInvert} data-testid="batch-invert">反选</button>
        <button className="btn small ghost" onClick={onCancel} data-testid="batch-cancel">取消批量</button>
      </div>
      <div className="batch-bar-middle">
        已选 <strong data-testid="batch-count">{count}</strong> 项资源
        {dirCount > 0 ? (
          <>
            {' · '}
            <strong data-testid="batch-dir-count">{dirCount}</strong> 个目录
          </>
        ) : null}
        <span className="muted"> / 共 {total} 项</span>
      </div>
      <div className="batch-bar-right">
        {actions.map((a) => (
          <button
            key={a.testId}
            className={'btn small' + (a.danger ? ' danger' : '')}
            onClick={a.onClick}
            disabled={a.disabled}
            data-testid={a.testId}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// 子目录卡片：目录树之外的第二种钻取入口（大目标、带总数）。
// 批量模式下显示勾选框；点勾选不触发钻取。
export function SubdirCard({ node, onSelect, onRemove, selectable, selected, onToggle }) {
  const handleCheck = (e) => {
    e.stopPropagation();
    onToggle && onToggle(node.path);
  };
  return (
    <div
      className={'am-subdir' + (selected ? ' selected' : '')}
      onClick={() => !selectable && onSelect(node.path)}
      title={node.path}
      data-testid={`subdir-card-${node.path}`}
    >
      {selectable ? (
        <input
          type="checkbox"
          className="am-subdir-check"
          aria-label={`选择目录 ${node.path}`}
          checked={!!selected}
          onClick={handleCheck}
          onChange={handleCheck}
          data-testid={`subdir-check-${node.path}`}
        />
      ) : null}
      <span className="am-subdir-name">{node.label || node.name}</span>
      <span className="am-subdir-count">{node.total} 资源</span>
      {!selectable ? (
        <span
          className="am-subdir-x"
          title="删除该子分组"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(node.path);
          }}
        >
          ×
        </span>
      ) : null}
    </div>
  );
}
