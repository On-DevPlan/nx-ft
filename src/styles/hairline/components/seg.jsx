// SegmentedControl：薄薄的类契约绑定。
// 类契约：.seg > .seg-item[.active]
// 容器贴在一起、段间无间距；selected 段填实 ink 色。
// 删掉这个文件，组件依然能用——只要消费者自己写 <div class="seg">…</div>。
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
