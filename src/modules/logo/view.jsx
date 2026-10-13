// LOGO 生成面板：字母 + 配色（14 套 swatch + 自定义色）→ 实时 SVG 预览 → 生成全套文件。
// 典型用途：给旧项目补 LOGO——输出目录填它的 public 目录，一键补齐 8 件产物。
import { useEffect, useState } from 'react';
import { api } from '../../web/frontend/api/client.js';
import { relTime } from '../../web/frontend/components/asset/parts.jsx';
import { Copyable, useDialog, useGuard, useToast } from '../../web/frontend/components/ui.jsx';

const LETTERS_RE = /^[A-Za-z0-9._-]{1,5}$/;

export default function LogoView() {
  const toast = useToast();
  const guard = useGuard();
  const { dialog, node } = useDialog();

  const [schemes, setSchemes] = useState([]);
  const [history, setHistory] = useState(null);
  const [err, setErr] = useState('');
  const [letters, setLetters] = useState('nx');
  const [schemeKey, setSchemeKey] = useState('');
  const [bg, setBg] = useState('');
  const [fg, setFg] = useState('');
  const [out, setOut] = useState('');
  const [svg, setSvg] = useState('');

  const reloadHistory = () =>
    api('/api/logo-history').then(setHistory).catch(() => {});

  useEffect(() => {
    api('/api/logo-schemes')
      .then((r) => {
        setSchemes(r.schemes);
        setSchemeKey((k) => k || r.defaultScheme);
      })
      .catch((e) => setErr(String(e.message || e)));
    reloadHistory();
  }, []);

  // 实时预览：250ms 防抖，预览与生成同源（都走服务端同一套生成逻辑）
  useEffect(() => {
    const clean = letters.trim();
    if (!LETTERS_RE.test(clean)) {
      setSvg('');
      return undefined;
    }
    const t = setTimeout(() => {
      const q = new URLSearchParams({ letters: clean, scheme: schemeKey });
      if (bg) q.set('bg', bg);
      if (fg) q.set('fg', fg);
      api(`/api/logo-preview?${q.toString()}`)
        .then((r) => setSvg(r.svg))
        .catch(() => setSvg(''));
    }, 250);
    return () => clearTimeout(t);
  }, [letters, schemeKey, bg, fg]);

  const scheme = schemes.find((s) => s.key === schemeKey);

  const gen = () =>
    guard(async () => {
      const body = { letters: letters.trim(), scheme: schemeKey };
      if (bg) body.bg = bg;
      if (fg) body.fg = fg;
      if (out.trim()) body.out = out.trim();
      let r = await api('/api/logo-gen', { method: 'POST', body });
      if (r.status === 'conflict') {
        const ok = await dialog({
          title: '目标目录已有同名文件',
          message: `已有: ${r.existing.join('、')}。覆盖可能清掉手工调整过的图。`,
          okText: '覆盖生成',
          danger: true,
        });
        if (!ok) return;
        r = await api('/api/logo-gen', { method: 'POST', body: { ...body, force: true } });
      }
      await reloadHistory();
      toast(r.note);
    });

  const reveal = (dir) =>
    guard(async () => {
      await api('/api/logo-reveal', { method: 'POST', body: { dir } });
      toast('已在文件管理器中打开');
    });

  const regen = (r) => {
    const base = schemes.find((s) => s.key === r.scheme);
    setLetters(r.letters);
    setSchemeKey(r.scheme);
    setBg(base && r.bg !== base.bg ? r.bg : '');
    setFg(base && r.fg !== base.fg ? r.fg : '');
    setOut('');
    toast('已载入参数，确认后点「生成全套文件」');
  };

  if (err) return <div className="empty bad">接口调用失败：{err}</div>;

  return (
    <div className="logo-page">
      <div className="logo-cols">
        <div className="card">
          <div className="colhead">LOGO 生成</div>
          <div className="logo-form">
            <div className="logo-field">
              <span className="logo-label">字母</span>
              <input
                className="logo-input"
                spellCheck="false"
                maxLength={8}
                value={letters}
                onChange={(e) => setLetters(e.target.value)}
                placeholder="1~5 位（字母/数字/-_.)"
              />
            </div>
            <div className="logo-field">
              <span className="logo-label">配色方案</span>
              <div className="scheme-grid">
                {schemes.map((s) => (
                  <button
                    key={s.key}
                    className={'scheme-chip' + (schemeKey === s.key && !bg && !fg ? ' active' : '')}
                    title={`${s.name}  bg=${s.bg}  fg=${s.fg}`}
                    onClick={() => {
                      setSchemeKey(s.key);
                      setBg('');
                      setFg('');
                    }}
                  >
                    <span className="scheme-swatch" style={{ background: s.bg, color: s.fg }}>
                      {(letters.trim() || 'nx').slice(0, 2)}
                    </span>
                    <span className="scheme-name">{s.name}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="logo-field">
              <span className="logo-label">自定义色</span>
              <span className="logo-custom">
                <input
                  type="color"
                  value={bg || scheme?.bg || '#000000'}
                  onChange={(e) => setBg(e.target.value)}
                  title="背景色"
                />
                <input
                  type="color"
                  value={fg || scheme?.fg || '#ffffff'}
                  onChange={(e) => setFg(e.target.value)}
                  title="字母色"
                />
                {bg || fg ? (
                  <button className="btn small ghost" onClick={() => { setBg(''); setFg(''); }}>
                    清除
                  </button>
                ) : (
                  <span className="muted">不改就用方案色</span>
                )}
              </span>
            </div>
            <div className="logo-field">
              <span className="logo-label">输出目录</span>
              <input
                className="logo-input"
                spellCheck="false"
                value={out}
                onChange={(e) => setOut(e.target.value)}
                placeholder="留空 = 存到画廊；补旧项目时填它的 public 目录"
              />
            </div>
            <button className="btn" onClick={gen} disabled={!LETTERS_RE.test(letters.trim())}>
              生成全套文件
            </button>
            <p className="muted logo-hint">
              产物 8 件：logo.svg / logo-rounded.svg / logo.png / logo-rounded.png /
              favicon-16·32·48.png / favicon.ico
            </p>
          </div>
        </div>

        <div className="card">
          <div className="colhead">
            <span>预览</span>
            <span className="tag">{scheme ? scheme.name : ''}</span>
          </div>
          <div className="logo-preview-box">
            {svg ? (
              <img src={'data:image/svg+xml;utf8,' + encodeURIComponent(svg)} alt="LOGO 预览" />
            ) : (
              <span className="muted">输入 1~5 位字母后出现实时预览</span>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="colhead">
          <span>最近生成</span>
          <span className="tag">{history ? `${history.count} 条` : '…'}</span>
        </div>
        {(history?.records || []).map((r) => (
          <div key={r.id} className="row">
            <span className="name mono">{r.letters}</span>
            <span className="desc muted nowrap">
              {r.schemeName} · <Copyable text={r.dir}>{r.dir}</Copyable> · {relTime(r.at)}
            </span>
            <span className="acts">
              <button className="btn small ghost" onClick={() => reveal(r.dir)}>打开</button>
              <button className="btn small ghost" onClick={() => regen(r)}>载入参数</button>
            </span>
          </div>
        ))}
        {history && !history.records.length ? (
          <div className="empty">还没有生成记录。左侧配好参数点「生成全套文件」。</div>
        ) : null}
      </div>
      {node}
    </div>
  );
}
