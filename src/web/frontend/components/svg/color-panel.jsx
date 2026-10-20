// SVG 编辑区「颜色」页签的模块体：在预览层实时改主题色（currentColor）、
// CSS 变量（--c-N）与遗留硬编码色。只作用于预览、不写脏源码；落地改色回 SVG 页签。
//
// 三类槽位（对三种调色原理，见 plan/18）：
//   主题色   → 预览注入 color，驱动 currentColor（SVG 原生语义）
//   变量槽   → 源码里的 <style>svg{--c-N:…}</style> 声明；预览追加覆盖样式，源码不动
//   字面量槽 → 遗留硬编码色；预览字符串替换（applySvgSlots），并提示可一键迁移为变量
//
// 面板结构（plan/19）：槽位（改哪个）→ 取色器（改成什么）→ 色板（现成的色）。
// 取色器直接引 react-colorful 的 HexAlphaColorPicker（饱和面 + 色相 + 透明度），
// 数值输入支持 HEX / RGB / HSL 三种口径，还能从当前色派生和声配色。
import { useEffect, useMemo, useState } from 'react';
import { Btn } from '../btn/index.jsx';
import { collectHardcoded, isValidVarName, parseVarDecls } from './color-vars.js';
import { ColorPicker } from './color-picker.jsx';
import { SlotChips, SwatchBoard } from './color-parts.jsx';
import { loadPalettes } from './color-palette-api.js';
import { canonicalHex, loadRecent, pushRecent, saveRecent } from './color-utils.js';

const MAIN = '__main__';

// color 域取不到任何调色板时的回退色板（保证没有调色板也能调色）。
const FALLBACK = [
  '#111827', '#374151', '#6B7280', '#D1D5DB', '#FFFFFF',
  '#EF4444', '#F97316', '#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899',
];

