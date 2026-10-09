// ComponentDoc 视图：单个组件的文档页（Element Plus 形态）。
//
// 三大块：
//   1. 实时预览：注入当前 style + tokens 的 CSS，挂载 React 绑定 —— 真交互、可 hover/click
//   2. 代码片段：spec.examples[] 每条都给出可复制的 HTML + JSX
//   3. 契约面板：props 表 + classes 列表 + tokens 引用 + 原始 spec 链接
//
// 设计要点：CSS-first 核心 + React 薄绑定，所以「React 预览」和「HTML 粘贴」渲染
// 出同一个东西——切风格包立刻两边都跟着变，这是「同源」的可视化证明。
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useStore } from '../store.jsx';
import { Copyable } from '../components/ui.jsx';

const CATEGORY_LABELS = {
  action: '操作',
  container: '容器',
  list: '列表',
  data: '数据',
};

// class 字符串 → React props 的简易翻译（spec 示例里出现 .btn.ghost 就给 {variant: 'ghost'}）
function propsFromClassNames(html, spec) {
  const out = {};
  for (const [name, spec_] of Object.entries(spec.props || {})) {
    if (spec_.type !== 'enum') continue;
    for (const v of spec_.values || []) {
      if (!v) continue;
      const m = new RegExp(`\\.${name}\\.${v}\\b`).exec(html);
      if (m) { out[name] = v; break; }
    }
  }
  return out;
}

