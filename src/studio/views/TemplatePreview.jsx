// TemplatePreview：总体模板预览画布（被 Catalog 的「模板」tag 引用，非独立视图）。
//
// 任意 pack × 布局形态（侧栏 / 顶栏无侧栏）× palette 轴，渲染完整的"工单管理"
// 页面骨架（mock 数据与 proto-styles 原型同源）。与组件卡片互补：这一块回答
// "用这套风格搭出来的整站长什么样"。
//
// 实现要点（含一个 vite glob 的坑）：
//   0. glob 深度坑：glob 引擎（tinyglobby）对 3 层 `../../../` 开头的 pattern
//      会静默返回空（2 层 `../../` 正常），且无任何报错。本文件在 views/ 用
//      2 层恰好指向 src/，是已验证可用的一档；挪去更深的目录（如 components/）
//      需要改成 3 层就会踩坑——css 全丢、界面裸奔。别挪。
//   1. strategy css 用 import.meta.glob('?inline', eager) 构建期内联——colhead/tag/toast
//      这类"支持策略"没有 API 端点；全量内联几十 KB，属预览职责内体积。
//   2. 画布跑在 Shadow DOM 里：注入的 pack css 若进主文档会把面板 chrome
//      一起换肤；shadow 边界隔离之，CSS 自定义属性可穿透继承。
//   3. 页面骨架用库自己的布局原语（.shell.sidebar / .shell.topbar + 组件类），
//      不自造栅格——预览的就是 layout/ 层的真实行为。
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const PACK_CSS = import.meta.glob('../../styles/*/*.css', { query: '?inline', import: 'default', eager: true });
const TOKENS_CSS = import.meta.glob('../../tokens/*.css', { query: '?inline', import: 'default', eager: true });
const LAYOUT_CSS = import.meta.glob('../../layout/*.css', { query: '?inline', import: 'default', eager: true });

const cssText = (map, key) => map[key] || '';
const LAYOUT_KEYS = ['../../layout/shell.css', '../../layout/sidebar.css', '../../layout/topbar.css', '../../layout/grid.css'];
const LAYOUTS = [
  { id: 'sidebar', label: '有侧边栏' },
  { id: 'topbar', label: '无侧边栏（顶栏）' },
];

// 预览画布自身的结构微调（tpl-* 命名空间）：压掉 shell 的 100vh、批量条等
// 页面级小件没有 pack 策略，用中性最小样式；按钮/行/卡/标签全是 pack 类。
const TPL_CSS = `
.shell { min-height: 520px; }
.tpl-title { display: flex; align-items: baseline; gap: 10px; margin-bottom: 10px; }
.tpl-title h3 { font-size: 16px; margin: 0; }
.tpl-title .sub { color: var(--mid); font-size: 11px; }
.tpl-filters { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.tpl-filters .sp { margin-left: auto; }
.tpl-cell-id { color: var(--mid); font-size: 11px; min-width: 7ch; font-family: ui-monospace, Consolas, monospace; }
.tpl-cell-subject { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tpl-cell-user { color: var(--mid); font-size: 11px; min-width: 6ch; }
.tpl-cell-time { color: var(--mid); font-size: 11px; min-width: 9ch; text-align: right; }
.tpl-skel { height: 30px; margin: 8px; border-radius: 4px; background: linear-gradient(90deg, var(--soft) 25%, var(--soft-2) 50%, var(--soft) 75%); background-size: 200% 100%; animation: tpl-pulse 1.2s infinite; }
@keyframes tpl-pulse { from { background-position: 200% 0; } to { background-position: -200% 0; } }
.tpl-pager { display: flex; align-items: center; gap: 6px; margin-top: 12px; color: var(--mid); font-size: 11px; }
.tpl-bulk { position: sticky; bottom: 8px; margin-top: 12px; background: var(--ink); color: var(--paper); border-radius: 6px; padding: 8px 12px; display: flex; align-items: center; gap: 10px; font-size: 12px; flex-wrap: wrap; }
.tpl-bulk .grow { flex: 1; }
.tpl-bulk b { font-weight: 700; }
.tpl-bulk .btn.ghost { color: var(--paper); border-color: color-mix(in srgb, var(--paper) 40%, transparent); background: transparent; }
.tpl-bulk .btn.ghost:hover:not(:disabled) { background: color-mix(in srgb, var(--paper) 12%, transparent); border-color: var(--paper); }
`;

