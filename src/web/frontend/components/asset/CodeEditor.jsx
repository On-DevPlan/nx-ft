// 轻量代码编辑框：textarea + 行号槽 + 语法着色 + Tab 缩进 + Ctrl/Cmd+S 保存 + 折叠。
//
// 非受控（defaultValue）：受控写法会在每次按键后重设 DOM 值，
// 把浏览器原生的撤销历史清空——用户按 Ctrl+Z 想撤销刚才的输入却什么都没了。
// 代码内容由父组件从 DOM 读（工作台读 .code-area 的 value）。
//
// 着色用「叠加层」而不是换编辑器内核：textarea 仍是唯一收输入的地方（撤销栈、
// Tab 缩进、Ctrl+S、行号、外面读 value 的契约全不变），只在它下面垫一层 <pre>，
// 画着色好的**同一份文本**，再把 textarea 的文字设为透明、只留光标与选区。
// 代价是两层必须逐字符重合——排版属性在样式里用同一个选择器一起下发（见
// styles/asset-workbench.css 的 .code-area/.code-hl），不许各写一份。
//
// headless：不渲染顶部那条 label + 折叠栏。给「文件身份已由外部页签表达」的场景用
// （工作台的 HTML/CSS/JS 页签已经在说「这是哪个文件」了，再顶一条就重复了）。
import { useEffect, useMemo, useRef, useState } from 'react';
import { tokenize } from './highlight/index.js';

const INDENT = '  ';

export function CodeEditor({
  label,
  lang,
  initial,
  readOnly,
  rows = 8,
  collapsed,
  headless = false,
  onSave,
  onChange,
}) {
  const taRef = useRef(null);
  const gutterRef = useRef(null);
  const hlRef = useRef(null);
  const [lines, setLines] = useState(1);
  const [closed, setClosed] = useState(!!collapsed);
  // 着色层的文本镜像。textarea 仍是非受控的（DOM 里的 value 才是真相），
  // 这份 state 只喂给 <pre>，React 从不用它回写输入框。
  const [text, setText] = useState('');
  // headless 时没有折叠入口，永远展开（state 仍照常声明，别让 hooks 顺序变化）
  const isClosed = !headless && closed;
  // 语言默认由 label 推（'HTML'→'html' / 'SVG'→'svg'），调用方不用逐个传
  const syntax = lang || String(label || '').toLowerCase();
  // 栏宽拖动降载：body.wb-sash-drag .code-hl（见 code-workbench.css），本组件无需挂钩

  useEffect(() => {
    const v = String(initial ?? '');
    const ta = taRef.current;
    // 已与 DOM 一致时不写 ta.value——避免外层改 initial（分栏种子等）误清撤销栈
    if (ta && ta.value === v) {
      setLines(Math.max(1, v.split('\n').length));
      setText(v);
      return;
    }
    setLines(Math.max(1, v.split('\n').length));
    setText(v);
    if (ta) ta.value = v;
  }, [initial]);

  // 行号槽与着色层都跟着输入框滚。着色层是 overflow:hidden 的绝对定位层，
  // 程序化写 scrollTop/scrollLeft 照样生效。
  const syncScroll = () => {
    const ta = taRef.current;
    if (!ta) return;
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
    if (hlRef.current) {
      hlRef.current.scrollTop = ta.scrollTop;
      hlRef.current.scrollLeft = ta.scrollLeft;
    }
  };

  // 重切词只在文本变化时发生（每次按键一次）。资源都是几 KB 量级，代价可忽略。
  const tokens = useMemo(() => tokenize(text, syntax), [text, syntax]);

  const setLinesFrom = (v) => setLines(Math.max(1, v.split('\n').length));

  const onKeyDown = (e) => {
    const ta = e.currentTarget;
    if (e.key === 'Tab') {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: en, value: v } = ta;
      const next = v.slice(0, s) + INDENT + v.slice(en);
      ta.value = next;
      ta.setSelectionRange(s + INDENT.length, s + INDENT.length);
      setLinesFrom(next);
      setText(next);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      onSave && onSave();
    }
  };

  return (
    <div
      className={'code-pane' + (isClosed ? ' collapsed' : '') + (headless ? ' headless' : '')}
      data-testid={`code-pane-${label.toLowerCase()}`}
    >
      {headless ? null : (
        <button className="code-pane-head" onClick={() => setClosed((c) => !c)} title="折叠/展开">
          <span className="code-pane-label">{label}</span>
          <span className="code-pane-tools">
            {readOnly ? <span className="tag">未启用</span> : <span className="code-pane-caret">{closed ? '展开' : '收起'}</span>}
          </span>
        </button>
      )}
      <div className="code-pane-body">
        <div className="code-gutter" ref={gutterRef} aria-hidden="true">
          {Array.from({ length: lines }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <div className="code-edit">
          {/* 只看不摸：aria-hidden 免得读屏把同一段代码念两遍，pointer-events 交给下面的输入框 */}
          <pre className="code-hl" ref={hlRef} aria-hidden="true">
            {tokens.map((tk, i) => (
              <span key={i} className={tk.type ? 'tok-' + tk.type : undefined}>
                {tk.text}
              </span>
            ))}
          </pre>
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
              setLinesFrom(e.target.value);
              setText(e.target.value);
              onChange && onChange();
            }}
            placeholder={readOnly ? '' : '在这里写 ' + label + '（Tab 缩进，Ctrl+S 保存）'}
            aria-label={`${label} 编辑器`}
            data-testid={`code-area-${label.toLowerCase()}`}
          />
        </div>
      </div>
    </div>
  );
}
