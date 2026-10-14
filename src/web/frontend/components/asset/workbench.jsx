// 资源工作台（全屏独立页）：左上角面包屑返回，右上角风格与描述，主体三编辑器 + 实时预览。
// 由 AssetView 依据 hash 子路由（#/html/edit/<组>/<名>）挂载。
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../api/client.js';
import { useDialog, useGuard, useToast } from '../ui.jsx';
import { CodeEditor } from './CodeEditor.jsx';
import { buildPreviewDoc, PreviewPane } from './preview.jsx';
import { Crumbs } from './parts.jsx';
import { makeAssetOps } from './useAssetOps.js';
import { SplitPane } from './SplitPane.jsx';

const KIND_SLOTS = { html: ['html', 'css', 'js'], svg: ['svg', 'css', 'js'], color: ['data'] };
const KIND_LABEL = { html: { html: 'HTML', css: 'CSS', js: 'JS' }, svg: { svg: 'SVG', css: 'CSS', js: 'JS' }, color: { data: 'DATA' } };
const KIND_TITLE = { html: 'HTML 资源', svg: 'SVG 资源', color: '色彩资源' };

export function WorkbenchPage({ kind, group, name, onNavigate }) {
  const toast = useToast();
  const guard = useGuard();
  const { dialog, node } = useDialog();

  const [asset, setAsset] = useState(null);
  const [sel, setSel] = useState({ group, name, style: '' });
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0); // 输入计数：驱动脏标记与预览刷新
  const [full, setFull] = useState(false);

  const savedRef = useRef(null);
  const mainRef = useRef(null);

  // 从 DOM 读当前代码（预览与保存的真相）；限定在本工作台容器内。
  const readCode = useCallback(() => {
    const out = {};
    const areas = mainRef.current ? mainRef.current.querySelectorAll('.code-area') : [];
    KIND_SLOTS[kind].forEach((slot, i) => {
      out[slot] = areas[i] ? areas[i].value : String(savedRef.current?.[slot] ?? '');
    });
    return out;
  }, [kind]);

  const isDirty = () => ready && JSON.stringify(readCode()) !== JSON.stringify(savedRef.current || {});

  const loadAsset = useCallback(
    async (target) => {
      setErr('');
      try {
        const q = `?group=${encodeURIComponent(target.group)}&name=${encodeURIComponent(target.name)}`;
        const a = await api(`/api/${kind}/asset${q}`);
        const style = a.styles.some((s) => s.name === target.style)
          ? target.style
          : a.activeStyle || a.styles[0]?.name || '';
        // 修：savedRef 必须包含 KIND_SLOTS 的全部 key，否则无风格资源首次打开会被误判 dirty。
        const codeForStyle = a.code[style] || {};
        const normalized = {};
        KIND_SLOTS[kind].forEach((slot) => {
          normalized[slot] = codeForStyle[slot] || '';
        });
        savedRef.current = normalized;
        setAsset(a);
        setSel({ group: a.group, name: a.name, style });
        setReady(true);
        setTick((n) => n + 1);
      } catch (e) {
        const kindLabel = kind === 'color' ? '色彩' : kind === 'svg' ? 'SVG' : 'HTML';
        setErr(`打开${kindLabel}资源失败: ${target.group}/${target.name}  ${i18nErr(e?.message || String(e))}`);
        // 不再 throw,让 UI 走到 err 分支显示「重试」按钮
      }
    },
    [kind]
  );

  useEffect(() => {
    guard(() => loadAsset({ group, name, style: '' }));
    // 路由参数变化 = 换资源（key 由父级保证），只在挂载时装载
    // eslint 无 react-hooks 插件，依赖故意只留 kind
  }, [kind]);

