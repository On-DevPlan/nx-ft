// 自定义工具栏面板的呈现件集合：区行 / 菜单行 / 预览条 / 区卡片。
// 只管「一行 / 一块怎么长」，拖拽状态与落点判定全在 toolbar-layout-panel.jsx——
// 那边把数据与行为打包成一个 api 对象传过来，这里不持有任何状态。
// （与 svg/detail-parts.jsx 同一组织方式：主体装状态机，呈现件独立成文件。）
import { Btn } from '../btn/index.jsx';
import { isLocked, isMenuItemId, metaOf } from './toolbar-modules.js';

// 工具栏区域行：拖拽把手 + checkbox + 排序兜底按钮。
// checkbox 语义随项类型：原生项 = 显隐；快捷菜单项 = 是否挂工具栏（quick）。
// 兜底按钮（↑↓ / 换区）悬停或键盘聚焦才出现——拖拽是正路，点只是退路。
export function TlpZoneRow({ item, zone, api }) {
  const { dropKey, srcId, rowsOf, swapZone, nudge, onRowKey, begin, finish, toggleVis, toggleQuick } = api;
  const mod = metaOf(item.id);
  const lock = isLocked(item.id);
  const menuOrigin = isMenuItemId(item.id);
  const boxChecked = menuOrigin ? !!item.quick : item.visible !== false;
  const hint = dropKey === `row:${item.id}:before` ? ' drop-before'
    : dropKey === `row:${item.id}:after` ? ' drop-after' : '';
  const cls = ['tlp-row', boxChecked ? '' : 'off', lock ? 'lock' : '',
    srcId === item.id ? 'dragging' : '', hint].filter(Boolean).join(' ');
  const rows = rowsOf(zone);
  const i = rows.findIndex((x) => x.id === item.id);
  return (
    <div
      className={cls}
      draggable={!lock}
      data-row-id={item.id}
      tabIndex={lock ? undefined : 0}
      role="listitem"
      aria-label={lock ? undefined : `${mod.label || item.id}：拖动排序，Alt+上下键换位次，Alt+左右键换区`}
      onKeyDown={(e) => onRowKey(item, zone, e)}
      onDragStart={(e) => begin(e, item)}
      onDragEnd={finish}
      data-testid={`tlp-row-${item.id}`}
    >
      <span className="tlp-hnd" title={lock ? '主按钮恒在末位' : '拖动排序 / 拖到另一区挪位'}>
        {lock ? '·' : '⋮⋮'}
      </span>
      <input
        type="checkbox"
        checked={boxChecked}
        disabled={!!mod.noHide}
        onChange={() => (menuOrigin ? toggleQuick(item.id) : toggleVis(item.id))}
        title={mod.noHide
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
        <span className="tlp-acts">
          <Btn
            size="sm"
            variant="secondary"
            onClick={() => swapZone(item)}
            title={zone === 'left' ? '移到右侧区域' : '移到左侧区域'}
            testId={`tlp-zone-${item.id}`}
          >
            {zone === 'left' ? '→ 右' : '→ 左'}
          </Btn>
          <Btn
            size="sm"
            variant="secondary"
            onClick={() => nudge(item, zone, -1)}
            disabled={i <= 0}
            title="上移"
            testId={`tlp-up-${item.id}`}
          >↑</Btn>
          <Btn
            size="sm"
            variant="secondary"
            onClick={() => nudge(item, zone, 1)}
            disabled={i < 0 || i >= rows.length - 1}
            title="下移"
            testId={`tlp-down-${item.id}`}
          >↓</Btn>
        </span>
      ) : null}
    </div>
  );
}

