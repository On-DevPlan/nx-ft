// Esc 关闭 hook:模态打开时挂 keydown 监听,Esc 触发 onClose
import { useEffect } from "react";

export function useEscClose(enabled, onClose) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enabled, onClose]);
}
