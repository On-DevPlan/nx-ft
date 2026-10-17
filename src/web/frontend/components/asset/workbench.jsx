// 资源工作台:左上角面包屑返回,右上角风格与描述,主体「左编辑 | 右预览」左右两栏。
// 由 AssetView 依据 hash 子路由（#/html/edit/<组>/<名>）挂载。
// 默认嵌在面板里（侧边栏保留）；「大屏模式」是用户主动选择的覆盖态（.wb-fullscreen）。
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../api/client.js';
import { Btn, BtnBar, BtnBarSpacer, BtnMenu, BtnMenuItem, BtnMenuLabel, BtnMenuSep } from '../btn/index.jsx';
import { useDialog, useGuard, useToast } from '../ui.jsx';
import { Crumbs } from './parts.jsx';
import { makeAssetOps } from './useAssetOps.js';
import { SplitPane } from './SplitPane.jsx';
import { buildPreviewDoc } from '../preview/doc.js';
import { PreviewPane } from '../preview/index.jsx';
import { WorkbenchEditor } from './workbench-editor.jsx';
import { readSlotCode } from '../code-workbench/index.jsx';

const KIND_SLOTS = { html: ['html', 'css', 'js'], svg: ['svg', 'css', 'js'], color: ['data'] };
const KIND_LABEL = { html: { html: 'HTML', css: 'CSS', js: 'JS' }, svg: { svg: 'SVG', css: 'CSS', js: 'JS' }, color: { data: 'DATA' } };
const KIND_TITLE = { html: 'HTML 资源', svg: 'SVG 资源', color: '色彩资源' };

// 视口偏好的 localStorage 键:跨资源全局记一份(手机 / PC 预览是用户偏好,不跟资源走)
const VIEWPORT_KEY = 'nx-ft-wb-viewport';

function loadViewport() {
  try {
    const v = localStorage.getItem(VIEWPORT_KEY);
    return v === 'pc' ? 'pc' : 'mobile'; // 只认白名单值;无存档/脏数据一律手机(iPhone 375×667)
  } catch {
    return 'mobile';
  }
}

