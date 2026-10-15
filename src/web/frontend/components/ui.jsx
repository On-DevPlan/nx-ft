// 通用 UI 件：对话框、弹窗、错误边界、diff 渲染；toast 见 ./toast（此处再导出，旧 import 不断）。
// 约定延续自 vanilla 版：无 emoji、不用浏览器原生弹窗（alert/confirm/prompt 一律页内实现）。
import { Component, createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Btn } from './btn/index.jsx';
import { useToast } from './toast/index.jsx';

export { Toast, ToastProvider, useToast, normalizeTone } from './toast/index.jsx';

// 操作守卫：包一层，失败自动 toast.bad（对应 vanilla 版的 guard()）
export function useGuard() {
  const toast = useToast();
  return useCallback(async (fn) => {
    try { return await fn(); } catch (e) { toast.bad(String((e && e.message) || e)); }
  }, [toast]);
}

// ---- 点击即复制：所有路径/长标识的展示标准 ----
// 点一下复制全文；hover 显示「点击复制」提示；复制成功 toast 确认。
//
// `btn` 为 true 时把元素升级为按钮族 Btn（替代原本的「`.btn` 类套在 span 上」——
// 那种写法在统一按钮族之后属于违规：它长得像按钮但不是 Btn 组件、不是原生按钮）。
// 文字型（detail-parts.jsx 那两处代码块）保持 span 不动。
export function Copyable({ text, className = '', title, btn, size = 'sm', variant = 'secondary', children, ...rest }) {
  const toast = useToast();
  const copy = async () => {
    const v = String(text ?? '');
    const ok = () => toast.ok('已复制: ' + (v.length > 60 ? v.slice(0, 57) + '...' : v));
    try {
      await navigator.clipboard.writeText(v);
      ok();
    } catch {
      // 剪贴板 API 不可用（非安全上下文等）：退回 execCommand
      try {
        const ta = document.createElement('textarea');
        ta.value = v;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        ok();
      } catch {
        toast.bad('复制失败（剪贴板不可用）');
      }
    }
  };
  if (btn) {
    return (
      <Btn size={size} variant={variant} className={className} title={title || '点击复制'} onClick={copy} {...rest}>
        {children !== undefined ? children : text}
      </Btn>
    );
  }
  return (
    <span
      className={'copyable' + (className ? ' ' + className : '')}
      title={title || '点击复制'}
      onClick={copy}
    >{children !== undefined ? children : text}</span>
  );
}

// ---- 对话框：确认 / 输入（Promise 风格，对应 vanilla 版 dialog()） ----

export function useDialog() {
  const [state, setState] = useState(null); // {resolve, ...opts}
  // 用 ref 读输入框，而不是 document.querySelector('.dlg-input')——
  // 后者绕开 React 直接摸 DOM，页面上有第二个同名类名时就会读错。
  const inputRef = useRef(null);

  const close = useCallback((val) => {
    setState((s) => { if (s && s.resolve) s.resolve(val); return null; });
  }, []);

  const dialog = useCallback((opts = {}) => new Promise((resolve) => {
    setState({ ...opts, resolve });
  }), []);

  const node = state ? (
    <div className="dlg" onMouseDown={(e) => { if (e.target === e.currentTarget) close(null); }}>
      <div className="dlg-box">
        {state.title ? <div className="dlg-title">{state.title}</div> : null}
        {state.message ? <div className="dlg-msg">{state.message}</div> : null}
        {state.input ? (
          <input
            ref={inputRef}
            className="dlg-input"
            autoFocus
            spellCheck="false"
            placeholder={state.placeholder || ''}
            defaultValue={state.value || ''}
            onKeyDown={(e) => {
              if (e.key === 'Enter') close(e.currentTarget.value.trim());
              if (e.key === 'Escape') close(null);
            }}
          />
        ) : null}
        <div className="dlg-acts">
          <Btn variant="secondary" onClick={() => close(null)}>取消</Btn>
          <Btn
            variant={state.danger ? 'danger' : 'secondary'}
            onClick={() => close(state.input ? (inputRef.current?.value.trim() ?? null) : true)}
          >
            {state.okText || '确定'}
          </Btn>
        </div>
      </div>
    </div>
  ) : null;

  return { dialog, node };
}

// ---- 错误边界：把崩溃限制在单个视图内 ----
// 视图都是 lazy() 加载的，没有这层兜底时，任何一个视图抛错（或 chunk 加载失败）
// 都会让整个面板白屏，用户连切到别的 tab 自救都做不到。

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[nx-ft] 视图渲染失败:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card" style={{ padding: 16 }}>
        <div className="colhead"><h3>这个面板出错了</h3></div>
        <div className="dlg-msg">{String(this.state.error?.message || this.state.error)}</div>
        <div className="muted" style={{ marginBottom: 10 }}>
          其他面板不受影响，可以切到别的 tab 继续操作；控制台有完整堆栈。
        </div>
        <Btn onClick={() => this.setState({ error: null })}>重试</Btn>
      </div>
    );
  }
}

// ---- 弹窗：大块内容（diff / 冲突详情 / 命令输出） ----

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box">
        <div className="modal-title">
          <span>{title}</span>
          <Btn size="sm" variant="secondary" onClick={onClose}>关闭</Btn>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// ---- diff 文本渲染（+/- 行着色） ----

export function DiffPre({ text }) {
  const lines = String(text ?? '').split('\n');
  return (
    <pre>
      {lines.map((line, i) => (
        <span key={i} className={
          line.startsWith('+') && !line.startsWith('+++') ? 'd-add'
            : line.startsWith('-') && !line.startsWith('---') ? 'd-del' : ''
        }>
          {line}{i < lines.length - 1 ? '\n' : ''}
        </span>
      ))}
    </pre>
  );
}
