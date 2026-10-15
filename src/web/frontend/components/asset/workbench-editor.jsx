// 兼容出口：多栏编辑器本体在 components/code-workbench。
// 工作台仍传 asset/styleKey，这里收成通用的 code/codeKey。
import { MultiPaneEditor } from '../code-workbench/index.jsx';

export { MultiPaneEditor, readSlotCode } from '../code-workbench/index.jsx';

export function WorkbenchEditor({ kind, slots, labels, ready, asset, styleKey, onChange, onSave, rootRef }) {
  return (
    <MultiPaneEditor
      layoutKey={kind}
      slots={slots}
      labels={labels}
      ready={ready}
      code={ready ? (asset?.code?.[styleKey] || {}) : {}}
      codeKey={styleKey}
      onChange={onChange}
      onSave={onSave}
      rootRef={rootRef}
    />
  );
}
