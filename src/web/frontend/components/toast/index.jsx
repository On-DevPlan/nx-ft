// 全局轻提示：边框主义（淡底 + 主色描边），按语义分 ok / bad / warn。
//
// 用法（任一）：
//   const toast = useToast();
//   toast('已保存');                 // 默认 ok
//   toast('先选一个风格', 'warn');
//   toast('复制失败', 'bad');
//   toast.ok('…'); toast.warn('…'); toast.bad('…');
//
// 别名：success→ok，error/err/fail→bad，warning→warn（见 tone.js）。
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { normalizeTone } from './tone.js';

export { normalizeTone } from './tone.js';

/** 单条提示（也可单独渲染；栈由 ToastProvider 管） */
export function Toast({ tone = 'ok', children, className = '' }) {
  const t = normalizeTone(tone);
  return (
    <div
      className={'toast toast-' + t + (className ? ' ' + className : '')}
      role="status"
      data-tone={t}
    >
      {children}
    </div>
  );
}

const ToastCtx = createContext(null);

function attachHelpers(push) {
  const toast = (msg, tone = 'ok') => push(String(msg ?? ''), normalizeTone(tone));
  toast.ok = (msg) => toast(msg, 'ok');
  toast.bad = (msg) => toast(msg, 'bad');
  toast.warn = (msg) => toast(msg, 'warn');
  return toast;
}

export function ToastProvider({ children }) {
  const [msgs, setMsgs] = useState([]);
  const idRef = useRef(0);

  const push = useCallback((msg, tone) => {
    const id = ++idRef.current;
    setMsgs((m) => [...m, { id, msg, tone }]);
    setTimeout(() => setMsgs((m) => m.filter((x) => x.id !== id)), 2800);
  }, []);

  const toast = useMemo(() => attachHelpers(push), [push]);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-relevant="additions">
        {msgs.map((m) => (
          <Toast key={m.id} tone={m.tone}>
            {m.msg}
          </Toast>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx) || attachHelpers((msg) => console.log(msg));
}