// ---- 工单 mock（与 proto-styles 原型同源）----
const TICKETS = [
  { id: '#10247', subject: '客户请求批量导出近 12 个月历史账单', user: '张明远', status: '待处理', cls: 'pending', prio: ['中', 'muted'], time: '10 分钟前', assignee: '我' },
  { id: '#10246', subject: 'API 网关 502 报警持续 12 分钟', user: '监控系统', status: '已升级', cls: 'warn', prio: ['紧急', 'err'], time: '23 分钟前', assignee: '王浩', selected: true },
  { id: '#10245', subject: 'iOS 端登录态在弱网下频繁丢失', user: '陈晓彤', status: '处理中', cls: 'info', prio: ['高', 'warn'], time: '41 分钟前', assignee: '我' },
  { id: '#10244', subject: '上海节点延迟 P99 飙升至 1.4s', user: '监控系统', status: '处理中', cls: 'info', prio: ['高', 'warn'], time: '1 小时前', assignee: '王浩' },
  { id: '#10243', subject: '退款流程回调偶发 500 错误', user: '赵敏', status: '已解决', cls: 'ok', prio: ['中', 'muted'], time: '2 小时前', assignee: '李雪' },
  { id: '#10242', subject: '客户请求新增自定义报表模板', user: '周建国', status: '待处理', cls: 'pending', prio: ['低', 'muted'], time: '3 小时前', assignee: '我' },
  { id: '#10241', subject: '工单导出 CSV 在 Excel 中文乱码', user: '林海', status: '已解决', cls: 'ok', prio: ['低', 'muted'], time: '4 小时前', assignee: '张伟' },
  { id: '#10240', subject: 'SSO 登录返回 403 错误', user: '黄文博', status: '已关闭', cls: 'muted', prio: ['中', 'muted'], time: '5 小时前', assignee: '张伟' },
  { id: '#10239', subject: '计费系统对账出现 0.03 元差异', user: '财务系统', status: '已升级', cls: 'warn', prio: ['紧急', 'err'], time: '6 小时前', assignee: '王浩' },
  { id: '#10238', subject: '客户申请开启企业版双因素认证', user: '刘思颖', status: '待处理', cls: 'pending', prio: ['中', 'muted'], time: '8 小时前', assignee: '我' },
  { id: '#10237', subject: 'webhook 重复触发导致下游通知多次', user: '韩磊', status: '已解决', cls: 'ok', prio: ['中', 'muted'], time: '10 小时前', assignee: '李雪' },
  { id: '#10236', subject: '移动端推送通知收不到', user: '杨小溪', status: '处理中', cls: 'info', prio: ['高', 'warn'], time: '12 小时前', assignee: '王浩' },
  { id: '#10235', subject: '旧数据归档脚本运行超时', user: '系统组', status: '待处理', cls: 'pending', prio: ['低', 'muted'], time: '昨天 17:42', assignee: '张伟' },
  { id: '#10234', subject: '客户投诉首次响应时间过长', user: '吴军', status: '已升级', cls: 'warn', prio: ['高', 'warn'], time: '昨天 15:08', assignee: '我' },
];

const NAV_MAIN = [['仪表盘', ''], ['工单', '1,247'], ['客户', '328'], ['报表', ''], ['知识库', '']];
const NAV_SAVED = [['分配给我', '38'], ['已升级', '7'], ['紧急', '3'], ['未读', '12']];