export function ColorPanel({ svg, theme, onChange, onMigrate, onRenameVar }) {
  const [selected, setSelected] = useState(MAIN);
  const [palettes, setPalettes] = useState([]);
  const [recent, setRecent] = useState(() => loadRecent());
  // 变量改名：输入草稿 + 校验提示（改名要写回源码，不是纯预览动作）
  const [varDraft, setVarDraft] = useState('');
  const [varErr, setVarErr] = useState('');
  const literals = useMemo(() => collectHardcoded(String(svg || '')), [svg]);
  const vars = useMemo(() => parseVarDecls(String(svg || '')), [svg]);

  // 加载 color 域全部调色板（按调色板分组，不再平铺成一片）。
  useEffect(() => {
    let cancelled = false;
    loadPalettes()
      .then((rows) => {
        if (!cancelled) setPalettes(rows);
      })
      .catch(() => {
        /* 静默：面板用基础色板兜底 */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 槽位表：主题色 + 变量声明 + 遗留字面量。
  // value 是「当前生效色」（覆盖值优先，否则回落到声明值 / 字面量本身）。
  // label 是它在 SVG 里的**对应名称**：主题色对应 currentColor（SVG 原生语义），
  // 变量槽对应变量名本身——一眼能看出「这个色到底叫什么」。
  const slots = useMemo(() => {
    const out = [
      {
        id: MAIN,
        kind: 'main',
        label: 'currentColor',
        name: 'currentColor',
        value: theme?.main || '',
        overridden: !!theme?.main,
        testId: 'cp-slot-main',
        hint: '主题色 · currentColor（预览注入 color，驱动 SVG 原生语义）',
      },
    ];
    for (const v of vars) {
      out.push({
        id: `var:${v.name}`,
        kind: 'var',
        label: v.name,
        name: v.name,
        value: theme?.vars?.[v.name] || v.value,
        overridden: !!theme?.vars?.[v.name],
        testId: `cp-slot-${v.name}`,
        hint: `CSS 变量 ${v.name}（声明值 ${v.value}）`,
      });
    }
    for (const c of literals) {
      out.push({
        id: `lit:${c}`,
        kind: 'lit',
        label: c,
        name: c,
        value: theme?.slots?.[c] || c,
        overridden: !!theme?.slots?.[c],
        testId: `cp-slot-lit-${c}`,
        hint: `硬编码颜色 ${c}（遗留）`,
      });
    }
    return out;
  }, [vars, literals, theme]);

  const current = slots.find((s) => s.id === selected) || slots[0];
  const currentVar = current?.kind === 'var' ? current.name : '';

  // 选中槽变了 → 改名草稿同步成当前变量名
  useEffect(() => {
    setVarDraft(currentVar);
    setVarErr('');
  }, [currentVar]);

  // 取色：写回当前槽的预览替换值，并记一笔最近使用。
  const pick = (hex) => {
    const norm = canonicalHex(hex);
    if (!norm) return;
    setRecent((r) => {
      const next = pushRecent(r, norm);
      saveRecent(next);
      return next;
    });
    if (selected === MAIN) return onChange({ ...theme, main: norm });
    const [kind, key] = selected.split(':');
    if (kind === 'var') return onChange({ ...theme, vars: { ...(theme?.vars || {}), [key]: norm } });
    onChange({ ...theme, slots: { ...(theme?.slots || {}), [key]: norm } });
  };

  // 把所有遗留字面量统一成当前色（预览层）——单色图标一键换色的常用路径。
  const unifyLiterals = () => {
    const hex = canonicalHex(current?.value);
    if (!hex || !literals.length) return;
    const slotsMap = {};
    for (const c of literals) slotsMap[c] = hex;
    onChange({ ...theme, slots: { ...(theme?.slots || {}), ...slotsMap } });
  };

  // 变量改名：写回源码（声明与 var() 用法一起改），预览层的覆盖值跟着改名迁移。
  // 不迁覆盖值的话，改名后这个槽的调色就「丢」了——键换了，值还挂在旧键上。
  const renameSelectedVar = () => {
    const from = currentVar;
    const to = varDraft.trim();
    if (!to || to === from) {
      setVarErr('');
      return;
    }
    if (!isValidVarName(to)) {
      setVarErr('变量名不合法：-- 开头，字母或下划线起');
      return;
    }
    if (slots.some((s) => s.kind === 'var' && s.name === to)) {
      setVarErr(`已有同名变量 ${to}`);
      return;
    }
    if (!onRenameVar) return;
    onRenameVar(from, to);
    const varsMap = { ...(theme?.vars || {}) };
    if (varsMap[from]) {
      varsMap[to] = varsMap[from];
      delete varsMap[from];
      onChange({ ...theme, vars: varsMap });
    }
    setSelected(`var:${to}`);
    setVarErr('');
  };

  const reset = () => {
    onChange({});
    setSelected(MAIN);
  };

  const board = palettes.length
    ? palettes
    : [{ id: '__fallback__', name: '基础色板', group: '内置', colors: FALLBACK.map((hex) => ({ hex })) }];

  return (
    <div className="cp" data-testid="color-panel">
      <div className="cp__bar">
        <span className="cp__hint">
          主题色 / 变量 / 局部颜色实时预览（不改源码；落地改色回 SVG 页签）
        </span>
        {literals.length > 1 ? (
          <Btn
            size="sm"
            variant="secondary"
            onClick={unifyLiterals}
            testId="cp-unify"
            title="把所有硬编码颜色统一成当前槽的颜色（只作用于预览层）"
          >
            统一字面量
          </Btn>
        ) : null}
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

      <div className="cp__scroll">
        <SlotChips slots={slots} selected={selected} onSelect={setSelected} />

        {currentVar ? (
          <div className="cp-rename" data-testid="cp-rename">
            <span className="cp-rename__lbl">变量名</span>
            <input
              className="cp-rename__in"
              value={varDraft}
              spellCheck="false"
              aria-label="自定义变量名"
              data-testid="cp-var-name"
              onChange={(e) => {
                setVarDraft(e.target.value);
                setVarErr('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') renameSelectedVar();
              }}
            />
            <Btn size="sm" variant="secondary" onClick={renameSelectedVar} testId="cp-var-rename">
              改名
            </Btn>
            <span className={'cp-rename__hint' + (varErr ? ' cp-rename__hint--bad' : '')}>
              {varErr || '改名会写回源码（声明与 var() 用法一起改，保存后生效）'}
            </span>
          </div>
        ) : null}

        <ColorPicker
          value={current?.value}
          onChange={pick}
          testId="cp-picker"
        />

        <SwatchBoard
          palettes={board}
          recent={recent}
          onPick={pick}
          onClearRecent={() => {
            setRecent([]);
            saveRecent([]);
          }}
        />
      </div>
    </div>
  );
}
