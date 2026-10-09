// StyleLab 视图：tokens × 方言 正交矩阵的可视化对照。
//
// 选一个 tokens 轴（light/dark/warm/mono）与一个风格包（paper/ledger-offset/...），
// 下方展示同一个组件在不同组合下的渲染。
//
// 这正是 "M+N+K 个文件 → M×N×K 种外观" 经济性的活教材——
// 多风格 UI 组件库到底"多"在哪里，看这一页就懂。
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useStore } from '../store.jsx';

const TOKENS = ['light', 'dark', 'warm', 'mono'];

export default function StyleLabView() {
  const { ui, patchUi } = useStore();
  const tokens = ui.labTokens || 'light';
  const componentId = ui.labComponent || 'btn';
  const [packs, setPacks] = useState(null);
  const [manifest, setManifest] = useState(null);
  const [preview, setPreview] = useState(null);
  const [err, setErr] = useState('');

  // pack 校验：重设/删包后，持久化的 labStyle 可能指向不存在的 pack（如 terra），
  // 直接请求会 NOT_FOUND（接口调用失败）。packs 到位后解析出有效值并回写，
  // 纠正持久化状态；无有效 pack 前不发请求。
  const packNames = Object.keys(packs?.packs || {});
  const style = packNames.includes(ui.labStyle) ? ui.labStyle
    : (packNames.includes('hairline') ? 'hairline' : (packNames[0] || ''));

  useEffect(() => {
    api('/api/studio/packs').then(setPacks).catch((e) => setErr(String(e.message || e)));
  }, []);
  // 回写纠正后的 style，持久化状态一次性自愈
  useEffect(() => {
    if (packs && style && ui.labStyle !== style) patchUi({ labStyle: style });
  }, [packs, style, ui.labStyle, patchUi]);
  useEffect(() => {
    if (!style) return undefined;
    api(`/api/studio/manifest?style=${encodeURIComponent(style)}`).then(setManifest).catch(() => {});
    return undefined;
  }, [style]);
  useEffect(() => {
    if (!style) return undefined;
    api(`/api/studio/preview/${componentId}?style=${encodeURIComponent(style)}`)
      .then(setPreview)
      .catch((e) => setErr(String(e.message || e)));
    return undefined;
  }, [componentId, style]);

  // 按 pack 过滤组件列表
  const componentsByPack = useMemo(() => {
    if (!manifest) return {};
    const out = {};
    for (const c of manifest.components) {
      (out[c.pack] = out[c.pack] || []).push(c);
    }
    return out;
  }, [manifest]);

  if (err) return <div className="empty bad">接口调用失败：{err}</div>;

  return (
    <div className="stack">
      <div className="card">
        <div className="colhead">选择</div>
        <dl className="kv">
          <div className="kv-row">
            <dt>tokens</dt>
            <dd>
              {TOKENS.map((t) => (
                <button
                  key={t}
                  className={'btn small' + (tokens === t ? '' : ' ghost')}
                  onClick={() => patchUi((u) => ({ ...u, labTokens: t }))}
                  style={{ marginRight: 6 }}
                >
                  {t}
                </button>
              ))}
              <span className="muted" style={{ marginLeft: 8, fontSize: 11 }}>数据属性 data-tokens={tokens} 切到对应 tokens.css</span>
            </dd>
          </div>
          <div className="kv-row">
            <dt>风格包</dt>
            <dd>
              {packs && Object.values(packs.packs).map((p) => (
                <button
                  key={p.name}
                  className={'btn small' + (style === p.name ? '' : ' ghost')}
                  onClick={() => patchUi((u) => ({ ...u, labStyle: p.name }))}
                  style={{ marginRight: 6 }}
                >
                  {p.name}
                </button>
              ))}
            </dd>
          </div>
          <div className="kv-row">
            <dt>组件</dt>
            <dd>
              {Object.entries(componentsByPack).map(([pname, list]) => (
                <span key={pname} style={{ marginRight: 12 }}>
                  <span className="muted mono" style={{ fontSize: 11, marginRight: 6 }}>{pname}/</span>
                  {list.map((c) => (
                    <button
                      key={c.id}
                      className={'btn small' + (componentId === c.id ? '' : ' ghost')}
                      onClick={() => patchUi((u) => ({ ...u, labComponent: c.id, labStyle: c.pack }))}
                      style={{ marginRight: 4 }}
                    >
                      {c.id}
                    </button>
                  ))}
                </span>
              ))}
            </dd>
          </div>
        </dl>
      </div>

      {preview && (
        <div className="card">
          <div className="colhead">
            <span>预览 · {componentId} × {style}</span>
            <a
              className="btn small ghost"
              href={`/api/studio/preview/${componentId}?style=${style}`}
              target="_blank"
              rel="noreferrer"
            >
              打开
            </a>
          </div>
          <div
            // 把 tokens 与 css 注入到沙箱 div，自包含预览
            dangerouslySetInnerHTML={{ __html: `<style>${preview.tokens}\n${preview.css}</style>${preview.html}` }}
            data-tokens={tokens}
            data-style={style}
            style={{ padding: 16, border: 'var(--border)', borderRadius: 4 }}
          />
          <pre style={{ marginTop: 12, padding: 10, background: 'var(--soft)', borderRadius: 4, fontSize: 11, overflow: 'auto' }}>
{preview.html}
          </pre>
        </div>
      )}
    </div>
  );
}
