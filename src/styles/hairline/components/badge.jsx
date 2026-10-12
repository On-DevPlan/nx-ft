// Badge：薄薄的类契约绑定。
// 删掉这个文件，组件依然能用——只要消费者自己写 <span class="badge">5</span>。
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
