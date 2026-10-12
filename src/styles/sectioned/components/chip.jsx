// Chip：薄薄的类契约绑定（sectioned 风格）。
import * as React from 'react';

const SIZES = new Set(['', 'small']);

export function Chip({ label, onClick, onRemove, selected = false, icon, size = '', className, ...rest }) {
  const s = SIZES.has(size) ? size : '';
  const removable = typeof onRemove === 'function';
  const cls = [
    'chip',
    selected && 'selected',
    removable && 'removable',
    s && s,
    className,
  ].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      aria-pressed={selected}
      {...rest}
    >
      {icon && <span className="chip-icon">{icon}</span>}
      <span className="chip-label">{label}</span>
      {removable && (
        <span
          className="chip-x"
          role="button"
          aria-label="移除"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          ×
        </span>
      )}
    </button>
  );
}

export default Chip;