// 「更多」卡片行：菜单显隐勾选 + 快捷显示开关；整行可拖（拖到上方区 = 上工具栏）
export function TlpMenuRow({ item, api }) {
  const { srcId, begin, finish, toggleVis, toggleQuick } = api;
  const mod = metaOf(item.id);
  return (
    <div
      className={'tlp-row' + (item.visible === false ? ' off' : '') +
        (srcId === item.id ? ' dragging' : '')}
      draggable
      role="listitem"
      onDragStart={(e) => begin(e, item)}
      onDragEnd={finish}
      data-testid={`tlp-row-${item.id}`}
    >
      <span className="tlp-hnd" title="拖到上方工具栏区域 = 加为快捷按钮">⋮⋮</span>
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
        title="快捷显示：同时作为按钮出现在工具栏上（可在左栏编排位置）"
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
}

// 预览条上的一个 chip：与工具栏按钮同形，可直接拖动（排序 / 跨「│」换区）。
// 快捷菜单项 = 虚线 chip（与真实工具栏的呈现一致）。
function Chip({ x, api }) {
  const { srcId, dropKey, begin, finish, overChip, dropChip } = api;
  const cls = ['tlp-chip', isMenuItemId(x.id) ? 'quick' : '', srcId === x.id ? 'dragging' : '',
    dropKey === `chip:${x.id}:before` ? 'drop-before'
      : dropKey === `chip:${x.id}:after` ? 'drop-after' : ''].filter(Boolean).join(' ');
  return (
    <span
      className={cls}
      draggable
      role="listitem"
      onDragStart={(e) => begin(e, x)}
      onDragEnd={finish}
      onDragOver={(e) => overChip(x, e)}
      onDrop={(e) => dropChip(x, e)}
      data-testid={`tlp-chip-${x.id}`}
    >{metaOf(x.id).label || x.id}</span>
  );
}

// 工具栏预览条（横贯双栏）：随编排实时变化，且**本身就是可拖面**——
// 位置就在眼前，不必先到下面的列表里找那一行。
// 左区 chips → 「│」分界（左半 = 左区末位，右半 = 右区首位）→ 右区 chips → 主按钮。
export function TlpPreview({ api }) {
  const { prevLeft, prevRight, primary, dropKey, overPreview, overDiv, dropDiv, overPrimary, dropPrimary } = api;
  return (
    <div className="tlp-preview" role="list" onDragOver={overPreview} data-testid="tlp-preview">
      {prevLeft.map((x) => <Chip key={x.id} x={x} api={api} />)}
      <span
        role="presentation"
        className={'tlp-chip muted-chip' + (dropKey === 'div:left' || dropKey === 'div:right' ? ' drop-on' : '')}
        onDragOver={overDiv}
        onDrop={dropDiv}
        title="左/右区的分界：往左半松手 = 左区末位，右半 = 右区首位"
      >│</span>
      {prevRight.map((x) => <Chip key={x.id} x={x} api={api} />)}
      {primary ? (
        <span
          role="listitem"
          className={'tlp-chip primary' + (dropKey === 'chip:primary:before' ? ' drop-before' : '')}
          onDragOver={overPrimary}
          onDrop={dropPrimary}
          title="主按钮恒在末位：拖到它上面 = 插到它之前"
        >{metaOf(primary.id).label}</span>
      ) : null}
    </div>
  );
}

// 工具栏的一个区卡片（左 / 右）：区列表统一接拖拽，按行中点判落点（判定在面板）
export function TlpZoneSection({ zone, label, api }) {
  const { dropKey, rowsOf, overZone, dropZone, leaveZone } = api;
  const rows = rowsOf(zone);
  return (
    <div className="tlp-section">
      <div className="tlp-section-label">{label}</div>
      <div
        className={'tlp-list' + (dropKey === `zone:${zone}:end` ? ' drop-on' : '')}
        role="list"
        onDragOver={(e) => overZone(zone, e)}
        onDragLeave={leaveZone}
        onDrop={(e) => dropZone(zone, e)}
        data-testid={`tlp-zone-${zone}`}
      >
        {rows.length
          ? rows.map((x) => <TlpZoneRow key={x.id} item={x} zone={zone} api={api} />)
          : <div className="tlp-empty muted" role="presentation">空 —— 把模块拖到这里</div>}
      </div>
    </div>
  );
}

// 「更多」菜单卡片：全部菜单项装一张卡片，每行 = 菜单显隐 + 快捷显示开关。
// 整张卡片是「从工具栏摘下来」的落点（quick = false，菜单里保留）。
export function TlpMenuCard({ api }) {
  const { menuRows, dropKey, overMenu, dropMenu, leaveMenu } = api;
  return (
    <div className="tlp-section">
      <div className="tlp-section-label">
        更多菜单（勾选 = 显示在菜单里；「快捷显示」= 同时作为按钮出现在工具栏，可在左栏编排）
      </div>
      <div
        className={'tlp-list tlp-menu' + (dropKey === 'menu' ? ' dropping' : '')}
        role="list"
        onDragOver={overMenu}
        onDragLeave={leaveMenu}
        onDrop={dropMenu}
        data-testid="tlp-menu"
      >
        {menuRows.map((x) => <TlpMenuRow key={x.id} item={x} api={api} />)}
        <div className="tlp-drop-hint" role="presentation">
          {dropKey === 'menu'
            ? '松手 = 从工具栏摘下来（菜单里保留）'
            : '把菜单项拖到左侧工具栏区域 = 加为快捷按钮'}
        </div>
      </div>
    </div>
  );
}
