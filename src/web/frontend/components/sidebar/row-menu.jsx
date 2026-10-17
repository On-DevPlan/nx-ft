// 行操作菜单：「⋯」按钮与行右键共用的弹出菜单。
// 通用层只管「怎么弹、怎么关」；菜单里有什么（打开 / 重命名 / 删除…）由调用方
// 通过 items 给出——[{ label, icon?, danger?, run }]，run 在点击时执行（闭包里带原节点）；
// 项写成 { sep: true } 时渲染为分组分隔线（不可点）。
// 弹层本体由 Sidebar 统一渲染一份（行上不各自挂浮层）。
import { useEffect, useLayoutEffect, useRef } from 'react';

export function RowMenu({ items, at, onClose }) {
  const ref = useRef(null);
  // 先按调用点给的光标 / 行下沿坐标落点，等首帧量到自身尺寸后把越界的一侧收回来
  //（点在屏幕右缘 / 底缘时菜单不能飞出去）。
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = at.x ?? 0;
    const y = at.y ?? 0;
    el.style.left = Math.max(8, Math.min(x, window.innerWidth - r.width - 8)) + 'px';
    el.style.top =
      Math.max(8, y + r.height > window.innerHeight - 8 ? y - r.height - 4 : y) + 'px';
  }, [at]);
  // 点外面 / Escape 关。mousedown 而非 click：免得「点开菜单的那次点击」冒泡上来立刻关掉。
  useEffect(() => {
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  return (
    <div
      className="gmenu"
      role="menu"
      ref={ref}
      style={{ left: at.x ?? 0, top: at.y ?? 0 }}
      // 菜单上右键不应再叠一层菜单
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it, i) =>
        it.sep ? (
          <div key={i} role="separator" className="gmenu-sep" />
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            className={'gmenu-item' + (it.danger ? ' danger' : '')}
            onClick={() => {
              onClose();
              it.run();
            }}
          >
            {it.icon ? <span className="gmenu-ico">{it.icon}</span> : null}
            {it.label}
          </button>
        ),
      )}
    </div>
  );
}
