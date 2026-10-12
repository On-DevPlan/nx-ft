// SegmentedControl：薄薄的类契约绑定（sectioned 风格）。
import * as React from 'react';

const SIZES = new Set(['', 'small']);

export function SegmentedControl({ options = [], value, onChange, size = '', className, ...rest }) {
  const s = SIZES.has(size) ? size : '';
  const cls = ['seg', s && `seg ${s}`, className].filter(Boolean).join(' ');
  return (
    <div className={cls} role="tablist" {...rest}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            className={'seg-item' + (s ? ' ' + s : '') + (active ? ' active' : '')}
            role="tab"
            aria-selected={active}
            onClick={() => onChange && onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
