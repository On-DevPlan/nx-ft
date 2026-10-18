// 资源页（路由 `#/svg/edit/<分组>/<名字>`，关键字见 modules/svg/view.jsx 的 parseSvgRoute）：一枚图标的全貌与编辑器。
//
// 与共用面板（components/asset）的区别：那里是「html/svg 通用的资源浏览器」，
// 按资源切换；这里专治图标集——多风格并排、规范问题清单、编辑历史回退、
// 以及「这枚图标对应的 CLI 命令」三件图标集才需要的事。
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../../store.jsx';
import { Btn, BtnBar, BtnBarSpacer, BtnMenu, BtnMenuItem, BtnMenuLabel, BtnMenuSep } from '../btn/index.jsx';
import { SplitPane } from '../asset/SplitPane.jsx';
import { MultiPaneEditor, readSlotCode } from '../code-workbench/index.jsx';
import { buildSvgDoc } from '../preview/doc.js';
import { PreviewPane } from '../preview/index.jsx';
import { Modal, useDialog, useGuard, useToast } from '../ui.jsx';
import { ColorPanel } from './color-panel.jsx';
import { migrateToVars } from './color-vars.js';
import { makeDetailOps } from './detail-ops.jsx';
import { CliBlock, IssueList, StyleStrip, TagBar } from './detail-parts.jsx';
import { DescDrawer } from './desc-drawer.jsx';
import { Crumb, Empty } from './parts.jsx';
import { Icon, IconGhost } from './svg-inline.jsx';
import { useDetail, useNav } from './useSvg.js';

const SLOTS = ['svg', 'css', 'js'];
const LABEL = { svg: 'SVG', css: 'CSS', js: 'JS' };

