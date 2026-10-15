// 侧边栏的内联「新建目录」行：只问名字，Enter = 建、Esc = 取消，错误留在行内。
//
// 抽成独立组件是为了给 index.jsx 留行数余量（300 行闸门），顺带让 draft/busy/err
// 这三个只服务于本行的状态自成一圈——父组件只关心「建好了没」（onSubmit resolve）。
import { useState } from 'react';
import { Btn } from '../btn/index.jsx';

export function CreateRow({ placeholder, onSubmit, onCancel }) {
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="gcreate"
      onSubmit={async (e) => {
        e.preventDefault();
        const v = draft.trim();
        if (!v || busy) return;
        setBusy(true);
        setErr('');
        try {
          await onSubmit(v);
        } catch (ex) {
          // 失败留在行内（Priority 8：错误出现在字段旁，不只靠 toast）
          setErr(String((ex && ex.message) || ex));
        } finally {
          setBusy(false);
        }
      }}
    >
      <input
        className="gcreate-input"
        autoFocus
        spellCheck="false"
        placeholder={placeholder}
        value={draft}
        disabled={busy}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
        }}
        data-testid="gside-create-input"
      />
      <Btn size="sm" busy={busy} type="submit">
        {busy ? '创建中…' : '创建'}
      </Btn>
      <Btn size="sm" variant="secondary" type="button" onClick={onCancel}>
        取消
      </Btn>
      {err ? <div className="gcreate-err bad">{err}</div> : null}
    </form>
  );
}
