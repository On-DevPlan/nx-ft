// 自定义工具栏面板（编辑面板）：模块化所有工具栏按钮与「更多」菜单子项。
// 入口 = manage-bar.jsx 的「更多」菜单底部「自定义工具栏…」。
// 顶部实时预览条：随面板内调整即时反映工具栏形状；保存写回 layout。
//
// 分 3 段渲染：
//   工具栏 · 左侧区域 — 排序 + 显隐 + 「→ 右」（含开了快捷显示的菜单项）
//   工具栏 · 右侧区域 — 同上；+ 新建锁定末位；快捷项与原生项混排
//   更多菜单（一个卡片装下全部菜单项）— 每行两个开关：
//     「显示在菜单」勾选（visible） + 「快捷显示」勾选（quick = 同时出现在工具栏）
//     开了快捷显示的项同时出现在上方分区里参与编排（拖拽/箭头/挪区）。
//     两个开关相互独立：只挂工具栏 / 只在菜单 / 两边都有 / 都不显示。
import { useRef, useState } from 'react';
import { Modal } from '../ui.jsx';
import { Btn } from '../btn/index.jsx';
import { MODULES } from './useToolbarLayout.js';

export function ToolbarLayoutPanel({ layout, setLayout, onClose }) {
  // 面板里改的是副本：保存才落到上层 layout；取消丢弃。
  const [work, setWork] = useState(() => layout.map((x) => ({ ...x })));
  const dragIdx = useRef(null); // { id, zone }

  const REG = Object.fromEntries(MODULES.map((m) => [m.id, { ...m }]));
  const metaOf = (id) => REG[id] || {};
  const isMenu = (x) => String(metaOf(x.id).section || '').startsWith('more-');
  const effZone = (x) => x.zone || metaOf(x.id).zone || 'right';
  // 是否在工具栏上：原生项看 visible；菜单项看 quick 开关
  const onBar = (x) => (isMenu(x) ? !!x.quick : x.visible !== false);

  // 工具栏段：原生项 + 开了快捷显示的菜单项混排，按 zone 拆两段；主按钮固定右段末位
  const barAll = work.filter((x) => {
    const s = metaOf(x.id).section;
    return s === 'top' || s === 'primary' || (String(s || '').startsWith('more-') && x.quick);
  });
  const leftRows = barAll.filter((x) => effZone(x) === 'left');
  const rightRows = barAll
    .filter((x) => effZone(x) === 'right')
    .slice()
    .sort((a, b) => (metaOf(a.id).lockLast ? 1 : 0) - (metaOf(b.id).lockLast ? 1 : 0));

  // 「更多」卡片：全部菜单项（视图是单项单选组；不再按逐视图注册）
  const menuRows = work.filter((x) => isMenu(x));

  // 预览：左区 → │ → 右区（含快捷项，虚线 chip）→ 主按钮
  const prevLeft = barAll.filter((x) => effZone(x) === 'left' && onBar(x));
  const prevRight = barAll.filter((x) => effZone(x) === 'right' && onBar(x) && !metaOf(x.id).lockLast);
  const primaryVis = work.find((x) => metaOf(x.id).lockLast && (isMenu(x) || x.visible));

  // 段内重排：抽出该区域全部项 → 重排 → 按原槽位回填（另一区域相对位置不动）。
  // primary 双重锁定：source/target 是 primary 都直接拒。
  const moveInZone = (zone, fromId, toId) => {
    if (fromId === toId) return;
    if (metaOf(fromId).lockLast || metaOf(toId).lockLast) return;
    const zoneItems = barAll.filter((x) => effZone(x) === zone);
    const fromIdx = zoneItems.findIndex((x) => x.id === fromId);
    const toIdx = zoneItems.findIndex((x) => x.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const reordered = zoneItems.slice();
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const next = work.slice();
    let zi = 0;
    for (let i = 0; i < next.length; i++) {
      if (barAll.includes(next[i]) && effZone(next[i]) === zone) next[i] = reordered[zi++];
    }
    setWork(next);
  };

  const toggleZone = (id) => {
    if (metaOf(id).lockLast) return; // 主按钮不挪区
    setWork((w) => w.map((x) => {
      if (x.id !== id) return x;
      const cur = x.zone || metaOf(id).zone || 'right';
      return { ...x, zone: cur === 'left' ? 'right' : 'left' };
    }));
  };

  const toggleVis = (id) => {
    if (metaOf(id).noHide) return; // 主按钮不可隐
    setWork((w) => w.map((m) => (m.id === id ? { ...m, visible: m.visible === false ? true : false } : m)));
  };
  const toggleQuick = (id) => {
    setWork((w) => w.map((m) => (m.id === id ? { ...m, quick: !m.quick } : m)));
  };

  const save = () => { setLayout(work); onClose(); };
  const reset = () => setWork(MODULES.map((m) => ({ id: m.id, visible: true })));

  // 工具栏区域行：checkbox + 排序 + 「→ 右/左」。
  // checkbox 语义随项类型：原生项 = 显隐；快捷菜单项 = 是否挂工具栏（quick）。
  const renderZoneRow = (item, zone, zoneRows) => {
    const mod = metaOf(item.id);
    const lock = !!mod.lockLast;
    const noHide = !!mod.noHide;
    const menuOrigin = isMenu(item);
    const boxChecked = menuOrigin ? !!item.quick : item.visible !== false;
    return (
      <div
        key={item.id}
        className={'tlp-row' + (boxChecked ? '' : ' off') + (lock ? ' lock' : '')}
        draggable={!lock}
        onDragStart={() => { dragIdx.current = { id: item.id, zone }; }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const from = dragIdx.current;
          dragIdx.current = null;
          if (!from || from.id === item.id) return;
          if (from.zone !== zone) { toggleZone(from.id); return; } // 跨区拖放 = 挪区
          moveInZone(zone, from.id, item.id);
        }}
        data-testid={`tlp-row-${item.id}`}
      >
        <span className="tlp-hnd" title={lock ? '主按钮恒在末位' : '拖动排序'}>
          {lock ? '·' : '⋮⋮'}
        </span>
        <input
          type="checkbox"
          checked={boxChecked}
          disabled={noHide}
          onChange={() => (menuOrigin ? toggleQuick(item.id) : toggleVis(item.id))}
          title={noHide
            ? '主按钮不可隐藏'
            : menuOrigin
            ? (item.quick ? '取消快捷显示（从工具栏移除，菜单里保留）' : '已在工具栏（勾选 = 快捷显示）')
            : (item.visible ? '隐藏' : '显示')}
          data-testid={`tlp-vis-${item.id}`}
        />
        <span className="tlp-nm">
          {mod.label || item.id}
          {mod.sub ? <span className="tlp-sub">{mod.sub}{lock ? ' · 不可隐藏' : ''}</span> : null}
        </span>
        {!lock ? (
          <Btn
            size="sm"
            variant="secondary"
            onClick={() => toggleZone(item.id)}
            title={zone === 'left' ? '移到右侧区域' : '移到左侧区域'}
            testId={`tlp-zone-${item.id}`}
          >
            {zone === 'left' ? '→ 右' : '→ 左'}
          </Btn>
        ) : null}
        <span className="tlp-updown">
          <Btn
            size="sm"
            variant="secondary"
            onClick={() => {
              const idx = zoneRows.findIndex((x) => x.id === item.id);
              moveInZone(zone, item.id, zoneRows[idx - 1]?.id);
            }}
            disabled={(() => {
              const idx = zoneRows.findIndex((x) => x.id === item.id);
              return idx <= 0 || lock;
            })()}
            title={lock ? '主按钮恒在末位' : '上移'}
            testId={`tlp-up-${item.id}`}
          >↑</Btn>
          <Btn
            size="sm"
            variant="secondary"
            onClick={() => {
              const idx = zoneRows.findIndex((x) => x.id === item.id);
              moveInZone(zone, item.id, zoneRows[idx + 1]?.id);
            }}
            disabled={(() => {
              const idx = zoneRows.findIndex((x) => x.id === item.id);
              return !!metaOf(zoneRows[idx + 1]?.id).lockLast;
            })()}
            title={(() => (metaOf(zoneRows[zoneRows.findIndex((x) => x.id === item.id) + 1]?.id)?.lockLast
              ? '「+ 新建」恒在末位' : '下移'))()}
            testId={`tlp-down-${item.id}`}
          >↓</Btn>
        </span>
      </div>
    );
  };

  // 「更多」卡片行：菜单显隐勾选 + 快捷显示开关（一个卡片装下全部菜单项）
  const renderMenuRow = (item) => {
    const mod = metaOf(item.id);
    return (
      <div
        key={item.id}
        className={'tlp-row' + (item.visible === false ? ' off' : '')}
        data-testid={`tlp-row-${item.id}`}
      >
        <span className="tlp-hnd" title="菜单项不参与排序">·</span>
        <input
          type="checkbox"
          checked={item.visible !== false}
          onChange={() => toggleVis(item.id)}
          title={item.visible !== false ? '在「更多」菜单里隐藏' : '显示在「更多」菜单里'}
          data-testid={`tlp-vis-${item.id}`}
        />
        <span className="tlp-nm">
          {mod.label || item.id}
          {mod.sub ? <span className="tlp-sub">{mod.sub}</span> : null}
        </span>
        <label
          className={'tlp-quick' + (item.quick ? ' on' : '')}
          title="快捷显示：同时作为按钮出现在工具栏右侧（主按钮之前）"
          data-testid={`tlp-quick-${item.id}`}
        >
          <input
            type="checkbox"
            checked={!!item.quick}
            onChange={() => toggleQuick(item.id)}
          />
          快捷显示
        </label>
      </div>
    );
  };

  return (
    <Modal title="自定义工具栏" onClose={onClose}>
      <div className="tlp-body">
        {/* 工具栏预览（横贯双栏） */}
        <div className="tlp-section tlp-span">
          <div className="tlp-section-label">预览（随下方调整实时变化）</div>
          <div className="tlp-preview">
            {prevLeft.map((x) => <span key={x.id} className="tlp-chip">{metaOf(x.id).label || x.id}</span>)}
            <span className="tlp-chip muted-chip">│</span>
            {prevRight.map((x) => (
              <span key={x.id} className={'tlp-chip' + (isMenu(x) ? ' quick' : '')}>
                {metaOf(x.id).label || x.id}
              </span>
            ))}
            {primaryVis ? <span className="tlp-chip primary">{metaOf(primaryVis.id).label}</span> : null}
          </div>
        </div>

        {/* 左栏：工具栏编排（两个分区） */}
        <div className="tlp-cols">
          <div className="tlp-section">
            <div className="tlp-section-label">工具栏 · 左侧区域（撑杆之前）</div>
            <div className="tlp-list">
              {leftRows.length
                ? leftRows.map((x) => renderZoneRow(x, 'left', leftRows))
                : <div className="tlp-empty muted">空——用「→ 左」把模块挪过来</div>}
            </div>
          </div>
          <div className="tlp-section">
            <div className="tlp-section-label">工具栏 · 右侧区域（撑杆之后，主按钮恒在末位）</div>
            <div className="tlp-list">
              {rightRows.map((x) => renderZoneRow(x, 'right', rightRows))}
            </div>
          </div>
        </div>

        {/* 右栏：「更多」卡片（一个卡片装下全部菜单项，每行 = 菜单显隐 + 快捷显示开关） */}
        <div className="tlp-cols">
          <div className="tlp-section">
            <div className="tlp-section-label">
              更多菜单（勾选 = 显示在菜单里；「快捷显示」= 同时作为按钮出现在工具栏，可在左栏编排）
            </div>
            <div className="tlp-list">
              {menuRows.map((x) => renderMenuRow(x))}
            </div>
          </div>
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
