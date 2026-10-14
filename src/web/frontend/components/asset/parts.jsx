// 资产域共享的呈现件：面包屑、标签云、相对时间、资源卡片、子目录卡片。
import { Fragment, useState } from 'react';

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
export function AssetCard({ asset, groupPath, activeTags = [], onOpen, onTagToggle, selectable, selected, onToggle, quickAction, kind = 'html' }) {
  // 勾选框只在 onClick 里 toggle 一次：onChange 再绑同一段会造成
  // 「点击一次触发两次 toggle」——选中立刻被自己取消（真实点击验证踩过）。
  // onChange 仅用于受控组件的 React 契约，不做任何事。
  const handleCheck = (e) => {
    e.stopPropagation();
    onToggle && onToggle(groupPath, asset.name);
  };
  const handleQuick = (e) => {
    e.stopPropagation();
    quickAction && quickAction.onClick();
  };
  const noun = kind === 'color' ? '调色板' : kind === 'svg' ? 'SVG 资源' : 'HTML 资源';
  const studioHint = kind === 'color' ? ' · 右上的 Studio 按钮直接进全屏模式' : '';
  return (
    <div
      className={'am-card' + (selected ? ' selected' : '') + (quickAction ? ' am-card--has-quick' : '')}
      onClick={() => !selectable && onOpen(groupPath, asset.name)}
      title={`打开${noun}: ${groupPath}/${asset.name}${studioHint}`}
      data-testid={`asset-card-${asset.name}`}
    >
      {selectable ? (
        <input
          type="checkbox"
          className="am-card-check"
          aria-label={`选择 ${asset.name}`}
          checked={!!selected}
          onClick={handleCheck}
          onChange={() => {}}
          data-testid={`asset-card-check-${asset.name}`}
        />
      ) : null}
      {quickAction && !selectable ? (
        <button
          type="button"
          className="am-card-quick"
          title={quickAction.title || quickAction.label}
          onClick={handleQuick}
          data-testid={`asset-card-quick-${asset.name}`}
        >
          {quickAction.label} →
        </button>
      ) : null}
      {asset.swatches && asset.swatches.length ? (
        <div className="am-card-swatches" title="色卡预览（前 5 色）">
          {asset.swatches.map((hex, i) => (
            <span key={i} className="am-card-swatch" style={{ background: hex }} title={hex} />
          ))}
        </div>
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

// 内联创建行（网盘式）：点「+ 新建」后原位出现的输入框。
// Enter = 确认，Esc = 取消，失焦 = 取消。只问名字——网盘不问你「展示名」和「标签」。
// error 有值时显示在输入行下方（Priority 8：错误出现在字段旁，不只靠 toast）。
export function InlineCreateRow({ placeholder, confirmText = '创建', hint, onConfirm, onCancel, testId }) {
  const [value, setValue] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const v = value.trim();
    if (!v) return onCancel();
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      await onConfirm(v);
    } catch (e) {
      setErr(String((e && e.message) || e));
      setBusy(false);
    }
  };
  return (
    <div className="inline-create-wrap" data-testid={testId}>
      <div className="inline-create">
        <input
          className="inline-create-input"
          autoFocus
          spellCheck="false"
          placeholder={placeholder}
          value={value}
          disabled={busy}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') onCancel();
          }}
          data-testid={testId ? `${testId}-input` : undefined}
        />
        {hint ? <span className="muted inline-create-hint">{hint}</span> : null}
        <button className="btn small" disabled={busy} onMouseDown={(e) => { e.preventDefault(); submit(); }}>
          {busy ? '创建中…' : confirmText}
        </button>
        <button className="btn small ghost" disabled={busy} onMouseDown={(e) => { e.preventDefault(); onCancel(); }}>
          取消
        </button>
      </div>
      {err ? <div className="inline-create-err bad" data-testid={testId ? `${testId}-err` : undefined}>{err}</div> : null}
    </div>
  );
}

// 子目录卡片：目录树之外的第二种钻取入口（大目标、带总数）。
// 批量模式下显示勾选框；点勾选不触发钻取。
// 删除按钮常驻可见（ui-ux-pro-max Priority 2 反模式「hover only」——
// hover 才出现的破坏性操作等于不存在）。
export function SubdirCard({ node, onSelect, onRemove, selectable, selected, onToggle }) {
  // 同 AssetCard：只在 onClick 里 toggle 一次，onChange 置空（防 double-toggle）。
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
          onChange={() => {}}
          data-testid={`subdir-check-${node.path}`}
        />
      ) : null}
      <span className="am-subdir-name">{node.label || node.name}</span>
      <span className="am-subdir-count">{node.total} 资源</span>
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
  );
}
