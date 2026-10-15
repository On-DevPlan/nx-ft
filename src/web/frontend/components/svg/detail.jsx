// 资源页（路由 `#/svg/asset/<分组>/<名字>`）：一枚图标的全貌与编辑器。
//
// 与共用面板（components/asset）的区别：那里是「html/svg 通用的资源浏览器」，
// 按资源切换；这里专治图标集——多风格并排、规范问题清单、编辑历史回退、
// 以及「这枚图标对应的 CLI 命令」三件图标集才需要的事。
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../../store.jsx';
import { Btn, BtnBar, BtnBarSpacer } from '../btn/index.jsx';
import { SplitPane } from '../asset/SplitPane.jsx';
import { MultiPaneEditor, readSlotCode } from '../code-workbench/index.jsx';
import { buildSvgDoc } from '../preview/doc.js';
import { PreviewPane } from '../preview/index.jsx';
import { Modal, useDialog, useGuard, useToast } from '../ui.jsx';
import { makeDetailOps } from './detail-ops.jsx';
import { CliBlock, DescEditor, IssueList, StyleStrip, TagBar } from './detail-parts.jsx';
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
    setDoc(buildSvgDoc(code));
    setDirty(SLOTS.some((s) => String(code[s] ?? '') !== String(cur[s] ?? '')));
    // readCode 由 cur 派生、cur 由 data/style 派生，故依赖这三项即可
  }, [data, style, tick]);

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

  // 描述面板的「保存全部」：主描述 + 只提交**当前选中**那一格的风格描述（编辑表单里
  // 也只显示这一格）。原来循环所有风格是表单里给所有都渲染了一行，现在表单收窄到
  // 单格，保存也跟着收窄 —— 改其它格的描述就在常驻栏里点对应的胶囊切到当前，再开编辑。
  const saveDescs = async (mainText, styleText) => {
    setDescBusy(true);
    try {
      await ops.saveAssetDesc(mainText);
      const cur = data?.styles?.find((x) => x.name === style);
      if (cur && (cur.desc || '') !== (styleText[style] ?? '')) {
        await ops.saveStyleDesc(style, styleText[style] ?? '');
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
          {/* 次级按钮（整页预览 / 编辑历史 / 按规范修复）→ 主按钮（保存，始终实心绿）。
              面板头那颗是状态芯片（.save-chip），不跟这里抢色块。 */}
          <Btn variant="secondary" onClick={() => nav.full(group, name)}>
            整页预览
          </Btn>
          <Btn variant="secondary" onClick={ops.history} disabled={!cur}>
            编辑历史
          </Btn>
          <Btn variant="secondary" onClick={ops.fixStyle} disabled={!cur}>
            按规范修复
          </Btn>
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
              <Btn
                size="sm"
                variant="secondary"
                onClick={() => ops.setActive()}
                disabled={!cur || cur.name === data.activeStyle}
              >
                设为当前
              </Btn>
              <Btn size="sm" variant="secondary" onClick={ops.rename}>
                改名
              </Btn>
              <Btn size="sm" variant="secondary" onClick={ops.removeStyle} disabled={!cur}>
                删风格
              </Btn>
              <Btn size="sm" variant="danger" onClick={ops.removeAsset}>
                删图标
              </Btn>
            </div>
          </div>

          {/* 描述 + 风格：一条。点「编辑」原地展开成表单（DescEditor），
              不再为只读描述常驻一整块面板。 */}
          <div className={'ds-line' + (descEditing ? ' ds-line-edit' : '')} data-testid="desc-panel">
            {descEditing ? (
              <DescEditor
                desc={data.desc}
                styles={data.styles}
                current={style}
                busy={descBusy}
                onCancel={() => setDescEditing(false)}
                onSave={saveDescs}
              />
            ) : (
              <>
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
              </>
            )}
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
      {dlgNode}
    </div>
  );
}