function PreviewLive({ html, Component, componentProps }) {
  if (Component) {
    // 走 React 绑定：真交互（hover/click/disabled 都对）。
    // 本地 Suspense 必须有：绑定 chunk 的加载只应占位预览区自身，
    // 否则挂起会穿透到 App 顶层的 Suspense，把整个文档页换成「加载中…」。
    return (
      <Suspense fallback={<span className="muted">绑定载入中…</span>}>
        <Component {...componentProps}>{stripHtml(html)}</Component>
      </Suspense>
    );
  }
  // 无绑定（用户扩展组件时还没写 .jsx）：退化为静态 HTML
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function stripHtml(html) {
  // 从 <button class="btn">确定</button> 里抠出"确定"作为 React children
  const m = html.match(/>([^<]*?)</);
  return m ? m[1] : '';
}

export default function ComponentDocView() {
  const { ui, patchUi } = useStore();
  const id = ui.docComponent;
  const tokensAxis = ui.docTokens || 'light';
  const style = ui.docStyle || 'paper';

  const [doc, setDoc] = useState(null);
  const [tokensCss, setTokensCss] = useState('');
  const [packList, setPackList] = useState([]);
  const [err, setErr] = useState('');

  // 风格包清单动态拉取——新增 pack 无需改这份视图
  useEffect(() => {
    api('/api/studio/packs')
      .then((r) => setPackList(Object.values(r.packs || {})))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    setDoc(null);
    api(`/api/studio/component/${id}?style=${style}&tokens=${tokensAxis}`)
      .then((d) => {
        setDoc(d);
        setTokensCss(d.tokens || '');
      })
      .catch((e) => setErr(String(e.message || e)));
  }, [id, style, tokensAxis]);

  // 按 pack + id 解析 React 绑定：import.meta.glob 在构建期展开成全量绑定索引，
  // 运行时查表——查不到（该 pack 没有自己的绑定）返回 null，PreviewLive 退化为
  // 静态 HTML（class 契约 + spec.example）。绑定沿 extends 链继承：用 doc.sourcePack
  // （service 解析出的 spec 实际归属 pack）查表，而非当前选中的 style——
  // ledger-offset 这类覆盖包继承 paper 的 spec，渲染它的也是 paper 的绑定。
  // 此前用模板字符串动态 import：glob 表里没有的键会在 render 期同步 throw，
  // 打穿错误边界（面板整页报错），降级注释形同虚设。
  const BINDINGS = import.meta.glob('../../styles/*/components/*.jsx');
  const Component = useMemo(() => {
    const pack = doc?.sourcePack || style;
    if (!id || !pack) return null;
    const loader = BINDINGS[`../../styles/${pack}/components/${id}.jsx`];
    return loader ? lazy(loader) : null;
  }, [id, style, doc]);

  if (!id) return <div className="empty muted">选择一个组件查看文档 — 从「组件目录」tab 进入</div>;
  if (err) return <div className="empty bad">加载失败：{err}</div>;
  if (!doc) return <div className="empty muted">载入 {id}…</div>;

  // 拼接一份「style + tokens」的 <style>，让预览区自包含
  const cssText = Object.values(doc.css || {}).join('\n\n');
  const styleBlock = tokensCss + '\n' + cssText;

  const spec = doc.spec;
  const examples = spec.examples || [];
  const props = spec.props || {};

  return (
    <div className="stack">
      {/* 顶部导航条 */}
      <div className="toolbar">
        <button className="btn ghost small" onClick={() => patchUi({ view: 'catalog', docComponent: null })}>
          ← 返回组件目录
        </button>
        <span className="muted">|</span>
        <strong>{spec.id}</strong>
        <span className="tag">{spec.title}</span>
        <span className="tag">{CATEGORY_LABELS[spec.category] || spec.category}</span>
        <span style={{ marginLeft: 'auto' }} />
        <span className="muted">风格包:</span>
        {packList.map((p) => (
          <button
            key={p.name}
            className={'btn small' + (style === p.name ? '' : ' ghost')}
            onClick={() => patchUi({ docStyle: p.name })}
            title={p.label}
          >
            {p.name}
          </button>
        ))}
        {/* pack 自带 palette 时 tokens 轴切换无效果——隐藏避免误导 */}
        {!(packList.find((p) => p.name === style) || {}).ownTokens && (
          <>
            <span className="muted" style={{ marginLeft: 8 }}>tokens:</span>
            {['light', 'dark', 'warm', 'mono'].map((t) => (
              <button
                key={t}
                className={'btn small' + (tokensAxis === t ? '' : ' ghost')}
                onClick={() => patchUi({ docTokens: t })}
              >
                {t}
              </button>
            ))}
          </>
        )}
      </div>

      {/* 描述 */}
      <div className="sheet">
        <div className="sheet-b">
          <div style={{ fontSize: 14, marginBottom: 8 }}>{spec.description}</div>
          <div className="muted mono" style={{ fontSize: 11 }}>
            契约: <code>{spec.classContract}</code>
          </div>
        </div>
      </div>

      {/* 实时预览：每个 example 一块白底 demo（无线，承托被展示的组件本身） */}
      <div className="sheet">
        <div className="sheet-h">
          <span>实时预览 · {spec.id} × {style} / {tokensAxis}</span>
          <span className="muted tag">{examples.length} 个示例</span>
        </div>
        <div className="sheet-b">
        {/* 把 tokens + strategy CSS 注入到沙箱 div，自包含预览 */}
        <style dangerouslySetInnerHTML={{ __html: styleBlock }} />
        {examples.map((ex, i) => (
          <div key={i} className="demo">
            <div className="demo-h">
              <span>{ex.title}</span>
              <Copyable text={ex.html} className="tag mono">复制 HTML</Copyable>
            </div>
            <div className="demo-b">
              <PreviewLive
                html={ex.html}
                Component={Component}
                componentProps={propsFromClassNames(ex.html, spec)}
              />
            </div>
            <pre
              className="snippet-box"
              style={{ margin: 0, padding: '8px 14px', fontSize: 11 }}
            >
{ex.html}
            </pre>
          </div>
        ))}
        </div>
      </div>

      {/* Props 表 */}
      <div className="sheet">
        <div className="sheet-h">
          <span>Props</span>
          <span className="muted tag">{Object.keys(props).length} 项</span>
        </div>
        <div className="sheet-b">
          <table className="levels">
            <thead>
              <tr><th>名称</th><th>类型</th><th>可选值 / 默认</th><th>说明</th></tr>
            </thead>
            <tbody>
              {Object.entries(props).map(([pname, p]) => (
                <tr key={pname}>
                  <td className="mono">{pname}{p.required && <span className="bad">*</span>}</td>
                  <td className="mono muted">{p.type}</td>
                  <td className="mono muted">
                    {p.values ? p.values.filter(Boolean).join(' · ') || '<empty>' : ''}
                    {p.default !== undefined && p.default !== '' && (
                      <span style={{ marginLeft: 6 }}>默认 <code>{String(p.default)}</code></span>
                    )}
                  </td>
                  <td className="muted">{p.description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CSS 契约 */}
      <div className="sheet">
        <div className="sheet-h">
          <span>CSS 契约</span>
          <span className="muted tag">{(spec.classes || []).length} 个类</span>
        </div>
        {(spec.classes || []).map((cls) => (
          <div key={cls} className="row">
            <div className="name mono">.{cls}</div>
            <div className="desc muted">用于该组件的 CSS 选择器（见 <code>src/styles/{style}/{cls.split(/\s|\./)[0]}.css</code>）</div>
          </div>
        ))}
        <div style={{ padding: '8px 12px' }}>
          <span className="muted">tokens 引用：</span>
          {(spec.tokens || []).map((t) => (
            <span key={t} className="tag mono" style={{ marginRight: 4 }}>{t}</span>
          ))}
        </div>
      </div>

      {/* 数据契约 */}
      <div className="sheet">
        <div className="sheet-h">数据契约</div>
        <div className="row">
          <div className="name mono">GET /api/studio/component/{id}?style={style}&tokens={tokensAxis}</div>
          <div className="desc muted">返回完整 spec + css + tokens（机器可读）</div>
          <div className="acts">
            <a
              className="btn small ghost"
              href={`/api/studio/component/${id}?style=${style}&tokens=${tokensAxis}`}
              target="_blank"
              rel="noreferrer"
            >
              打开
            </a>
          </div>
        </div>
        <div className="row">
          <div className="name mono">GET /api/studio/preview/{id}?style={style}&tokens={tokensAxis}</div>
          <div className="desc muted">自包含 HTML 片段（无浏览器依赖）</div>
          <div className="acts">
            <a
              className="btn small ghost"
              href={`/api/studio/preview/${id}?style=${style}&tokens=${tokensAxis}`}
              target="_blank"
              rel="noreferrer"
            >
              打开
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
