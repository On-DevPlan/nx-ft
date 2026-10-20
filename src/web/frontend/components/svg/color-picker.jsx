// 取色器卡：饱和面 + 色相条 + 透明度条 + HEX/RGB/HSL 数值输入 + 和声派生色。
//
// 为什么直接引组件而不是自己画一套：拖拽 + 色相映射 + 边界吸附 + 键盘可达性
// 全要自己兜。react-colorful 是 3.1KB 的零依赖实现，自带 role="slider" 与
// 方向键操作，装上就能用（HexAlphaColorPicker 一个组件含饱和面/色相/透明度，
// 值域就是 8 位 hex）。
//
// 取色只改「当前槽位的预览替换值」，不碰源码——落地的语义在 color-panel.jsx。
import { useEffect, useMemo, useState } from 'react';
import { HexAlphaColorPicker, HexColorInput } from 'react-colorful';
import {
  canonicalHex,
  contrastInfo,
  formatAs,
  harmonyColors,
  hexToHsl,
  hexToRgb,
  HARMONY_TYPES,
  hslInputToHex,
  rgbInputToHex,
} from './color-utils.js';

const FORMATS = [
  { id: 'hex', label: 'HEX' },
  { id: 'rgb', label: 'RGB' },
  { id: 'hsl', label: 'HSL' },
];

// 数值输入：编辑期间用本地文本，失焦 / 回车才提交。
// 直接受控会在清空输入框时把「空」当成 0 提交——颜色莫名其妙跳一下。
function NumField({ label, value, min, max, step = 1, onCommit, testId }) {
  const [text, setText] = useState(String(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setText(String(value));
  }, [value, editing]);
  const commit = () => {
    setEditing(false);
    const n = Number(text);
    if (Number.isFinite(n)) onCommit(n);
    else setText(String(value));
  };
  return (
    <label className="cp-field">
      <span className="cp-field__lbl">{label}</span>
      <input
        className="cp-field__in"
        type="number"
        min={min}
        max={max}
        step={step}
        value={text}
        data-testid={testId}
        onFocus={() => setEditing(true)}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </label>
  );
}

export function ColorPicker({ value, onChange, testId = 'color-picker' }) {
  const hex = canonicalHex(value) || '#000000';
  const [format, setFormat] = useState('hex');
  const rgb = hexToRgb(hex) || { r: 0, g: 0, b: 0, a: 1 };
  const hsl = hexToHsl(hex) || { h: 0, s: 0, l: 0, a: 1 };
  const info = useMemo(() => contrastInfo(hex), [hex]);

  const commit = (next) => {
    const norm = canonicalHex(next);
    if (norm) onChange(norm);
  };

  const alpha = Math.round(rgb.a * 100);

  return (
    <div className="cp-picker" data-testid={testId}>
      <div className="cp-picker__main">
        <div className="cp-picker__wheel">
          <HexAlphaColorPicker
            color={hex}
            onChange={(v) => commit(v)}
            onChangeEnd={(v) => commit(v)}
          />
        </div>

        <div className="cp-picker__side">
          <div className="cp-picker__tabs" role="tablist" aria-label="颜色格式">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={format === f.id}
                className={'cp-picker__tab' + (format === f.id ? ' on' : '')}
                data-testid={`cp-format-${f.id}`}
                onClick={() => setFormat(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {format === 'hex' ? (
            <div className="cp-picker__fields">
              <label className="cp-field">
                <span className="cp-field__lbl">HEX</span>
                <HexColorInput
                  className="cp-field__in cp-field__in--text"
                  color={hex}
                  prefixed
                  alpha
                  spellCheck="false"
                  data-testid="cp-hex-input"
                  onChange={(v) => commit(v)}
                />
              </label>
            </div>
          ) : null}

          {format === 'rgb' ? (
            <div className="cp-picker__fields">
              <NumField label="R" value={rgb.r} min={0} max={255} testId="cp-r"
                onCommit={(n) => commit(rgbInputToHex(n, rgb.g, rgb.b, rgb.a))} />
              <NumField label="G" value={rgb.g} min={0} max={255} testId="cp-g"
                onCommit={(n) => commit(rgbInputToHex(rgb.r, n, rgb.b, rgb.a))} />
              <NumField label="B" value={rgb.b} min={0} max={255} testId="cp-b"
                onCommit={(n) => commit(rgbInputToHex(rgb.r, rgb.g, n, rgb.a))} />
            </div>
          ) : null}

          {format === 'hsl' ? (
            <div className="cp-picker__fields">
              <NumField label="H" value={Math.round(hsl.h)} min={0} max={360} testId="cp-h"
                onCommit={(n) => commit(hslInputToHex(n, hsl.s * 100, hsl.l * 100, hsl.a))} />
              <NumField label="S" value={Math.round(hsl.s * 100)} min={0} max={100} testId="cp-s"
                onCommit={(n) => commit(hslInputToHex(hsl.h, n, hsl.l * 100, hsl.a))} />
              <NumField label="L" value={Math.round(hsl.l * 100)} min={0} max={100} testId="cp-l"
                onCommit={(n) => commit(hslInputToHex(hsl.h, hsl.s * 100, n, hsl.a))} />
            </div>
          ) : null}

          <label className="cp-field cp-field--wide">
            <span className="cp-field__lbl">A</span>
            <input
              className="cp-field__range"
              type="range"
              min={0}
              max={100}
              value={alpha}
              data-testid="cp-alpha"
              onChange={(e) => commit(rgbInputToHex(rgb.r, rgb.g, rgb.b, Number(e.target.value) / 100))}
            />
            <span className="cp-field__val">{alpha}%</span>
          </label>

          {info ? (
            <div className="cp-picker__info">
              <span className="cp-picker__preview" style={{ background: hex, color: info.ink }}>
                {hex}
              </span>
              <span className="cp-picker__ratio mono">
                白底 {info.onWhite}:1 · 黑底 {info.onBlack}:1
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="cp-picker__harmony">
        <span className="cp-picker__harmony-lbl">和声</span>
        {HARMONY_TYPES.map((t) => {
          const cols = harmonyColors(hex, t.id);
          if (!cols.length) return null;
          return (
            <span key={t.id} className="cp-hm">
              <span className="cp-hm__lbl">{t.label}</span>
              {cols.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="cp-sw cp-sw--sm"
                  title={`${t.label} · ${c}（点击套到当前槽）`}
                  data-testid={`cp-harmony-${t.id}-${c}`}
                  onClick={() => commit(c)}
                >
                  <span style={{ background: c }} />
                </button>
              ))}
            </span>
          );
        })}
      </div>

      <span className="cp-picker__echo mono" aria-live="polite">
        {formatAs(hex, 'hex')} · {formatAs(hex, 'rgb')} · {formatAs(hex, 'hsl')}
      </span>
    </div>
  );
}