export function WorkbenchPage({ kind, group, name, onNavigate }) {
  const toast = useToast();
  const guard = useGuard();
  const { dialog, node } = useDialog();

  const [asset, setAsset] = useState(null);
  const [sel, setSel] = useState({ group, name, style: '' });
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0); // 输入计数:驱动脏标记与预览刷新
  const [full, setFull] = useState(false);
  const [viewport, setViewport] = useState(loadViewport); // 手机 / PC 预览视口
  const [big, setBig] = useState(false); // 大屏模式:主动选择的整页覆盖态
  // 编辑区布局由 WorkbenchEditor 自持；默认布局仅在用户点齿轮时落盘。

  const savedRef = useRef(null);
  const mainRef = useRef(null);

  // 视口偏好落盘(隐私模式静默)
  useEffect(() => {
    try {
      localStorage.setItem(VIEWPORT_KEY, viewport);
    } catch {
      /* 隐私模式静默 */
    }
  }, [viewport]);

  // 从 DOM 读当前代码（预览与保存的真相）；与 SVG 详情共用 readSlotCode。
  const readCode = useCallback(() => {
    const slots = KIND_SLOTS[kind];
    const root = mainRef.current;
    if (!root) {
      const out = {};
      for (const slot of slots) out[slot] = String(savedRef.current?.[slot] ?? '');
      return out;
    }
    const fromDom = readSlotCode(root, slots);
    const out = {};
    for (const slot of slots) {
      const mounted = root.querySelector(`[data-slot="${slot}"] .code-area`);
      out[slot] = mounted ? fromDom[slot] : String(savedRef.current?.[slot] ?? '');
    }
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
      // 错误态走大屏:看错误信息时就该聚焦在内容上,不必再给侧边栏腾位。
      <div className="wb wb-fullscreen">
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
    <div className={'wb' + (big ? ' wb-fullscreen' : '')}>
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
        <BtnBar>
          <BtnBarSpacer />
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
          {/* 右上角只留三个动作位（select / 新风格 / 更多 / 保存）：原先 6 颗按钮一字排开，
              930px 视口挤到两行（用户反馈「右上角也太复杂了」）；其余按作用域收进
              「更多」，频次最高的「新风格」留在明面（与 svg 资源页 ident 行一致）。 */}
          <Btn onClick={ops.newStyle} testId="wb-new-style">新风格</Btn>
          <BtnMenu label="更多" testId="wb-more" panelTestId="wb-more-panel">
            <BtnMenuLabel>视图</BtnMenuLabel>
            <BtnMenuItem onClick={() => setBig((b) => !b)} testId="wb-big"
              title={big ? '退出大屏模式(回到带侧边栏的常规视图)' : '进入大屏模式(隐藏侧边栏)'}
            >
              {big ? '退出大屏' : '大屏模式'}
            </BtnMenuItem>
            {/* 色彩资源:全屏 ColorStudio 入口(色盘/比例/笔刷三视图) */}
            {kind === 'color' && (
              <BtnMenuItem
                onClick={() => {
                  location.hash = `#/color/edit/${encodeURIComponent(group)}/${encodeURIComponent(name)}/full`;
                }}
                title="打开全屏 ColorStudio(色盘/比例/笔刷三视图,1:1 复刻 ve 项目)"
                testId="wb-studio-full"
              >
                全屏 Studio →
              </BtnMenuItem>
            )}
            <BtnMenuSep />
            <BtnMenuLabel>风格</BtnMenuLabel>
            <BtnMenuItem onClick={ops.setStyleDesc} disabled={!asset?.styles.length} testId="wb-style-desc">
              风格描述
            </BtnMenuItem>
            <BtnMenuItem onClick={ops.removeStyle} disabled={!asset?.styles.length} testId="wb-remove-style">
              删除当前风格
            </BtnMenuItem>
            <BtnMenuSep />
            <BtnMenuLabel>资源</BtnMenuLabel>
            <BtnMenuItem onClick={ops.renameAsset} testId="wb-rename">改展示名</BtnMenuItem>
            <BtnMenuItem danger onClick={ops.removeAsset} testId="wb-remove">删除资源</BtnMenuItem>
          </BtnMenu>
          <Btn
            variant="primary"
            onClick={ops.save}
            disabled={!asset?.styles.length}
            testId="wb-save"
          >
            {isDirty() ? '保存 *' : '保存'}
          </Btn>
        </BtnBar>
      </div>

      <div className="wb-sub">
        {(asset?.tags || []).map((t) => (
          <span key={t} className="tag-chip">
            {t}
            {/* tag-chip-x 是 14px 的小 ×，不是按钮族语义——tag-chip 视觉内嵌的关闭点 */}
            <button className="tag-chip-x" title="移除标签" onClick={() => ops.removeTag(t)}>×</button>
          </span>
        ))}
        <Btn size="sm" variant="secondary" onClick={ops.addTags}>+ 标签</Btn>
        <div className="wb-bar-spacer" />
        <span className="muted mono wb-path">{group}/{name}</span>
      </div>

      <div className="wb-body" ref={mainRef}>
        <SplitPane
          direction="horizontal"
          initialPct={50}
          minPct={20}
          maxPct={80}
          // 键名带 -h- 后缀:旧 vertical 比例不能套用到 horizontal,新键让旧值自然失效
          persistKey={`nx-ft-wb-split-h-${kind}-${group}-${name}`}
          testId="wb-split"
          left={
            <WorkbenchEditor
              kind={kind}
              slots={KIND_SLOTS[kind]}
              labels={KIND_LABEL[kind]}
              ready={ready}
              asset={asset}
              styleKey={sel.style}
              onSave={ops.save}
              onChange={() => setTick((n) => n + 1)}
            />
          }
          right={
            <div className="wb-preview-pane">
              <PreviewPane
                doc={ready ? buildPreviewDoc(kind, readCode()) : ''}
                kind={kind}
                full={full}
                tick={tick}
                onToggleFull={() => setFull((f) => !f)}
                viewport={viewport}
                onViewportChange={setViewport}
              />
            </div>
          }
        />
      </div>
      {node}
    </div>
  );
}
