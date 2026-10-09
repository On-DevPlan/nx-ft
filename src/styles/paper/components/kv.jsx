// Kv：定义列表（key/value 对）。
//
// 样式见 styles/<pack>/kv.css——这里只负责结构。
// 用 <dl>/<div>/<dt>/<dd> 语义标签，浏览器读屏与复制粘贴都能识别。
import * as React from 'react';

export function Kv({ items, className, ...rest }) {
  return (
    <dl className={['kv', className].filter(Boolean).join(' ')} {...rest}>
      {items.map(({ key, value }, i) => (
        <div className="kv-row" key={i}>
          <dt>{key}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default Kv;
