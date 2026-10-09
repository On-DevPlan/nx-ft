// Catalog 视图：左栏选风格包，右栏分类 tab + **自足式组件卡**。
//
// 一张卡 = 完整文档：左侧内联渲染全部 example 变体（class-contract HTML +
// 当前 pack css），右侧并排契约面板（说明 / props 表 / CSS 类 / tokens / API）。
// 没有二级文档页——目录页的职责就是「一眼扫过整套风格的模样与契约」。
//
// 数据要点：catalog 只存各 pack 自有 spec（继承不复制），所以客户端要沿
// extends 链解析每个 pack 的可用集；manifest 已带 examples/props/classes，
// 只有 strategy css 需要按组件拉取后合并，整包注入一份 <style>。
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useStore } from '../store.jsx';
import { Copyable } from '../components/ui.jsx';
import TemplatePreview from './TemplatePreview.jsx';

const CATEGORY_LABELS = {
  action: '操作',
  container: '容器',
  list: '列表',
  data: '数据',
};

const TOKEN_AXES = ['light', 'dark', 'warm', 'mono'];
const TPL_CAT = '@tpl'; // 「模板」tag 的保留值：整页预览，不属于任何组件分类

export default function CatalogView() {
  const { ui, patchUi } = useStore();
  const [manifest, setManifest] = useState(null);
  const [injected, setInjected] = useState(''); // tokens css + strategy css，整包一份 <style>
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/api/studio/manifest')
      .then(setManifest)
      .catch((e) => setErr(String(e.message || e)));
  }, []);

  // pack → 可用组件集合（自有 + 沿 extends 链继承），与服务端 manifest?style 的过滤同规则
  const chainOf = useMemo(() => {
    const meta = manifest?.styles || {};
    const map = {};
    for (const p of Object.keys(meta)) {
      const set = new Set();
      let cur = p;
      while (cur) {
        set.add(cur);
        cur = meta[cur]?.extends || null;
      }
      map[p] = set;
    }
    return map;
  }, [manifest]);

  const byPack = useMemo(() => {
    // pack → { category: [components] }（链解析后的可用集）
    if (!manifest) return {};
    const out = {};
    for (const p of Object.keys(manifest.styles || {})) {
      const mine = (manifest.components || []).filter((c) => chainOf[p]?.has(c.pack));
      const cats = {};
      for (const c of mine) {
        const cat = c.category || 'misc';
        (cats[cat] = cats[cat] || []).push(c);
      }
      out[p] = cats;
    }
    return out;
  }, [manifest, chainOf]);

  // 选中态进 store（持久化）：catalogPack / catalogCat / docTokens（palette 轴）。
  // 未选过时默认基座包 paper（多数 pack 的 spec 源头），而非字母序第一个。
  const packs = Object.keys(manifest?.styles || {});
  const activePack = byPack[ui.catalogPack]
    ? ui.catalogPack
    : (byPack.paper ? 'paper' : packs[0]);
  const cats = byPack[activePack] || {};
  const catKeys = Object.keys(cats);
  // 「模板」tag：整页预览，不属于任何组件分类（保留值 @tpl）
  const isTpl = ui.catalogCat === TPL_CAT;
  const activeCat = cats[ui.catalogCat] ? ui.catalogCat : catKeys[0];
  const list = isTpl ? [] : (cats[activeCat] || []);
  const tokensAxis = ui.docTokens || 'light';

  // 只为 css 而拉：examples/props/classes manifest 已带。切包或切 palette 轴才重拉。
  const packIds = useMemo(
    () => Object.values(cats).flat().map((c) => c.id).sort(),
    [cats]
  );
  useEffect(() => {
    if (!activePack || !packIds.length) return undefined;
    let alive = true;
    setInjected('');
    Promise.all(packIds.map((id) => api(`/api/studio/component/${id}?style=${activePack}&tokens=${tokensAxis}`)))
      .then((docs) => {
        if (!alive) return;
        const cssMap = {};
        // tokens 取自任一响应：pack 自带 palette 时服务端优先返回它（tokensSource: 'pack'），
        // 否则是 palette 轴 css。**必须随 css 一起注入**——terra 这类 pack 的 strategy css
        // 引用自有变量（--accent 等），只注 css 不注 tokens，按钮会隐身在白底上。
        const tokensCss = docs.find((d) => d.tokens)?.tokens || '';
        for (const d of docs) Object.assign(cssMap, d.css || {});
        setInjected(`${tokensCss}\n${Object.values(cssMap).join('\n\n')}`);
      })
      .catch((e) => alive && setErr(String(e.message || e)));
    return () => { alive = false; };
  }, [activePack, tokensAxis, packIds]); // packIds 是 useMemo 派生：切包变、切 tab 不变，正是想要的触发面

  if (err) return <div className="empty bad">接口调用失败：{err}</div>;
  if (!manifest) return <div className="empty muted">载入中…</div>;

  return (
    <div className="catalog">
      {/* 左栏：风格包。一个 pack = 一整套组件，切换即换整套实现 */}
      <aside className="side">
        <div className="side-h">风格包 · {packs.length}</div>
        {packs.map((pack) => {
          const info = manifest.styles[pack] || {};
          const n = Object.values(byPack[pack] || {}).reduce((a, l) => a + l.length, 0);
          return (
            <button
              key={pack}
              className={'side-item' + (pack === activePack ? ' active' : '')}
              onClick={() => patchUi({ catalogPack: pack, catalogCat: null })}
              title={info.label || pack}
            >
              <span className="lbl">
                {pack}
                <span className="side-count">{n}</span>
              </span>
              <span className="sub">{info.extends ? `extends ${info.extends}` : info.label || ''}</span>
            </button>
          );
        })}
      </aside>

      {/* 右栏：分类 tab + palette 轴 + 自足式组件卡 */}
      <section className="stack">
        <div className="subtabs">
          {catKeys.map((cat) => (
            <button
              key={cat}
              className={'subtab' + (cat === activeCat ? ' active' : '')}
              onClick={() => patchUi({ catalogCat: cat })}
            >
              {CATEGORY_LABELS[cat] || cat} · {cats[cat].length}
            </button>
          ))}
          {/* 「模板」tag：整页预览，与组件分类并列 */}
          <button
            className={'subtab' + (isTpl ? ' active' : '')}
            onClick={() => patchUi({ catalogCat: TPL_CAT })}
          >
            模板
          </button>
          {/* palette 轴与 pack 正交：同一 pack × 不同 tokens = 不同外观 */}
          <span style={{ marginLeft: 'auto' }} />
          <span className="muted" style={{ fontSize: 11, alignSelf: 'center' }}>tokens:</span>
          {TOKEN_AXES.map((t) => (
            <button
              key={t}
              className={'btn small' + (tokensAxis === t ? '' : ' ghost')}
              onClick={() => patchUi({ docTokens: t })}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="muted" style={{ fontSize: 12, padding: '0 2px' }}>
          {manifest.styles[activePack]?.label}
          {manifest.styles[activePack]?.extends && (
            <span style={{ marginLeft: 8 }}>继承 {manifest.styles[activePack].extends}（spec 是单一真相源）</span>
          )}
        </div>

        {/* 「模板」tag：整页预览画布（Shadow DOM 隔离，自带 css 装配） */}
        {isTpl && (
          <TemplatePreview pack={activePack} packMeta={manifest.styles[activePack]} axis={tokensAxis} />
        )}

        {!isTpl && injected && <style dangerouslySetInnerHTML={{ __html: injected }} />}

        {!isTpl && (!injected ? (
          <div className="empty muted">载入样式…</div>
        ) : (
          <div className="demo-grid">
            {list.map((c) => (
              <div key={c.id} className="demo-card">
                <div className="demo-card-h">
                  <span className="mono" style={{ fontWeight: 700 }}>{c.id}</span>
                  <span className="tag">{c.title}</span>
                  <span className="tag">{CATEGORY_LABELS[c.category] || c.category}</span>
                  <span className="muted mono" style={{ marginLeft: 'auto', fontSize: 11 }}>{c.classContract}</span>
                </div>
                <div className="demo-card-main">
                  {/* 左：全部变体，样式直出 */}
                  <div className="demo-card-b">
                    {(c.examples || []).map((ex) => (
                      <div key={ex.title} className="demo-ex">
                        <div className="demo-ex-h">
                          {ex.title}
                          <Copyable text={ex.html} className="tag mono">复制</Copyable>
                        </div>
                        <div className="demo-stage" dangerouslySetInnerHTML={{ __html: ex.html }} />
                      </div>
                    ))}
                  </div>
                  {/* 右：契约面板（原文档页内容就地并排） */}
                  <aside className="demo-side">
                    <div style={{ fontSize: 12, marginBottom: 8 }}>{c.description}</div>
                    <div className="demo-side-h">Props · {Object.keys(c.props || {}).length}</div>
                    <table className="levels">
                      <tbody>
                        {Object.entries(c.props || {}).map(([pname, p]) => (
                          <tr key={pname}>
                            <td className="mono">{pname}{p.required && <span className="bad">*</span>}</td>
                            <td className="mono muted">
                              {p.values ? p.values.filter(Boolean).join(' · ') : p.type}
                              {p.default ? ` ／ ${String(p.default)}` : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="demo-side-h">CSS 类 · {(c.classes || []).length}</div>
                    <div>
                      {(c.classes || []).map((cls) => (
                        <span key={cls} className="tag mono" style={{ marginRight: 4, marginBottom: 2, display: 'inline-block' }}>.{cls}</span>
                      ))}
                    </div>
                    <div className="demo-side-h">tokens 引用</div>
                    <div>
                      {(c.tokens || []).map((t) => (
                        <span key={t} className="tag mono" style={{ marginRight: 4, marginBottom: 2, display: 'inline-block' }}>{t}</span>
                      ))}
                    </div>
                    <div className="demo-side-h">API</div>
                    <div className="mono muted" style={{ fontSize: 11, wordBreak: 'break-all' }}>
                      GET /api/studio/component/{c.id}?style={activePack}
                      <a href={`/api/studio/component/${c.id}?style=${activePack}`} target="_blank" rel="noreferrer" style={{ marginLeft: 6 }}>打开</a>
                    </div>
                  </aside>
                </div>
              </div>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}
