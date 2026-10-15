// 多栏编辑器的 DOM：panels / tabs / sash / drop-zone。逻辑在 index.jsx。
import { Fragment } from 'react';
import { CodeEditor } from '../asset/CodeEditor.jsx';
import { MIN_PCT, resizeAt } from './panel-layout.js';
import { setActive, SettingsGlyph } from './helpers.jsx';

export function MultiPaneView({
  setRoot,
  layout,
  axis,
  multi,
  labels,
  ready,
  codeKey,
  hint,
  dragRef,
  layoutRef,
  initialOf,
  onChange,
  onSave,
  onPanelOver,
  onPanelLeave,
  onPanelDrop,
  onTabsOver,
  onTabsDrop,
  onSashPointerDown,
  saveAsDefault,
  setLayout,
  setHint,
}) {
  return (
    <div
      className="wb-edit-pane"
      ref={setRoot}
      data-testid="wb-panels"
      data-axis={multi ? axis : undefined}
    >
      <div className={'wb-panels' + (multi ? ` wb-panels-${axis}` : '')}>
        {layout.panels.map((panel, i) => (
          <Fragment key={panel.id}>
            <div
              className="wb-panel"
              style={{ flex: `${layout.sizes[i]} 1 0%` }}
              data-testid={`wb-panel-${panel.id}`}
              onDragOver={(e) => onPanelOver(panel.id, e)}
              onDragLeave={onPanelLeave}
              onDrop={(e) => onPanelDrop(panel.id, e)}
            >
              <div
                className="wb-tabs"
                role="tablist"
                aria-label="文件"
                onDragOver={(e) => onTabsOver(panel.id, e)}
                onDragLeave={onPanelLeave}
                onDrop={(e) => onTabsDrop(panel.id, e)}
              >
                {panel.tabs.map((slot) => (
                  <button
                    key={slot}
                    role="tab"
                    aria-selected={panel.active === slot}
                    className={
                      'wb-tab' +
                      (panel.active === slot ? ' active' : '') +
                      (hint?.kind === 'tab' &&
                      hint.panelId === panel.id &&
                      hint.beforeSlot === slot
                        ? ' wb-tab-drop-before'
                        : '')
                    }
                    data-slot-tab={slot}
                    draggable
                    onDragStart={(e) => {
                      dragRef.current = { slot, fromId: panel.id };
                      e.dataTransfer.setData('text/plain', slot);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => {
                      dragRef.current = null;
                      setHint(null);
                    }}
                    onClick={() => setLayout((s) => setActive(s, panel.id, slot))}
                    title={`${labels[slot]}（拖到页签条合并，拖到面板边缘分栏）`}
                    data-testid={`wb-tab-${slot}`}
                  >
                    {labels[slot]}
                  </button>
                ))}
                {hint?.kind === 'tab' && hint.panelId === panel.id && hint.beforeSlot == null ? (
                  <span className="wb-tab-drop-end" aria-hidden="true" />
                ) : null}
                {i === 0 ? (
                  <button
                    type="button"
                    className="wb-tabs-settings"
                    title="将当前编排设为默认布局（本类所有资源打开时套用）"
                    aria-label="设为默认布局"
                    data-testid="wb-layout-default"
                    draggable={false}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={saveAsDefault}
                  >
                    <SettingsGlyph />
                  </button>
                ) : null}
              </div>
              <div className="wb-editor">
                {panel.tabs.map((slot) => (
                  <div
                    key={slot}
                    className={'wb-slot' + (slot === panel.active ? '' : ' wb-slot-hidden')}
                    data-slot={slot}
                  >
                    <CodeEditor
                      key={`${codeKey}:${slot}`}
                      label={labels[slot]}
                      headless
                      initial={initialOf(slot)}
                      readOnly={!ready}
                      onSave={onSave}
                      onChange={onChange}
                    />
                  </div>
                ))}
              </div>
              {hint?.kind === 'edge' && hint.panelId === panel.id ? (
                <div className={'wb-dz wb-dz-' + hint.side} aria-hidden="true" />
              ) : null}
            </div>
            {multi && i < layout.panels.length - 1 ? (
              <div
                className={'wb-sash wb-sash-' + axis}
                role="separator"
                aria-orientation={axis === 'row' ? 'vertical' : 'horizontal'}
                aria-label="调整编辑栏比例"
                aria-valuemin={MIN_PCT}
                aria-valuemax={100 - MIN_PCT}
                tabIndex={0}
                onPointerDown={(e) => onSashPointerDown(i, e)}
                onKeyDown={(e) => {
                  const back = axis === 'row' ? 'ArrowLeft' : 'ArrowUp';
                  const fwd = axis === 'row' ? 'ArrowRight' : 'ArrowDown';
                  let delta = 0;
                  if (e.key === back) delta = e.shiftKey ? -10 : -2;
                  else if (e.key === fwd) delta = e.shiftKey ? 10 : 2;
                  if (!delta) return;
                  e.preventDefault();
                  let acc = 0;
                  for (let k = 0; k <= i; k++) acc += layoutRef.current.sizes[k];
                  setLayout((s) => resizeAt(s, i, acc + delta));
                }}
                data-testid={`wb-sash-${i}`}
              />
            ) : null}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
