// 自定义工具栏面板（编辑面板）：模块化所有工具栏按钮与「更多」菜单子项。
// 入口 = manage-bar.jsx 的「更多」菜单底部「自定义工具栏…」。
// 本文件是**状态机**（编排数据 + 拖拽判定 + 落点语义）；一行 / 一块怎么长在
// toolbar-rows.jsx，排序怎么算在 toolbar-dnd.js（纯函数），模块表与判定在
// toolbar-modules.js——判定只此一处，面板与栏渲染（manage-bar）共用。
//
// 顶部是工具栏预览条，随面板内调整即时反映形状；**预览条本身也能拖**——
// 位置就在眼前，不必先到下面的列表里找那一行。
//
// 位置控制以拖拽为准，点击只留给「显隐 / 快捷显示」两个开关（那两件事拖不出来）：
//   区内上下拖          → 段内排序（落在行的上/下半 = 插到它前/后）
//   拖到另一区（含空区）→ 挪区 + 插到落点
//   从「更多菜单」拖上来 → 加为快捷按钮（quick），菜单里同时保留
//   拖回「更多菜单」    → 取消快捷显示（菜单里保留），即「从工具栏摘下来」
//   Alt+↑↓ / Alt+←→    → 键盘换位次与换区（鼠标拖的等价物）
//   行内 ↑↓ / →左 →右   → 悬停或键盘聚焦才出现，兜底用
//
// 落点判定（与侧边栏 drag.jsx 同一套口径）：
//   区的落点由**区列表**统一判定——按列表内各行的中点算指针压在哪一行、压在上半
//   还是下半（不靠事件目标：行与行之间还有 3px 间隙，落在间隙里事件目标是容器，
//   按容器算会误判成「该区末位」）；行之下 / 空区 = 该区末位；
//   预览条：「│」左右半 = 左区末位 / 右区首位，主按钮上 = 它之前（恒末位）。
//   不合法的落点既不提示也不 preventDefault——浏览器自己显示禁止光标：「+ 新建」
//   拖不动，原生项（面包屑/搜索/更多）不是菜单成员，拖不进菜单卡片。
//
// 拖拽状态：**判定只读 ref，state 只用来画**。dragstart → dragover 落在同一帧时
// React 还没重渲染，只读 state 会让判定拿到旧值（侧边栏 drag.jsx 的踩坑记录）。
import { useRef, useState } from 'react';
import { Modal } from '../ui.jsx';
import { Btn } from '../btn/index.jsx';
import { MODULES, effZoneOf, isLocked, isMenuItemId, metaOf, onBarOf } from './toolbar-modules.js';
import { isMenuOnly, moveModule, setFlag } from './toolbar-dnd.js';
import { TlpMenuCard, TlpPreview, TlpZoneSection } from './toolbar-rows.jsx';

