// src/web/frontend/external/color-studio/components/EmptyColorState.jsx
// 色彩资源「还没有任何调色板」时的友好引导
// - 大标题 + 一段说明
// - 三个动作:新建调色板 / CLI 创建 / 跳到 demo
import { useState } from 'react';

const SAMPLE_PALETTE = JSON.stringify(
  {
    name: '示例调色板',
    harmony: null,
    colors: [
      { id: 'a1', hex: '#5B7CFA', weight: 1, locked: false, note: '主色', tags: ['brand'], createdAt: 0, updatedAt: 0 },
      { id: 'a2', hex: '#845EF7', weight: 1, locked: false, note: '辅助', tags: ['brand'], createdAt: 0, updatedAt: 0 },
      { id: 'a3', hex: '#15AABF', weight: 1, locked: false, note: '链接', tags: [], createdAt: 0, updatedAt: 0 },
    ],
    sortBy: 'manual',
  },
  null,
  2,
);

const HOME_GROUP = '未分类'; // 与管理页 createAssetIn 的落点约定一致：根级资源进保留分组

export function EmptyColorState({ onCreate, onCreated, reload }) {
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('主色板');

  const create = async (withSample) => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const data = withSample
        ? SAMPLE_PALETTE.replace('"示例调色板"', JSON.stringify(name.trim()))
        : JSON.stringify({ name: name.trim(), harmony: null, colors: [], sortBy: 'manual' });
      // 先建组（已存在则服务端返回 skipped，幂等），再建资源。
      // 旧实现 POST /api/color/asset-code 且 group 传空串：put 是「改写已有资源」的
      // 保存接口，空组也过不了参数校验——两条路都走不通，此按钮从未成功过。
      const g = await fetch('/api/color/groups', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ group: HOME_GROUP }),
      });
      if (!g.ok) throw new Error(await g.text());
      const gj = await g.json();
      if (gj.ok === false) throw new Error(gj.error);
      const res = await fetch('/api/color/assets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ group: HOME_GROUP, name: slug(name), style: 'default', 'code-data': data }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      if (json.ok === false) throw new Error(json.error);
      onCreated?.(HOME_GROUP, slug(name));
      reload?.();
    } catch (e) {
      alert('创建失败: ' + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        textAlign: 'left',
        padding: '40px 24px',
        maxWidth: 520,
        margin: '24px auto',
        background: 'var(--sl-color-surface-alt)',
        border: '1px dashed var(--sl-color-border)',
        borderRadius: 12,
      }}
    >
      <h2 style={{ margin: '0 0 8px', font: '600 14px/1.4 system-ui', color: 'var(--sl-color-text)' }}>
        还没有调色板
      </h2>
      <p style={{ margin: '0 0 18px', font: '12px/1.6 system-ui', color: 'var(--sl-color-text-secondary)' }}>
        色彩资源按「分组」管理,每个调色板是一个 Palette JSON,自动持久化到{' '}
        <code style={{ fontFamily: 'monospace', background: 'var(--sl-color-surface-deep)', padding: '1px 4px', borderRadius: 3 }}>
          ~/.nx-ft/assets/groups/color/&lt;组&gt;/&lt;调色板&gt;/data
        </code>
        。建好之后自动进入全屏 Studio(色盘 / 比例 / 笔刷 三视图)。
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="调色板名"
          style={{
            flex: '1 1 140px',
            minWidth: 120,
            padding: '6px 10px',
            border: '1px solid var(--sl-color-border)',
            borderRadius: 6,
            font: '12px system-ui',
            background: '#fff',
          }}
          data-testid="empty-palette-name"
        />
        <button
          type="button"
          className="btn small primary"
          onClick={() => create(true)}
          disabled={busy || !name.trim()}
          data-testid="empty-palette-create-with-sample"
        >
          {busy ? '创建中…' : '新建并填充示例'}
        </button>
        <button
          type="button"
          className="btn small"
          onClick={() => create(false)}
          disabled={busy || !name.trim()}
          data-testid="empty-palette-create-blank"
        >
          空白调色板
        </button>
      </div>
      <p style={{ margin: '14px 0 0', font: '11px system-ui', color: 'var(--sl-color-text-dim)' }}>
        也可以用 CLI:<code style={{ fontFamily: 'monospace', marginLeft: 6 }}>nx-ft color group add &lt;组&gt;</code> →{' '}
        <code style={{ fontFamily: 'monospace' }}>nx-ft color add &lt;组&gt; &lt;调色板&gt; --code-data - &lt; &lt;EOF …</code>
      </p>
    </div>
  );
}

function slug(s) {
  return s.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9一-鿿_-]/g, '') || 'palette';
}
