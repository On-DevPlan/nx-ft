// EmptyState：薄薄的类契约绑定（sectioned 风格）。
import * as React from 'react';

export function EmptyState({ title, description, icon, action, className, ...rest }) {
  const cls = ['empty-state', className].filter(Boolean).join(' ');
  return (
    <div className={cls} {...rest}>
      {icon && <div className="empty-icon">{icon}</div>}
      <div className="empty-title">{title}</div>
      {description && <div className="empty-desc">{description}</div>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

export default EmptyState;