export default function Detail({ group, name }) {
  const toast = useToast();
  const guard = useGuard();
  const { dialog, node: dlgNode } = useDialog();
  const { boot } = useStore();
  const nav = useNav();
  const bin = boot?.app?.name || 'nx-ft';

  const { data, err, busy, reload } = useDetail(group, name);
  const [style, setStyle] = useState('');
  const [modal, setModal] = useState(null);
  const [tick, setTick] = useState(0);
  const [full, setFull] = useState(false);
  const [doc, setDoc] = useState('');
  const [dirty, setDirty] = useState(false);
  const [descEditing, setDescEditing] = useState(false);
  const [descBusy, setDescBusy] = useState(false);
  // 预览层的颜色替换（主题色 / 变量 / 局部色），不写脏源码；切风格重置。
  const [theme, setTheme] = useState({});
  // 编辑器里实时的 SVG 源码（tick 驱动）：颜色面板的槽位检测跟着编辑走，不只有已保存版
  const [liveSvg, setLiveSvg] = useState('');
  const editRef = useRef(null);

  // 数据到位后落到「当前风格」；保存/新建风格导致清单变化时也做一次收敛。
  useEffect(() => {
    if (!data) return;
    setStyle((s) =>
      s && data.styles.some((x) => x.name === s) ? s : data.activeStyle || data.styles[0]?.name || ''
    );
  }, [data]);

  const cur = data?.styles.find((s) => s.name === style) || null;

  // 代码的真相永远是 DOM 里的 textarea（按 data-slot 寻址；隐藏页签也在 DOM 里）。
  const readCode = useCallback(() => {
    if (!editRef.current) {
      const out = {};
      for (const slot of SLOTS) out[slot] = String(cur?.[slot] ?? '');
      return out;
    }
    return readSlotCode(editRef.current, SLOTS);
  }, [cur]);

  // 预览与脏标记都必须在**提交之后**才算：
  // 非受控 textarea 的正文是 commit 时才写进去的，渲染期读 DOM 只会拿到上一版。
  // 真实踩过——切到某个风格的第一帧，预览是空白的，按钮却显示「保存 *」，
  // 因为那一帧读到的是三个还没填内容（或已换掉）的编辑框。
  // 子组件的 effect 先于父组件执行，所以这里读到的已经是新 DOM。
  useEffect(() => {
    if (!data || !cur) {
      setDoc('');
      setDirty(false);
      return;
    }
    const code = readCode();
    setDoc(buildSvgDoc(code, theme));
    setDirty(SLOTS.some((s) => String(code[s] ?? '') !== String(cur[s] ?? '')));
    // readCode 由 cur 派生、cur 由 data/style 派生；theme 是预览层替换，改变即重渲染。
  }, [data, style, tick, theme]);

  // 切风格：颜色槽随风格变化，重置预览层替换。
  useEffect(() => {
    setTheme({});
  }, [style]);

  // 颜色面板的槽位检测吃**编辑器现值**（含未保存改动与迁移结果），tick 后 DOM 已落定
  useEffect(() => {
    setLiveSvg(readCode().svg || '');
  }, [tick, data, style, readCode]);

  // 「迁移为变量」：读编辑器现值 → 生成模板化源码 → 写回 SVG 编辑器（脏态，用户过目后保存）
  const migrateColors = () => {
    const ta = editRef.current?.querySelector('[data-slot="svg"] .code-area');
    if (!ta) return;
    const r = migrateToVars(String(ta.value || ''));
    if (!r.count) {
      toast.ok('没有可迁移的硬编码颜色');
      return;
    }
    // 直写 ta.value 会被 React 的 value tracker 判成「没变」而吞掉 input 事件——
    // 走原型 setter 绕开实例 tracker，React 的 onChange 才会收到（脏标记随之亮起）
    const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ta), 'value')?.set;
    if (set) set.call(ta, r.svg);
    else ta.value = r.svg;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    toast.ok(`已迁移 ${r.count} 处颜色为变量（记得保存）`);
  };

  // 给操作层用的是**实时**判断（按下保存那一刻 DOM 一定已落定），不是上面那份滞后一帧的状态。
  const isDirty = () => {
    if (!cur) return false;
    const now = readCode();
    return SLOTS.some((s) => String(now[s] ?? '') !== String(cur[s] ?? ''));
  };

  const ops = makeDetailOps({
    bin, group, name, sel: { style }, asset: data, readCode, isDirty,
    reload, dialog, guard, toast, nav, setModal,
  });

  const crumbSegs = [
    { label: 'SVG 看板', key: 'root', onGo: () => nav.board() },
    ...String(group).split('/').filter(Boolean).map((s, i, arr) => {
      const upto = arr.slice(0, i + 1).join('/');
      return {
        label: s,
        key: upto,
        onGo: () => nav.group(upto),
      };
    }),
    { label: name, key: name },
  ];

  const issues = cur?.audit?.issues || [];

  // 描述抽屉的「保存全部」：主描述无条件存；风格描述按格对比，哪格变了存哪格。
  // 口径随表单走——inline 单格时代只存当前格，抽屉把所有格摆开后回到全量对比。
  // 每次风格保存服务端都会 reload 一次，这里遍历的是进抽屉那一刻的 styles 快照，不受影响。
  const saveDescs = async (mainText, styleText) => {
    setDescBusy(true);
    try {
      await ops.saveAssetDesc(mainText);
      for (const s of data?.styles || []) {
        if ((s.desc || '') !== (styleText[s.name] ?? '')) {
          await ops.saveStyleDesc(s.name, styleText[s.name] ?? '');
        }
      }
      setDescEditing(false);
    } finally {
      setDescBusy(false);
    }
  };

  if (err) return <div className="empty bad">接口调用失败：{err}</div>;

  return (
    <div className="svg-board detail">
      <div className="page-head">
        <Crumb segs={crumbSegs} />
        <BtnBar className="page-head-acts">
          <BtnBarSpacer />
          {/* 次级动作（整页预览 / 编辑历史 / 按规范修复）收进「更多」，
              页头只留主按钮（保存，始终实心绿）。面板头那颗是状态芯片（.save-chip）。 */}
          <BtnMenu label="更多" testId="detail-head-more" panelTestId="detail-head-more-panel">
            <BtnMenuLabel>视图</BtnMenuLabel>
            <BtnMenuItem onClick={() => nav.full(group, name)} testId="menu-full-preview">
              整页预览
            </BtnMenuItem>
            <BtnMenuItem onClick={ops.history} disabled={!cur} testId="menu-history">
              编辑历史
            </BtnMenuItem>
            <BtnMenuSep />
            <BtnMenuItem onClick={ops.fixStyle} disabled={!cur} testId="menu-fix">
              按规范修复
            </BtnMenuItem>
          </BtnMenu>
          <Btn variant="primary" onClick={ops.save} disabled={!cur}>
            {dirty ? '保存 *' : '保存'}
          </Btn>
        </BtnBar>
      </div>

      {!data && busy ? <Empty>加载中…</Empty> : null}

      {data ? (
        <>
          {/* 顶部两条信息条，把主工作区提到 ~225px（原来三段竖排顶到 493px，见
              temp/detail-layout-proto.html 的方案 A）：
              ① ident 行 = 图标 34 + 名字/路径 + 元信息 + 全部操作，一行装下；
              ② 描述行  = 主描述一句话 + 风格胶囊（原来是 130px 高的卡片墙）。 */}
          <div className="ident-row">
            <div className="ident-row-art">
              {cur?.svg ? <Icon svg={cur.svg} size={20} /> : <IconGhost size={20} />}
            </div>
            <div className="ident-row-main">
              <div className="ident-row-title">
                <span className="ident-row-name">{data.label}</span>
                <span className="mono muted">
                  {data.group}/{data.name}
                </span>
              </div>
              <div className="ident-row-meta">
                <span className="tag">{data.stats.styles} 个风格</span>
                {cur?.profile === 'color' ? (
                  // 插画 / 品牌标 / 带动画的图形：不套图标那套判据
                  <span className="tag">原色图形</span>
                ) : data.stats.issues ? (
                  <span className="tag">{data.stats.issues} 项待规范</span>
                ) : (
                  <span className="tag">全部合规</span>
                )}
                <span className="muted">
                  {cur?.profile === 'color'
                    ? '不套图标规范（配色与线宽原样保留）'
                    : `规范 ${data.spec.grid}pt · stroke ${data.spec.strokeWidth} · ${data.spec.color}`}
                </span>
                <TagBar tags={data.tags} onAdd={ops.addTags} onRemove={ops.removeTag} />
              </div>
            </div>
            <div className="ident-row-acts">
              <Btn size="sm" variant="secondary" onClick={ops.newStyle}>
                新风格
              </Btn>
              {/* 图标 / 风格的次要动作（设为当前 / 改名 / 删风格 / 删图标）收进这里。
                  不叫「更多」：页头已有一颗页面级的「更多」（整页预览等），两颗同名
                  同形上下相邻，作用域差异只有点开才看得见（用户反馈）。四项全部
                  作用于当前图标或其风格，名字即作用域。 */}
              <BtnMenu label="图标操作" size="sm" testId="detail-style-more" panelTestId="detail-style-more-panel">
                <BtnMenuItem
                  onClick={() => ops.setActive()}
                  disabled={!cur || cur.name === data.activeStyle}
                  testId="menu-set-active"
                >
                  设为当前
                </BtnMenuItem>
                <BtnMenuItem onClick={ops.rename} testId="menu-rename">
                  改名
                </BtnMenuItem>
                <BtnMenuSep />
                <BtnMenuItem onClick={ops.removeStyle} disabled={!cur} testId="menu-remove-style">
                  删风格
                </BtnMenuItem>
                <BtnMenuItem danger onClick={ops.removeAsset} testId="menu-remove-asset">
                  删图标
                </BtnMenuItem>
              </BtnMenu>
            </div>
          </div>

          {/* 描述 + 风格：一条只读行。点「编辑」开右侧抽屉（DescDrawer）集中填
              主描述与全部风格描述，不再原地展开表单。 */}
          <div className="ds-line" data-testid="desc-panel">
            <span className="ds-label">描述</span>
            <span className="ds-text" title={data.desc || ''}>
              {data.desc || <span className="muted">还没有主描述</span>}
            </span>
            <StyleStrip
              styles={data.styles}
              activeStyle={data.activeStyle}
              current={style}
              onPick={setStyle}
            />
            <Btn
              size="sm"
              variant="secondary"
              onClick={() => setDescEditing(true)}
              testId="desc-edit-toggle"
              title="主描述 + 每个风格一条；保存后 `svg tree --search` 能召回"
            >
              编辑
            </Btn>
          </div>

          {/* 左右可拖拽（比例由用户定，不是写死的 380px）；双击分隔条复位，
              键盘方向键也能调（WCAG 2.2 AA：拖拽不能是唯一方式） */}
          <SplitPane
            direction="horizontal"
            initialPct={62}
            minPct={30}
            maxPct={85}
            persistKey="nx-ft-svg-detail-split"
            testId="detail-split"
            left={
              <section className="panel-card">
                <div className="panel-card-head">
                  <span>编辑 · <span className="mono">{style || '—'}</span></span>
                  <span className="panel-card-extra">
                    <span className="muted">Ctrl/Cmd+S</span>
                    {/* 这颗是**状态**，不是第二颗主按钮：全页唯一的实心绿留给页头那颗
                        （见 btn/index.jsx 的第 1 条规矩）。所以走 .save-chip——
                        绿框 + 浅底，已保存时不可点，有改动才亮起来。 */}
                    <button
                      type="button"
                      className="save-chip"
                      onClick={ops.save}
                      disabled={!cur || !dirty}
                      data-testid="detail-save"
                    >
                      {dirty ? '保存 *' : '已保存'}
                    </button>
                  </span>
                </div>
                <div className="panel-card-body panel-card-body-editor">
                  <MultiPaneEditor
                    layoutKey="svg"
                    slots={SLOTS}
                    labels={LABEL}
                    ready={!!cur}
                    code={cur ? { svg: cur.svg, css: cur.css, js: cur.js } : {}}
                    codeKey={style}
                    rootRef={editRef}
                    onSave={ops.save}
                    onChange={() => setTick((n) => n + 1)}
                    // 「颜色」是编辑平面里的一个模块页签（与 svg/css/js 同层，可拖动分栏），
                    // 不再是预览下方的独立抽屉（用户反馈：没必要单独一个区块）。
                    // 自动检测的硬编码色与色板 binding 原样保留。
                    extras={{
                      color: {
                        label: '颜色',
                        render: () => (
                          <ColorPanel
                            svg={liveSvg || cur?.svg}
                            theme={theme}
                            onChange={setTheme}
                            onMigrate={migrateColors}
                          />
                        ),
                      },
                    }}
                  />
                </div>
              </section>
            }
            right={
              // 右栏再切一刀：预览 ↔ 规范问题，高度可拖（原来预览高度写死）
              <SplitPane
                direction="vertical"
                initialPct={68}
                minPct={25}
                maxPct={88}
                persistKey="nx-ft-svg-detail-side-split"
                testId="detail-side-split"
                left={
                  <div className="detail-side-preview">
                    <PreviewPane doc={doc} kind="svg" full={full} tick={tick} onToggleFull={() => setFull((f) => !f)} />
                  </div>
                }
                right={
                  <section className="panel-card">
                    <div className="panel-card-head">
                      <span>规范问题</span>
                      <span className="panel-card-extra muted mono">{style}</span>
                    </div>
                    <div className="panel-card-body">
                      <IssueList issues={issues} style={style} onFix={ops.fixStyle} profile={cur?.profile} />
                    </div>
                  </section>
                }
              />
            }
          />

          <section className="panel-card">
            <div className="panel-card-head">
              <span>CLI 命令（AI 用这三条编辑这枚图标）</span>
            </div>
            <div className="panel-card-body">
              <CliBlock bin={bin} group={group} name={name} style={style} svg={cur?.svg} />
            </div>
          </section>
        </>
      ) : null}

      {modal ? (
        <Modal title="编辑历史" onClose={() => setModal(null)}>
          {modal}
        </Modal>
      ) : null}
      {descEditing ? (
        <DescDrawer
          group={group}
          name={name}
          desc={data.desc}
          styles={data.styles}
          activeStyle={data.activeStyle}
          busy={descBusy}
          onClose={() => setDescEditing(false)}
          onSave={saveDescs}
        />
      ) : null}
      {dlgNode}
    </div>
  );
}
