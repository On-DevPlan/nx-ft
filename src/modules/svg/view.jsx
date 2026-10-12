// svg 模块的 React 视图：矢量资产画廊。
//
// 模式（仿 StyleLab）：左/上选组 → 网格预览所有 items → 点开看单件详情。
//
// 三件事照做：
//   1. 数据从 /api/svg/manifest 拉，失败有兜底（empty.bad）
//   2. 顶部放 CliHints 让 Web 操作都对应一条 CLI
//   3. 用 .card / .row / .tag / .stack 原子类，不自己写样式
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../studio/api/client.js';
import { CliHints } from '../../studio/components/CliHints.jsx';
import { Copyable } from '../../studio/components/ui.jsx';
import { useStore } from '../../studio/store.jsx';

export default function SvgGallery() {
  const { ui, patchUi } = useStore();
  const group = ui.svgGroup || null;
  const itemName = ui.svgItem || null;
  const [manifest, setManifest] = useState(null);
  const [detail, setDetail] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/api/svg/manifest')
      .then(setManifest)
      .catch((e) => setErr(String(e.message || e)));
  }, []);

  // 持久化 group / item 选择被删/被改时自愈到第一个有效值
  const groups = manifest?.groups || [];
  const groupIds = groups.map((g) => g.id);
  const safeGroup = group && groupIds.includes(group) ? group : (groupIds[0] || null);

  useEffect(() => {
    if (manifest && safeGroup !== group) patchUi({ svgGroup: safeGroup });
  }, [manifest, safeGroup, group, patchUi]);

  const currentGroup = useMemo(
    () => groups.find((g) => g.id === safeGroup) || null,
    [groups, safeGroup]
  );
  const currentItem = useMemo(() => {
    if (!currentGroup) return null;
    const items = currentGroup.items || [];
    if (itemName && items.some((i) => i.name === itemName)) {
      return items.find((i) => i.name === itemName);
    }
    return items[0] || null;
  }, [currentGroup, itemName]);

  // 拉单件：选组变化或选 item 变化都重新拉。
  // 不在 group 为空时拉（避免启动时第一条请求 404）。
  useEffect(() => {
    if (!currentGroup || !currentItem) {
      setDetail(null);
      return undefined;
    }
    let alive = true;
    api(`/api/svg/preview/${currentGroup.id}/${currentItem.name}`)
      .then((d) => { if (alive) setDetail(d); })
      .catch((e) => { if (alive) setErr(String(e.message || e)); });
    return () => { alive = false; };
  }, [currentGroup, currentItem]);

  if (err) return <div className="empty bad">接口调用失败：{err}</div>;
  if (!manifest) return <div className="empty">加载中…</div>;
  if (!groups.length) {
    return (
      <div className="stack">
        <div className="empty">
          （无 SVG 资产——把 .svg 放进 <code>src/svg/&lt;group&gt;/</code> 并写 spec.json）
        </div>
        <CliHints module="svg" />
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="colhead">组</div>
        <dl className="kv">
          <div className="kv-row">
            <dt>分组</dt>
            <dd>
              {groups.map((g) => (
                <button
                  key={g.id}
                  className={'btn small' + (safeGroup === g.id ? '' : ' ghost')}
                  onClick={() => patchUi({ svgGroup: g.id, svgItem: null })}
                  style={{ marginRight: 6 }}
                >
                  {g.id}
                </button>
              ))}
              <span className="muted" style={{ marginLeft: 8, fontSize: 11 }}>
                viewBox = {currentGroup?.viewBox || '—'}
              </span>
            </dd>
          </div>
          {currentGroup && (
            <div className="kv-row">
              <dt>说明</dt>
              <dd className="muted">{currentGroup.description || '—'}</dd>
            </div>
          )}
        </dl>
      </div>

      {currentGroup && (
        <div className="card">
          <div className="colhead">
            <span>资产 · {currentGroup.id}</span>
            <span className="tag">{currentGroup.items.length} 件</span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 12,
              padding: 12,
            }}
          >
            {currentGroup.items.map((it) => (
              <button
                key={it.name}
                className={'card' + (currentItem && currentItem.name === it.name ? ' active' : '')}
                onClick={() => patchUi({ svgItem: it.name })}
                style={{
                  padding: 16,
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'var(--soft, #f7f7f7)',
                  border: '1px solid var(--border, #ddd)',
                  borderRadius: 4,
                  color: 'inherit',
                }}
                title={it.title}
              >
                <div
                  style={{
                    height: 64,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--ink, #222)',
                  }}
                  dangerouslySetInnerHTML={{ __html: it.name === currentItem?.name && detail ? detail.svg : '' }}
                />
                {!(it.name === currentItem?.name && detail) && (
                  <ItemPreviewPlaceholder viewBox={it.viewBox} />
                )}
                <div className="mono" style={{ fontSize: 12, marginTop: 8 }}>{it.name}</div>
                <div className="muted" style={{ fontSize: 11 }}>{it.title}</div>
              </button>
            ))}
          </div>
          <CliHints module="svg" />
        </div>
      )}

      {currentItem && detail && (
        <div className="card">
          <div className="colhead">
            <span>单件 · {currentGroup.id} / {currentItem.name}</span>
            <a
              className="btn small ghost"
              href={`/api/svg/preview/${currentGroup.id}/${currentItem.name}`}
              target="_blank"
              rel="noreferrer"
            >
              打开
            </a>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              padding: 12,
            }}
          >
            <div className="card" style={{ padding: 16, textAlign: 'center', color: 'var(--ink, #222)' }}>
              <div
                style={{ display: 'inline-block', padding: 16, border: '1px dashed var(--border, #ddd)', borderRadius: 4 }}
                dangerouslySetInnerHTML={{ __html: detail.svg }}
              />
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div className="kv-row">
                <dt>标题</dt>
                <dd>{detail.title}</dd>
              </div>
              <div className="kv-row">
                <dt>viewBox</dt>
                <dd className="mono">{detail.viewBox || '—'}</dd>
              </div>
              <div className="kv-row">
                <dt>标签</dt>
                <dd>
                  {(detail.tags || []).length
                    ? detail.tags.map((t) => <span key={t} className="tag" style={{ marginRight: 4 }}>{t}</span>)
                    : <span className="muted">—</span>}
                </dd>
              </div>
              <div className="kv-row" style={{ alignItems: 'flex-start' }}>
                <dt>源</dt>
                <dd style={{ width: '100%' }}>
                  <Copyable
                    text={`nx-ft/svg/${currentGroup.id}/${currentItem.name}.svg`}
                    title="点击复制 import 子路径"
                  >
                    <code>nx-ft/svg/{currentGroup.id}/{currentItem.name}.svg</code>
                  </Copyable>
                </dd>
              </div>
              <div className="kv-row" style={{ alignItems: 'flex-start' }}>
                <dt>SVG 原文</dt>
                <dd style={{ width: '100%' }}>
                  <Copyable text={detail.svg} title="点击复制 SVG 全文">
                    <pre style={{
                      margin: 0, padding: 8, fontSize: 11, lineHeight: 1.4,
                      background: 'var(--soft, #f7f7f7)', borderRadius: 4, overflow: 'auto', maxHeight: 200,
                    }}>{detail.svg}</pre>
                  </Copyable>
                </dd>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 网格里非选中项的占位（避免 N 次额外请求：只在选中项上拉 preview 一次）
function ItemPreviewPlaceholder({ viewBox }) {
  return (
    <div
      style={{
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--muted, #888)',
        fontSize: 11,
        fontFamily: 'ui-monospace, monospace',
      }}
    >
      {viewBox || 'click to load'}
    </div>
  );
}
