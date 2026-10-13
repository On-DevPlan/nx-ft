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
    <nav className="crumbs">
      {items.map((it, i) => (
        <Fragment key={i}>
          {i > 0 ? <span className="crumb-sep">/</span> : null}
          {it.onClick ? (
            <button className="crumb-link" onClick={it.onClick} title={it.title}>
              {it.label}
            </button>
          ) : (
            <span className={'crumb-cur' + (it.mono ? ' mono' : '')} title={it.title}>
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
export function AssetCard({ asset, groupPath, activeTags = [], onOpen, onTagToggle }) {
  return (
    <button
      className="am-card"
      onClick={() => onOpen(groupPath, asset.name)}
      title={`打开工作台: ${groupPath}/${asset.name}`}
    >
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
    </button>
  );
}

// 子目录卡片：目录树之外的第二种钻取入口（大目标、带总数）。
export function SubdirCard({ node, onSelect, onRemove }) {
  return (
    <button className="am-subdir" onClick={() => onSelect(node.path)} title={node.path}>
      <span className="am-subdir-name">{node.label || node.name}</span>
      <span className="am-subdir-count">{node.total} 资源</span>
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
    </button>
  );
}
