// 颜色面板的呈现件：槽位胶囊（改哪个槽）+ 色板区（现成的色，分组 + 搜索 +
// 最近使用）。纯展示，不持有业务状态（搜索词是纯 UI 状态，留在本文件里）。
import { useMemo, useState } from 'react';
import { Btn } from '../btn/index.jsx';

// ---- 槽位胶囊 ----
// slots: [{ id, kind, label, value, overridden }]——「改哪个槽」的选择器。
export function SlotChips({ slots, selected, onSelect }) {
  return (
    <div className="cp__slots" data-testid="cp-slots">
      {slots.map((s) => (
        <button
          key={s.id}
          type="button"
          className={'cp__slot' + (selected === s.id ? ' on' : '') + (s.overridden ? ' over' : '')}
          onClick={() => onSelect(s.id)}
          title={`${s.hint || s.label}｜当前 ${s.value || '未设置'}${s.overridden ? '（已覆盖）' : ''}`}
          data-testid={s.testId || `cp-slot-${s.id}`}
        >
          <span className="cp__chip" style={{ background: s.value || 'var(--soft-2)' }} />
          <span className="mono">{s.label}</span>
        </button>
      ))}
    </div>
  );
}

// ---- 色板区 ----
// palettes: [{ id, name, group, colors: [{hex, note}] }]——按调色板分组，不平铺。
export function SwatchBoard({ palettes, recent, onPick, onClearRecent }) {
  const [q, setQ] = useState('');
  const keyword = q.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!keyword) return palettes;
    return palettes
      .map((p) => {
        // 调色板名命中 → 整组留下；否则只留 hex / 备注命中的颜色。
        if (p.name.toLowerCase().includes(keyword)) return p;
        const colors = p.colors.filter(
          (c) => c.hex.toLowerCase().includes(keyword) || String(c.note || '').toLowerCase().includes(keyword)
        );
        return colors.length ? { ...p, colors } : null;
      })
      .filter(Boolean);
  }, [palettes, keyword]);

  return (
    <div className="cp-swatches" data-testid="cp-swatches">
      <div className="cp-swatches__bar">
        <input
          className="cp-swatches__search"
          type="search"
          value={q}
          placeholder="按调色板名 / 色值搜索"
          aria-label="搜索调色板或色值"
          data-testid="cp-palette-search"
          onChange={(e) => setQ(e.target.value)}
        />
        {recent.length ? (
          <Btn size="sm" variant="secondary" onClick={onClearRecent} testId="cp-clear-recent">
            清空最近
          </Btn>
        ) : null}
      </div>

      {recent.length ? (
        <section className="cp-group">
          <div className="cp-group__head">
            <span className="cp-group__name">最近使用</span>
            <span className="cp-group__count mono">{recent.length}</span>
          </div>
          <div className="cp-group__row">
            {recent.map((hex) => (
              <button
                key={hex}
                type="button"
                className="cp-sw"
                title={`${hex}（最近使用）`}
                data-testid={`cp-recent-${hex}`}
                onClick={() => onPick(hex)}
              >
                <span style={{ background: hex }} />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {filtered.map((p) => (
        <section key={p.id} className="cp-group">
          <div className="cp-group__head">
            <span className="cp-group__name">{p.name}</span>
            <span className="cp-group__path mono">{p.group}</span>
            <span className="cp-group__count mono">{p.colors.length}</span>
          </div>
          <div className="cp-group__row">
            {p.colors.map((c) => (
              <button
                key={c.hex}
                type="button"
                className="cp-sw"
                title={`${c.hex}${c.note ? ' · ' + c.note : ''}`}
                data-testid={`cp-sw-${c.hex}`}
                onClick={() => onPick(c.hex)}
              >
                <span style={{ background: c.hex }} />
              </button>
            ))}
          </div>
        </section>
      ))}

      {filtered.length ? null : (
        <p className="cp-empty">
          {palettes.length ? '没有匹配的调色板或色值' : 'color 域还没有调色板（先在色彩工作台建一个）'}
        </p>
      )}
    </div>
  );
}
