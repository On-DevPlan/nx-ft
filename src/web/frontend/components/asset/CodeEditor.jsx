// 轻量代码编辑框：textarea + 行号槽 + Tab 缩进 + Ctrl/Cmd+S 保存 + 折叠。
//
// 非受控（defaultValue）：受控写法会在每次按键后重设 DOM 值，
// 把浏览器原生的撤销历史清空——用户按 Ctrl+Z 想撤销刚才的输入却什么都没了。
// 代码内容由父组件通过 ref.getCode() 读取（保存/预览时取一次即可）。
import { useEffect, useRef, useState } from 'react';

const INDENT = '  ';

export function CodeEditor({ label, initial, readOnly, rows = 8, collapsed, onSave, onChange }) {
  const taRef = useRef(null);
  const gutterRef = useRef(null);
  const [lines, setLines] = useState(1);
  const [closed, setClosed] = useState(!!collapsed);

  useEffect(() => {
    const v = String(initial ?? '');
    setLines(Math.max(1, v.split('\n').length));
    const ta = taRef.current;
    if (ta) ta.value = v;
  }, [initial]);

  const syncScroll = () => {
    if (gutterRef.current && taRef.current) gutterRef.current.scrollTop = taRef.current.scrollTop;
  };

  const onKeyDown = (e) => {
    const ta = e.currentTarget;
    if (e.key === 'Tab') {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: en, value: v } = ta;
      const next = v.slice(0, s) + INDENT + v.slice(en);
      ta.value = next;
      ta.setSelectionRange(s + INDENT.length, s + INDENT.length);
      setLines(Math.max(1, next.split('\n').length));
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      onSave && onSave();
    }
  };

  return (
    <div className={'code-pane' + (closed ? ' collapsed' : '')} data-testid={`code-pane-${label.toLowerCase()}`}>
      <button className="code-pane-head" onClick={() => setClosed((c) => !c)} title="折叠/展开">
        <span className="code-pane-label">{label}</span>
        <span className="code-pane-tools">
          {readOnly ? <span className="tag">未启用</span> : <span className="code-pane-caret">{closed ? '展开' : '收起'}</span>}
        </span>
      </button>
      <div className="code-pane-body">
        <div className="code-gutter" ref={gutterRef} aria-hidden="true">
          {Array.from({ length: lines }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <textarea
          ref={taRef}
          className="code-area"
          spellCheck="false"
          wrap="off"
          rows={rows}
          readOnly={readOnly}
          defaultValue={initial ?? ''}
          onScroll={syncScroll}
          onKeyDown={onKeyDown}
          onChange={(e) => {
            setLines(Math.max(1, e.target.value.split('\n').length));
            onChange && onChange();
          }}
          placeholder={readOnly ? '' : '在这里写 ' + label + '（Tab 缩进，Ctrl+S 保存）'}
          aria-label={`${label} 编辑器`}
          data-testid={`code-area-${label.toLowerCase()}`}
        />
      </div>
    </div>
  );
}
