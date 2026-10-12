// Badge：薄薄的类契约绑定（boxed 风格）。
import * as React from 'react';

const VARIANTS = new Set(['', 'danger']);

export function Badge({ count, max = 99, dot = false, variant = '', className, ...rest }) {
  const v = VARIANTS.has(variant) ? variant : '';
  const cls = ['badge', dot && 'dot', v && v, className].filter(Boolean).join(' ');
  let display = count;
  if (!dot && typeof count === 'number' && count > max) display = `${max}+`;
  if (dot) {
    return <span className={cls} aria-label="通知" {...rest} />;
  }
  return (
    <span className={cls} {...rest}>
      {display}
    </span>
  );
}

export default Badge;
