// Button：薄薄的类契约绑定。
//
// 设计意图：所有「怎么长得像 .btn」的逻辑都在 styles/<pack>/btn.css 里。
// 这个组件只负责把 props 翻译成正确的 className 与原生属性。
// 删掉这个文件，组件依然能用——只要消费者自己写 <button class="btn">。
import * as React from 'react';

const VARIANTS = new Set(['', 'ghost', 'danger']);
const SIZES = new Set(['', 'small']);

export function Button({ variant = '', size = '', disabled, className, as, children, ...rest }) {
  // 白名单防御：variant/size 拼写错误不静默吞下，传错就让它落到默认
  const v = VARIANTS.has(variant) ? variant : '';
  const s = SIZES.has(size) ? size : '';
  const cls = [
    'btn',
    v && v !== '' ? `btn ${v}` : '',
    s && s !== '' ? `btn ${s}` : '',
    className,
  ].filter(Boolean).join(' ');
  const Tag = as || 'button';
  return (
    <Tag className={cls} disabled={disabled} {...rest}>
      {children}
    </Tag>
  );
}

export default Button;
