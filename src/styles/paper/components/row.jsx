// Row：三段式水平行（name | desc | acts）。
//
// 样式见 styles/<pack>/row.css——这里只负责把 props 落到正确的 .name/.desc/.acts 子元素。
// 同样没有「行要不要展开」的二态切换：CSS 用 flex 自适应，描边用 1px var(--border)。
import * as React from 'react';

export function Row({ name, desc, actions, className, ...rest }) {
  return (
    <div className={['row', className].filter(Boolean).join(' ')} {...rest}>
      <div className="name">{name}</div>
      {desc != null && <div className="desc">{desc}</div>}
      {actions != null && <div className="acts">{actions}</div>}
    </div>
  );
}

export default Row;
