// Card：标题 + 内容 + 可选操作槽。
//
// CSS 契约：.card 是边框圈出的版心；.colhead 是头部行（横排标题 + 操作）；
// .card-body 是内容区。.colhead 走 styles/<pack>/colhead.css，
// .card 走 card.css——这里只负责结构。
import * as React from 'react';

export function Card({ title, actions, children, className, ...rest }) {
  const hasHeader = title != null || actions != null;
  return (
    <div className={['card', className].filter(Boolean).join(' ')} {...rest}>
      {hasHeader && (
        <div className="colhead">
          {title != null && <span>{title}</span>}
          {actions != null && <span className="card-actions">{actions}</span>}
        </div>
      )}
      <div className="card-body">{children}</div>
    </div>
  );
}

export default Card;
