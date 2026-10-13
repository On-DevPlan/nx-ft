// 资源页（路由 `#/svg/asset/<分组>/<名字>`）：一枚图标的全貌与编辑器。
//
// 与共用面板（components/asset）的区别：那里是「html/svg 通用的资源浏览器」，
// 按资源切换；这里专治图标集——多风格并排、规范问题清单、编辑历史回退、
// 以及「这枚图标对应的 CLI 命令」三件图标集才需要的事。
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../../store.jsx';
import { CodeEditor } from '../asset/CodeEditor.jsx';
import { PreviewPane } from '../asset/preview.jsx';
import { SplitPane } from '../asset/SplitPane.jsx';
import { Modal, useDialog, useGuard, useToast } from '../ui.jsx';
import { makeDetailOps } from './detail-ops.jsx';
import { CliBlock, DescPanel, IssueList, StyleStrip, TagBar } from './detail-parts.jsx';
import { Crumb, Empty } from './parts.jsx';
import { Icon, IconGhost } from './svg-inline.jsx';
import { useDetail, useNav } from './useSvg.js';

const SLOTS = ['svg', 'css', 'js'];
const LABEL = { svg: 'SVG', css: 'CSS', js: 'JS' };

// 预览文档：图形要**随预览区一起缩放**。
// 早先写的是 `#app{width:62%;height:62%}`——图形恒定只占帧的 62%，
// 把预览区拉大它也不动（用户三次反馈「预览高度被固定」，根因就在这一行）。
// 现在让 #app 撑满、留 6% 内边距当呼吸位（比例缩放，不是写死像素），
// svg 100% 填满 + 默认 preserveAspectRatio，图标与 800×600 的动画都能放大且不变形。
function svgDoc(code) {
  const css = [
    'html,body{margin:0;height:100%}',
    'body{display:grid;place-items:center;background:#fff}',
    '#app{width:100%;height:100%;padding:6%;box-sizing:border-box;display:grid;place-items:center}',
    'svg{width:100%;height:100%;display:block}',
    String(code.css || ''),
  ].join('\n');
  const js = String(code.js || '').trim();
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    `<style>\n${css}\n</style>`,
    '</head><body><div id="app">',
    String(code.svg || ''),
    '</div>',
    js ? `<script>\n${js}\n</script>` : '',
    '</body></html>',
  ].join('\n');
}

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

  // 代码的真相永远是 DOM 里的 textarea（CodeEditor 是非受控的，为了保住撤销栈）。
  const readCode = useCallback(() => {
    const out = {};
    const areas = editRef.current ? editRef.current.querySelectorAll('.code-area') : [];
    SLOTS.forEach((slot, i) => {
      out[slot] = areas[i] ? areas[i].value : String(cur?.[slot] ?? '');
    });
    return out;
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
    setDoc(svgDoc(code));
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

  // 描述面板的「保存全部」：主描述 + 只提交真正改过的风格描述（避免无谓写盘)
  const saveDescs = async (mainText, styleText) => {
    setDescBusy(true);
    try {
      await ops.saveAssetDesc(mainText);
      for (const s of data?.styles || []) {
        const next = styleText[s.name] ?? '';
        if ((s.desc || '') !== next) await ops.saveStyleDesc(s.name, next);
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
        <div className="page-head-acts">
          <button className="btn ghost" onClick={() => nav.full(group, name)}>
            整页预览
          </button>
          <button className="btn ghost" onClick={ops.history} disabled={!cur}>
            编辑历史
          </button>
          <button className="btn ghost" onClick={ops.fixStyle} disabled={!cur}>
            按规范修复
          </button>
          <button className={'btn' + (dirty ? '' : ' ghost')} onClick={ops.save} disabled={!cur}>
            {dirty ? '保存 *' : '保存'}
          </button>
        </div>
      </div>

      {!data && busy ? <Empty>加载中…</Empty> : null}

      {data ? (
        <>
          <div className="detail-ident">
            <div className="detail-ident-art">
              {cur?.svg ? <Icon svg={cur.svg} size={44} /> : <IconGhost size={44} />}
            </div>
            <div className="detail-ident-main">
              <div className="detail-ident-title">
                <span className="detail-ident-label">{data.label}</span>
                <span className="mono muted">
                  {data.group}/{data.name}
                </span>
              </div>
              <div className="detail-ident-meta">
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
                    ? '此类资源不套图标规范（配色与线宽原样保留，只校验几何容器）'
                    : `规范 ${data.spec.grid}pt · stroke ${data.spec.strokeWidth} · ${data.spec.color}`}
                </span>
              </div>
              <TagBar tags={data.tags} onAdd={ops.addTags} onRemove={ops.removeTag} />
            </div>
            <div className="detail-ident-acts">
              <button className="btn ghost" onClick={ops.newStyle}>
                新风格
              </button>
              <button className="btn ghost" onClick={() => ops.setActive()} disabled={!cur || cur.name === data.activeStyle}>
                设为当前
              </button>
              <button className="btn ghost" onClick={() => setDescEditing(true)} disabled={descEditing}>
                编辑描述
              </button>
              <button className="btn ghost" onClick={ops.rename}>
                改名
              </button>
              <button className="btn ghost" onClick={ops.removeStyle} disabled={!cur}>
                删风格
              </button>
              <button className="btn ghost danger" onClick={ops.removeAsset}>
                删图标
              </button>
            </div>
          </div>

          <section className="panel-card" data-testid="desc-panel">
            <div className="panel-card-head">
              <span>描述</span>
              <span className="panel-card-extra">
                {descEditing ? (
                  <span className="muted">主描述 + 每个风格一条；保存后 `svg tree --search` 能召回</span>
                ) : (
                  <button
                    className="btn small ghost"
                    onClick={() => setDescEditing(true)}
                    data-testid="desc-edit-toggle"
                  >
                    编辑
                  </button>
                )}
              </span>
            </div>
            <div className="panel-card-body">
              <DescPanel
                desc={data.desc}
                styles={data.styles}
                editing={descEditing}
                busy={descBusy}
                onToggleEdit={() => setDescEditing(false)}
                onSaveDesc={saveDescs}
              />
            </div>
          </section>

          <section className="panel-card">
            <div className="panel-card-head">
              <span>风格对比</span>
              <span className="panel-card-extra muted">点任一风格即切换编辑目标</span>
            </div>
            <div className="panel-card-body">
              <StyleStrip
                styles={data.styles}
                activeStyle={data.activeStyle}
                current={style}
                onPick={setStyle}
                onSetActive={ops.setActive}
              />
            </div>
          </section>

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
                    <button
                      className={'btn small' + (dirty ? ' primary' : ' ghost')}
                      onClick={ops.save}
                      disabled={!cur || !dirty}
                      data-testid="detail-save"
                    >
                      {dirty ? '保存 *' : '已保存'}
                    </button>
                  </span>
                </div>
                <div className="panel-card-body">
                  <div className="detail-editors" ref={editRef}>
                    {SLOTS.map((slot) => (
                      <CodeEditor
                        key={`${style}:${slot}`}
                        label={LABEL[slot]}
                        initial={cur ? cur[slot] : ''}
                        collapsed={slot === 'js'}
                        onSave={ops.save}
                        onChange={() => setTick((n) => n + 1)}
                      />
                    ))}
                  </div>
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
                    <PreviewPane doc={doc} full={full} tick={tick} onToggleFull={() => setFull((f) => !f)} />
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