// ---- Shadow DOM 隔离画布：css 与 DOM 都进 shadow，主文档零污染 ----
function ShadowCanvas({ css, children }) {
  const hostRef = useRef(null);
  const [root, setRoot] = useState(null);
  useEffect(() => {
    if (hostRef.current && !root) setRoot(hostRef.current.attachShadow({ mode: 'open' }));
  }, [root]);
  return (
    <div ref={hostRef} style={{ all: 'initial', display: 'block' }}>
      {root && createPortal(
        <>
          {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
          {children}
        </>,
        root
      )}
    </div>
  );
}

export default function TemplatePreview({ pack, packMeta, axis }) {
  const [layout, setLayout] = useState('sidebar');

  // 装配注入 css：palette（pack 自带优先）→ 全部 strategy → 布局原语 → 画布微调
  const injected = useMemo(() => {
    if (!pack) return '';
    const strategies = packMeta?.strategies || [];
    const parts = [
      cssText(PACK_CSS, `../../styles/${pack}/tokens.css`) || cssText(TOKENS_CSS, `../../tokens/${axis}.css`),
      ...strategies.map((s) => cssText(PACK_CSS, `../../styles/${pack}/${s}.css`)),
      ...LAYOUT_KEYS.map((k) => cssText(LAYOUT_CSS, k)),
      TPL_CSS,
    ];
    return parts.filter(Boolean).join('\n');
  }, [pack, packMeta, axis]);

  const rows = TICKETS.map((t) => (
    <div key={t.id} className={'row' + (t.selected ? ' selected' : '')}>
      <span className="tpl-cell-id">{t.id}</span>
      <span className="tpl-cell-subject">{t.subject}</span>
      <span className="tpl-cell-user">{t.user}</span>
      <span className={'tag ' + t.cls}>{t.status}</span>
      <span className={'tag ' + t.prio[1]}>{t.prio[0]}</span>
      <span className="tpl-cell-time">{t.time}</span>
      <span className="tpl-cell-user">{t.assignee}</span>
    </div>
  ));

  const content = (
    <div className="shell-main tpl-main">
      <div className="tpl-title">
        <h3>工单</h3>
        <span className="sub">最近 7 天 · 102 个新工单 · 共 1,247 张</span>
      </div>
      <div className="tpl-filters">
        <button className="btn ghost small">状态: 全部 ▾</button>
        <button className="btn ghost small">优先级: 全部 ▾</button>
        <button className="btn ghost small">分配给: 我 ▾</button>
        <button className="btn ghost small">日期: 近 7 天 ▾</button>
        <span className="sp" />
        <button className="btn small">+ 新建工单</button>
      </div>
      <div className="card">
        <div className="colhead">
          <span>工单列表</span>
          <span>14 SHOWN · PAGE 1/84</span>
        </div>
        {rows}
        <div className="tpl-skel" />
      </div>
      <div className="tpl-pager">
        <button className="btn ghost small">‹</button>
        <button className="btn small">1</button>
        <button className="btn ghost small">2</button>
        <button className="btn ghost small">3</button>
        <span>…</span>
        <button className="btn ghost small">84</button>
        <button className="btn ghost small">›</button>
      </div>
      <div className="tpl-bulk">
        <span><b>已选 1 项</b> #10246 · API 网关 502 报警</span>
        <span className="grow" />
        <button className="btn ghost small">分配给 ▾</button>
        <button className="btn ghost small">更改状态 ▾</button>
        <button className="btn ghost small">添加标签</button>
        <button className="btn danger small">关闭</button>
      </div>
    </div>
  );

  const aside = (
    <div className="shell-aside">
      <nav className="sidebar">
        <div className="sidebar-brand">Dispatch</div>
        {NAV_MAIN.map(([label, count]) => (
          <a key={label} className={'sidebar-item' + (label === '工单' ? ' active' : '')}>
            {label}
            {count && <span className="tpl-cell-user" style={{ marginLeft: 'auto' }}>{count}</span>}
          </a>
        ))}
        <div className="sidebar-section">我的筛选</div>
        {NAV_SAVED.map(([label, count]) => (
          <a key={label} className="sidebar-item">
            {label}
            <span className="tpl-cell-user" style={{ marginLeft: 'auto' }}>{count}</span>
          </a>
        ))}
      </nav>
    </div>
  );

  const topbar = (
    <div className="shell-topbar">
      <div className="topbar">
        <span className="topbar-brand">Dispatch <span className="meta">工作区 / 工单</span></span>
        <nav className="topbar-nav">
          {['仪表盘', '工单', '客户', '报表'].map((label) => (
            <a key={label} className={'topbar-item' + (label === '工单' ? ' active' : '')}>{label}</a>
          ))}
        </nav>
        <button className="btn ghost small">搜索…</button>
        <button className="btn small">ZH</button>
      </div>
    </div>
  );

  const form = layout === 'sidebar'
    ? <div className="shell sidebar">{aside}{content}</div>
    : <div className="shell topbar">{topbar}{content}</div>;

  return (
    <div className="stack">
      <div className="subtabs">
        {LAYOUTS.map((l) => (
          <button key={l.id} className={'subtab' + (layout === l.id ? ' active' : '')}
            onClick={() => setLayout(l.id)}>
            {l.label}
          </button>
        ))}
        <span className="muted" style={{ fontSize: 11, alignSelf: 'center', marginLeft: 8 }}>
          {packMeta?.label}
        </span>
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <ShadowCanvas css={injected}>{form}</ShadowCanvas>
      </div>
    </div>
  );
}