// 英文错误 → 中文友好提示
function i18nErr(msg) {
  if (!msg) return '未知错误';
  if (msg.startsWith('HTTP 404')) return '资源不存在（可能已被删除）';
  if (msg.startsWith('HTTP 500')) return '后端服务报错';
  if (msg.startsWith('HTTP 403')) return '无权限访问';
  if (msg.startsWith('HTTP ')) return msg.replace(/^HTTP (\d+)/, '网络错误 (HTTP $1)');
  if (msg.includes('Failed to fetch')) return '后端连接失败（7869 端口未启动？）';
  if (msg.includes('NetworkError')) return '网络错误';
  return msg;
}

  // 编辑器在 commit 后才把 initial 写进 textarea，而预览与脏标记是渲染期读 DOM 的：
  // 装载后再渲染一次才能读到真实内容（否则首帧预览空白、按钮误显示“保存 *”）。
  useEffect(() => {
    if (ready) setTick((n) => n + 1);
  }, [ready, sel.style]);

  const ops = makeAssetOps({
    kind,
    sel,
    asset,
    ready,
    readCode,
    isDirty,
    loadAsset,
    dialog,
    guard,
    toast,
    onExit: () => onNavigate(group),
  });

  const guardDirty = async () => {
    if (!isDirty()) return true;
    const ok = await dialog({
      title: '有未保存的改动',
      message: '返回管理页会丢弃当前改动（每个风格保留最近 5 条保存历史，已保存的改动可回退）。',
      okText: '放弃改动并返回',
      danger: true,
    });
    return !!ok;
  };

  // 面包屑导航（任一段）都先过未保存确认
  const navTo = (dir) =>
    guard(async () => {
      if (await guardDirty()) onNavigate(dir);
    });

  const pickStyle = async (style) => {
    if (!style || style === sel.style || !asset) return;
    if (!(await guardDirty())) return;
    const codeForStyle = asset.code[style] || {};
    const normalized = {};
    KIND_SLOTS[kind].forEach((slot) => {
      normalized[slot] = codeForStyle[slot] || '';
    });
    savedRef.current = normalized;
    setSel((s) => ({ ...s, style }));
    setTick((n) => n + 1);
  };

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        ops.save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ops]);

  const style = asset?.styles.find((s) => s.name === sel.style);

  if (err) {
    return (
      <div className="wb">
        <div className="wb-bar">
          <Crumbs items={[{ label: KIND_TITLE[kind], onClick: () => onNavigate(group) }, { label: err }]} />
        </div>
        <div className="wb-body">
          <div className="empty bad">资源打开失败:{err}
            <p><button className="btn small" onClick={() => loadAsset({ group, name, style: '' })}>重试</button>
            <button className="btn small ghost" onClick={onNavigate ? () => onNavigate('') : undefined} style={{ marginLeft: 8 }}>返回网盘</button></p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wb">
      <div className="wb-bar">
        <Crumbs
          items={[
            { label: KIND_TITLE[kind], onClick: () => navTo(''), title: '返回管理页（全部）' },
            // 分组路径每一段都可点：回到管理页的对应层级
            ...group.split('/').map((seg, i, all) => ({
              label: seg,
              mono: true,
              title: all.slice(0, i + 1).join('/'),
              onClick: () => navTo(all.slice(0, i + 1).join('/')),
            })),
            { label: asset?.label || name, title: `${group}/${name}` },
          ]}
        />
        <div className="wb-bar-spacer" />
        <div className="wb-acts">
          {/* 色彩资源:旁边加「全屏 Studio」入口(强制 fixed:inset:0 渲染 color-studio) */}
          {kind === 'color' && (
            <button
              type="button"
              className="btn small primary"
              onClick={() => {
                location.hash = `#/color/edit/${encodeURIComponent(group)}/${encodeURIComponent(name)}/full`;
              }}
              title="打开全屏 ColorStudio(色盘/比例/笔刷三视图,1:1 复刻 ve 项目)"
            >
              全屏 Studio →
            </button>
          )}
          <select
            className="asset-style-select"
            value={sel.style}
            onChange={(e) => pickStyle(e.target.value)}
            title="切换风格"
          >
            {asset?.styles.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
                {s.name === asset.activeStyle ? ' （当前）' : ''}
              </option>
            ))}
            {!asset?.styles.length && <option value="">无风格</option>}
          </select>
          {style?.desc ? <span className="wb-desc" title={style.desc}>{style.desc}</span> : null}
          {style ? <span className="tag">历史 {style.historyCount}/5</span> : null}
          <button className="btn ghost" onClick={ops.newStyle} data-testid="wb-new-style">新风格</button>
          <button className="btn ghost" onClick={ops.setStyleDesc} disabled={!asset?.styles.length} data-testid="wb-style-desc">
            描述
          </button>
          <button
            className={'btn primary' + (isDirty() ? '' : ' ghost')}
            onClick={ops.save}
            disabled={!asset?.styles.length}
            data-testid="wb-save"
          >
            {isDirty() ? '保存 *' : '保存'}
          </button>
          <details className="wb-more">
            <summary className="btn ghost" data-testid="wb-more">更多</summary>
            <div className="wb-more-menu">
              <button className="btn ghost" onClick={ops.removeStyle} disabled={!asset?.styles.length} data-testid="wb-remove-style">
                删除当前风格
              </button>
              <button className="btn ghost" onClick={ops.renameAsset} data-testid="wb-rename">改展示名</button>
              <button className="btn ghost danger" onClick={ops.removeAsset} data-testid="wb-remove">删除资源</button>
            </div>
          </details>
        </div>
      </div>

      <div className="wb-sub">
        {(asset?.tags || []).map((t) => (
          <span key={t} className="tag-chip">
            {t}
            <button className="tag-chip-x" title="移除标签" onClick={() => ops.removeTag(t)}>×</button>
          </span>
        ))}
        <button className="tag-chip ghost" onClick={ops.addTags}>+ 标签</button>
        <div className="wb-bar-spacer" />
        <span className="muted mono wb-path">{group}/{name}</span>
      </div>

      <div className="wb-body" ref={mainRef}>
        <SplitPane
          direction="vertical"
          initialPct={55}
          minPct={20}
          maxPct={80}
          persistKey={`nx-ft-wb-split-${kind}-${group}-${name}`}
          testId="wb-split"
          left={
            <div className="wb-editors-row">
              {KIND_SLOTS[kind].map((slot) => (
                <CodeEditor
                  key={`${sel.name}:${sel.style}:${slot}`}
                  label={KIND_LABEL[kind][slot]}
                  initial={ready ? (asset?.code?.[sel.style] || {})[slot] : ''}
                  readOnly={!ready}
                  onSave={ops.save}
                  onChange={() => setTick((n) => n + 1)}
                />
              ))}
            </div>
          }
          right={
            <div className="wb-preview-row">
              <PreviewPane
                doc={ready ? buildPreviewDoc(kind, readCode()) : ''}
                full={full}
                tick={tick}
                onToggleFull={() => setFull((f) => !f)}
              />
            </div>
          }
        />
      </div>
      {node}
    </div>
  );
}
