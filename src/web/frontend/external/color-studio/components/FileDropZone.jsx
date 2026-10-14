// 原 ve 的 SharedMount / FileDropZone 是 Vue 跨框架组件 — nx-ft 端没有
// 跨框架桥。改用纯 React 的 <input type=file> + 拖拽区。

import { useState, useRef, useCallback } from 'react';

export function FileDropZone({ accept, multiple = false, onSelect, children, label = '拖拽文件到此 或 点击选择' }) {
  const inputRef = useRef(null);
  const [hover, setHover] = useState(false);

  const handleFiles = useCallback((fileList) => {
    if (!fileList || !fileList.length) return;
    const files = Array.from(fileList);
    onSelect?.(multiple ? files : files[0]);
  }, [onSelect, multiple]);

  const onDrop = (e) => {
    e.preventDefault();
    setHover(false);
    handleFiles(e.dataTransfer?.files);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
      onDragOver={(e) => { e.preventDefault(); setHover(true); }}
      onDragLeave={() => setHover(false)}
      onDrop={onDrop}
      style={{
        border: `2px dashed ${hover ? 'var(--sl-color-primary, #2563eb)' : 'var(--sl-color-border, #e5e7eb)'}`,
        borderRadius: 8,
        padding: 24,
        textAlign: 'center',
        cursor: 'pointer',
        background: hover ? 'var(--sl-color-surface-alt, #f3f4f6)' : 'transparent',
        color: 'var(--sl-color-text-secondary, #6b7280)',
        font: '13px/1.4 var(--sl-font-family, system-ui)',
        transition: 'background .15s, border-color .15s',
      }}
    >
      {children || <div>{label}<br/><span style={{ fontSize: 11, opacity: .7 }}>{accept || '*/*'}</span></div>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        style={{ display: 'none' }}
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
      />
    </div>
  );
}

export default FileDropZone;