export function ToolbarLayoutPanel({ layout, setLayout, onClose }) {
  // 面板里改的是副本：保存才落到上层 layout；取消丢弃。
  const [work, setWork] = useState(() => layout.map((x) => ({ ...x })));
  const [dropKey, setDropKey] = useState(null); // 亮哪一行/哪一区（只影响画）
  const [srcId, setSrcId] = useState(null);     // 谁在拖（只影响画）
  const dragRef = useRef(null);                 // { id, quick }：判定只读它

  // 工具栏段：原生项 + 开了快捷显示的菜单项混排，按 zone 拆两段（数组序 = 渲染序）
  const barRows = work.filter((x) => {
    const s = metaOf(x.id).section;
    return s === 'top' || s === 'primary' || (isMenuItemId(x.id) && x.quick);
  });
  const leftRows = barRows.filter((x) => effZoneOf(x) === 'left');
  const rightRows = barRows.filter((x) => effZoneOf(x) === 'right');
  const movable = (rows) => rows.filter((x) => !isLocked(x.id)); // 可排序的项（主按钮除外）
  const rowsOf = (zone) => movable(zone === 'left' ? leftRows : rightRows);
  const menuRows = work.filter((x) => isMenuItemId(x.id));
  const primary = work.find((x) => isLocked(x.id));

  // 预览：左区 → │ → 右区（含快捷项，虚线 chip）→ 主按钮
  // 「只挂工具栏不进菜单」的项（visible:false + quick:true）照样在栏上，用 onBarOf 判
  const prevLeft = leftRows.filter(onBarOf);
  const prevRight = movable(rightRows).filter(onBarOf);

  // ---- 拖拽状态机：起 / 移 / 落 / 收 ----
  const live = () => {
    const s = dragRef.current;
    return s && !isLocked(s.id) ? s : null; // 锁定项不参与拖拽
  };
  const begin = (e, item) => {
    dragRef.current = { id: item.id, quick: !!item.quick };
    setSrcId(item.id);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.id); // Firefox 不 setData 不算起拖
    }
  };
  const finish = () => {
    dragRef.current = null;
    setSrcId(null);
    setDropKey(null);
  };
  // 松手：菜单项从「更多」拖上来时顺带开快捷显示（拖这一下就等于上工具栏）
  const dropAt = (s, target) =>
    setWork((w) => moveModule(w, { ...target, id: s.id, quick: isMenuOnly(s) ? true : undefined }));

  // 区列表里的落点：按各行的**中点**判指针压在哪一行、压在上半还是下半；
  // 压在最后一行之下（或空区）= 该区末位。
  const hitZone = (e) => {
    const y = e.clientY;
    for (const el of e.currentTarget.querySelectorAll('[data-row-id]')) {
      const r = el.getBoundingClientRect();
      if (y < r.top) return { anchorId: el.dataset.rowId, after: false };
      if (y <= r.bottom) return { anchorId: el.dataset.rowId, after: y > r.top + r.height / 2 };
    }
    return { anchorId: null, after: false };
  };
  const overZone = (zone, e) => {
    const s = live();
    if (!s) return;
    e.preventDefault();
    const hit = hitZone(e);
    // 落在自己身上 = 位置不变，什么都不亮（不撒谎）；行之下 = 亮整个区
    setDropKey(!hit.anchorId ? `zone:${zone}:end`
      : hit.anchorId === s.id ? null
      : `row:${hit.anchorId}:${hit.after ? 'after' : 'before'}`);
  };
  const dropZone = (zone, e) => {
    e.preventDefault();
    const hit = hitZone(e);
    const s = live();
    finish();
    if (s) dropAt(s, { anchorId: hit.anchorId, after: hit.after, zone });
  };
  const leaveZone = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return; // 在区内换行不算离开
    setDropKey((k) => (k && k.startsWith('zone:') ? null : k));
  };

  // 行/预览块上的前后判定：纵/横过半 = 插到它之后
  const afterHit = (e, axis) => {
    const r = e.currentTarget.getBoundingClientRect();
    const size = (axis === 'x' ? r.width : r.height) || 1;
    const pos = axis === 'x' ? e.clientX - r.left : e.clientY - r.top;
    return pos / size > 0.5;
  };

  // 菜单卡片：只收「菜单成员」（从工具栏摘回菜单）。原生项不是菜单成员，拖过来不吃。
  const canReturn = (s) => !!(s && isMenuItemId(s.id) && s.quick);
  const overMenu = (e) => {
    if (!canReturn(live())) return;
    e.preventDefault();
    setDropKey('menu');
  };
  const dropMenu = (e) => {
    e.preventDefault();
    const s = live();
    finish();
    if (s) setWork((w) => setFlag(w, s.id, { quick: false }));
  };
  const leaveMenu = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDropKey((k) => (k === 'menu' ? null : k));
  };

  // 预览块：就近站位（过半 = 插到它之后，区随锚点走）
  const overChip = (x, e) => {
    const s = live();
    if (!s || s.id === x.id) return;
    e.preventDefault();
    setDropKey(`chip:${x.id}:${afterHit(e, 'x') ? 'after' : 'before'}`);
  };
  const dropChip = (x, e) => {
    const after = afterHit(e, 'x');
    e.preventDefault();
    const s = live();
    finish();
    if (s) dropAt(s, { anchorId: x.id, after, zone: effZoneOf(x) });
  };
  // 预览条的空隙（chip 之外的空白）：落点含糊，只把上一次的标记清掉
  const overPreview = (e) => {
    if (e.target !== e.currentTarget) return;
    setDropKey((k) => (k && (k.startsWith('chip:') || k.startsWith('div:')) ? null : k));
  };
  const overDiv = (e) => {
    if (!live()) return;
    e.preventDefault();
    setDropKey(afterHit(e, 'x') ? 'div:right' : 'div:left');
  };
  const dropDiv = (e) => {
    const toRight = afterHit(e, 'x');
    e.preventDefault();
    const s = live();
    finish();
    if (!s) return;
    dropAt(s, toRight
      ? { anchorId: rightRows[0]?.id || null, after: false, zone: 'right' } // 右区首位
      : { zone: 'left' });                                                  // 左区末位
  };
  const overPrimary = (e) => { if (live()) { e.preventDefault(); setDropKey('chip:primary:before'); } };
  const dropPrimary = (e) => {
    e.preventDefault();
    const s = live();
    finish();
    if (s && primary) dropAt(s, { anchorId: primary.id, after: false, zone: effZoneOf(primary) });
  };

  // ---- 位置改写的其余入口：行内兜底按钮 + 键盘 ----
  const swapZone = (item) =>
    setWork((w) => moveModule(w, { id: item.id, zone: effZoneOf(item) === 'left' ? 'right' : 'left' }));
  const nudge = (item, zone, dir) => {
    const rows = rowsOf(zone);
    const i = rows.findIndex((x) => x.id === item.id);
    if (i < 0) return;
    if (dir < 0 && i > 0) setWork((w) => moveModule(w, { id: item.id, anchorId: rows[i - 1].id, zone }));
    if (dir > 0 && i < rows.length - 1) {
      setWork((w) => moveModule(w, { id: item.id, anchorId: rows[i + 1].id, after: true, zone }));
    }
  };
  const onRowKey = (item, zone, e) => {
    if (!e.altKey) return;
    if (e.key === 'ArrowUp') { e.preventDefault(); nudge(item, zone, -1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); nudge(item, zone, 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); swapZone(item); }
  };

  const toggleVis = (id) => {
    if (metaOf(id).noHide) return; // 主按钮不可隐
    setWork((w) => setFlag(w, id, { visible: w.find((m) => m.id === id).visible === false }));
  };
  const toggleQuick = (id) => setWork((w) => setFlag(w, id, { quick: !w.find((m) => m.id === id).quick }));
  const save = () => { setLayout(work); onClose(); };
  const reset = () => setWork(MODULES.map((m) => ({ id: m.id, visible: true })));

  // 呈现件的全部依赖打包成一个 api（见 toolbar-rows.jsx）
  const api = {
    srcId, dropKey, leftRows, rightRows, menuRows, primary, prevLeft, prevRight, rowsOf,
    begin, finish, overZone, dropZone, leaveZone, overMenu, dropMenu, leaveMenu,
    overPreview, overChip, dropChip, overDiv, dropDiv, overPrimary, dropPrimary,
    onRowKey, swapZone, nudge, toggleVis, toggleQuick,
  };

  return (
    <Modal title="自定义工具栏" onClose={onClose}>
      <div className="tlp-body">
        {/* 工具栏预览（横贯双栏）：可直接拖动这里的按钮排序 / 换区 */}
        <div className="tlp-section tlp-span">
          <div className="tlp-section-label">
            预览（随下方调整实时变化） · 可直接拖动这里的按钮排序，跨过「│」即换区
          </div>
          <TlpPreview api={api} />
        </div>

        {/* 左栏：工具栏编排（两个分区） */}
        <div className="tlp-cols">
          <TlpZoneSection zone="left" label="工具栏 · 左侧区域（撑杆之前）· 拖进来即排序" api={api} />
          <TlpZoneSection zone="right" label="工具栏 · 右侧区域（撑杆之后，主按钮恒在末位）" api={api} />
        </div>

        {/* 右栏：「更多」卡片（一个卡片装下全部菜单项，每行 = 菜单显隐 + 快捷显示开关） */}
        <div className="tlp-cols">
          <TlpMenuCard api={api} />
        </div>
      </div>

      <div className="tlp-foot">
        <span className="muted tlp-equiv">保存到本机 localStorage（按领域各存一份）</span>
        <Btn size="sm" variant="secondary" onClick={reset} testId="tlp-reset">恢复默认</Btn>
        <Btn size="sm" variant="secondary" onClick={onClose}>取消</Btn>
        <Btn size="sm" variant="primary" onClick={save} testId="tlp-save">保存</Btn>
      </div>
    </Modal>
  );
}
