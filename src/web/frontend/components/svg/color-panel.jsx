// SVG 编辑区「颜色」页签的模块体：在预览层实时改主题色（currentColor）、
// CSS 变量（--c-N）与遗留硬编码色。只作用于预览、不写脏源码；落地改色回 SVG 页签。
//
// 三类槽位（对三种调色原理，见 plan/18）：
//   主题色   → 预览注入 color，驱动 currentColor（SVG 原生语义）
//   变量槽   → 源码里的 <style>svg{--c-N:…}</style> 声明；预览追加覆盖样式，源码不动
//   字面量槽 → 遗留硬编码色；预览字符串替换（applySvgSlots），并提示可一键迁移为变量
import { useEffect, useMemo, useState } from 'react';
import { Btn } from '../btn/index.jsx';
import { collectHardcoded, parseVarDecls } from './color-vars.js';

const MAIN = '__main__';

// color 域取不到任何调色板时的回退色板。
const FALLBACK = [
  '#111827', '#374151', '#6B7280', '#D1D5DB', '#FFFFFF',
  '#EF4444', '#F97316', '#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899',
];

export function ColorPanel({ svg, theme, onChange, onMigrate }) {
  const [selected, setSelected] = useState(MAIN);
  const [swatches, setSwatches] = useState([]);
  const literals = useMemo(() => collectHardcoded(String(svg || '')), [svg]);
  const vars = useMemo(() => parseVarDecls(String(svg || '')), [svg]);

  // 加载 color 域全部调色板颜色（按调色板分组平铺）；失败则用 fallback。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/color/tree?search=&tags=');
        const env = await r.json();
        const tree = env.data ?? env;
        const rows = [];
        for (const g of tree.groups || []) {
          for (const a of g.assets || []) {
            const ar = await fetch(`/api/color/asset?group=${encodeURIComponent(g.path)}&name=${encodeURIComponent(a.name)}&code=1`);
            const ae = await ar.json();
            const detail = ae.data ?? ae;
            const raw = detail.code?.default?.data;
            if (!raw) continue;
            const p = JSON.parse(raw);
            for (const c of p.colors || []) if (c.hex) rows.push({ hex: c.hex, name: p.name });
          }
        }
        if (!cancelled) setSwatches(rows);
      } catch {
        /* 静默，组件用 fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentHex = (kind, key, fallback) =>
    kind === 'main' ? theme?.main
      : kind === 'var' ? theme?.vars?.[key] || fallback
      : theme?.slots?.[key] || fallback;

  const pick = (hex) => {
    if (selected === MAIN) return onChange({ ...theme, main: hex });
    const [kind, key] = selected.split(':');
    if (kind === 'var') return onChange({ ...theme, vars: { ...(theme?.vars || {}), [key]: hex } });
    onChange({ ...theme, slots: { ...(theme?.slots || {}), [key]: hex } });
  };
  const reset = () => {
    onChange({});
    setSelected(MAIN);
  };

  const allSwatches = swatches.length ? swatches : FALLBACK.map((hex) => ({ hex }));

  return (
    <div className="cp" data-testid="color-panel">
      <div className="cp__bar">
        <span className="cp__hint">
          主题色 / 变量 / 局部颜色实时预览（不改源码；落地改色回 SVG 页签）
        </span>
        {literals.length && onMigrate ? (
          <Btn size="sm" variant="secondary" onClick={onMigrate} testId="cp-migrate"
            title={`把 ${literals.length} 个硬编码颜色迁移为 CSS 变量（var(--c-N,原值)），写入编辑器待保存`}
          >
            迁移为变量（{literals.length}）
          </Btn>
        ) : null}
        <Btn size="sm" variant="secondary" onClick={reset} testId="cp-reset">
          重置
        </Btn>
      </div>
      <div className="cp__slots">
        <button
          type="button"
          className={'cp__slot' + (selected === MAIN ? ' on' : '')}
          onClick={() => setSelected(MAIN)}
          data-testid="cp-slot-main"
        >
          <span className="cp__chip" style={{ background: currentHex('main') || '#111827' }} />
          主题色
        </button>
        {vars.map((v) => (
          <button
            key={v.name}
            type="button"
            className={'cp__slot' + (selected === `var:${v.name}` ? ' on' : '')}
            onClick={() => setSelected(`var:${v.name}`)}
            title={`颜色变量（声明值 ${v.value}）`}
            data-testid={`cp-slot-${v.name}`}
          >
            <span className="cp__chip" style={{ background: currentHex('var', v.name, v.value) }} />
            <span className="mono">{v.name}</span>
          </button>
        ))}
        {literals.map((c) => (
          <button
            key={c}
            type="button"
            className={'cp__slot' + (selected === `lit:${c}` ? ' on' : '')}
            onClick={() => setSelected(`lit:${c}`)}
            title="硬编码颜色（遗留）：可在预览层临时换色，或迁移为变量"
          >
            <span className="cp__chip" style={{ background: currentHex('lit', c, c) }} />
            <span className="mono">{c}</span>
          </button>
        ))}
      </div>
      <div className="cp__swatches">
        {allSwatches.map((s, i) => (
          <button key={i} type="button" className="cp__sw" title={s.name || s.hex} onClick={() => pick(s.hex)}>
            <span style={{ background: s.hex }} />
          </button>
        ))}
      </div>
    </div>
  );
}
