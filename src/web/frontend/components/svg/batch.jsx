// 批量运维：导入 / 导出 / 整库自检 / 一键归一化。
//
// 这四件事都有「先看计划、再落盘」的两段式（--dry-run），所以它们统一走
// 一个带结果面板的弹窗，而不是各自弹一串 alert——多文件操作最怕的是
// 「点了确定，然后不知道刚才到底改了什么」。
import { useState } from 'react';
import { api } from '../../api/client.js';
import { Modal } from '../ui.jsx';
import { ISSUE_LABEL } from './parts.jsx';

function Result({ title, lines, empty }) {
  return (
    <div className="batch-result">
      <div className="batch-result-head">{title}</div>
      {lines.length ? (
        <pre className="snippet-box batch-pre">{lines.join('\n')}</pre>
      ) : (
        <div className="empty">{empty}</div>
      )}
    </div>
  );
}

export function useBatch({ bin, dialog, guard, toast, reload, group }) {
  const [modal, setModal] = useState(null);

  const close = () => setModal(null);

  // 整库自检：逐条列出不合规的图标与原因（与 svg spec check 同一份数据）。
  const check = (scope) =>
    guard(async () => {
      const g = scope ?? group;
      const r = await api('/api/svg/spec-check' + (g ? '?group=' + encodeURIComponent(g) : ''));
      if (r.hint) {
        toast('没有匹配的分组。' + r.hint);
        return;
      }
      const lines = [];
      for (const f of r.flagged || []) {
        lines.push(`${f.group}/${f.name}${f.style ? '@' + f.style : ''}  (${f.label})`);
        for (const i of f.issues) lines.push(`    [${ISSUE_LABEL[i.code] || i.code}] ${i.message}`);
      }
      setModal({
        title: '规范自检',
        node: (
          <Result
            title={`审计 ${r.stats.assets} 枚 · 合规 ${r.stats.compliant} · 待规范 ${r.stats.flagged} · 问题 ${r.stats.issues} 条`}
            lines={lines}
            empty="全部合规，没有需要处理的图标。"
          />
        ),
      });
    });

  // 一键归一化：先 dry-run 出改动清单，确认后才真跑。
  // 改动统一走 saveCode → 每次都进该风格的编辑历史，可以用 svg history restore 回退。
  const fix = (scope) =>
    guard(async () => {
      const g = scope ?? group;
      const body = { profile: 'line', 'dry-run': true };
      if (g) body.group = g;
      const plan = await api('/api/svg/spec-fix', { method: 'POST', body });
      if (plan.hint) {
        toast('没有匹配的分组。' + plan.hint);
        return;
      }
      if (!plan.changed.length) {
        toast('没有需要归一化的图标（已合规 ' + plan.unchanged + ' 个）');
        return;
      }
      const ok = await dialog({
        title: `归一化 ${plan.changed.length} 个图标？`,
        message:
          plan.changed
            .slice(0, 10)
            .map((c) => `${c.group}/${c.name}@${c.style}\n  → ${c.changed.join('，')}`)
            .join('\n') + (plan.changed.length > 10 ? `\n…… 还有 ${plan.changed.length - 10} 个` : ''),
        okText: '按规范写回',
      });
      if (!ok) return;
      const real = { profile: 'line' };
      if (g) real.group = g;
      const r = await api('/api/svg/spec-fix', { method: 'POST', body: real });
      await reload();
      setModal({
        title: '归一化完成',
        node: (
          <Result
            title={`改动 ${r.changed.length} 个 · 已合规 ${r.unchanged} 个 · 失败 ${r.failed.length} 个 · 写入历史 ${r.history} 条`}
            lines={[
              ...r.changed.map((c) => `${c.group}/${c.name}@${c.style}  → ${c.changed.join('，')}`),
              ...r.failed.map((f) => `! ${f.group}/${f.name} —— ${f.reason}`),
            ]}
            empty="本次没有产生改动。"
          />
        ),
      });
    });

  // 批量导入：先 dry-run 出计划（含每枚的展示名），确认后才写入。
  const importDir = () =>
    guard(async () => {
      const from = await dialog({
        title: '批量导入',
        message: '填一个本机目录，目录下的 .svg 会逐个建成图标资源。展示名默认取 <title>。',
        input: true,
        placeholder: 'D:\\icons\\outline',
        okText: '下一步',
      });
      if (!from) return;
      const target = await dialog({
        title: '导入到哪个分组',
        input: true,
        value: group || '',
        placeholder: 'ui/icons',
        // 段数上限的真相在 core/assets/constants.js 的 GROUP_DEPTH_MAX（当前 8）
        message: '最多 8 段路径；不存在会自动创建。',
        okText: '预览计划',
      });
      if (!target) return;
      const opts = { group: target, from, 'label-from': 'title' };
      const plan = await api('/api/svg/import', { method: 'POST', body: { ...opts, 'dry-run': true } });
      if (!plan.total) {
        toast('该目录下没有找到 .svg');
        return;
      }
      const ok = await dialog({
        title: `导入 ${plan.total} 个图标到 ${plan.group}？`,
        message: plan.plan.slice(0, 14).map((p) => `${p.name}  ← ${p.file}`).join('\n') +
          (plan.total > 14 ? `\n…… 还有 ${plan.total - 14} 个` : ''),
        okText: '导入',
      });
      if (!ok) return;
      const r = await api('/api/svg/import', { method: 'POST', body: opts });
      await reload();
      setModal({
        title: '导入完成',
        node: (
          <Result
            title={`已导入 ${r.imported.length} 个到 ${r.group}${r.groupCreated ? '（分组为本次新建）' : ''}${
              r.skipped.length ? ` · 跳过 ${r.skipped.length} 个` : ''
            }`}
            lines={[
              ...r.imported.map((i) => `+ ${i.name}  (${i.label})  ${i.bytes} B`),
              ...r.skipped.map((s) => `= ${s.name} —— ${s.reason}`),
            ]}
            empty="没有导入任何文件。"
          />
        ),
      });
    });

  // 批量导出：写「目录 + 一张自包含 index.html 看板页」。
  // 同名文件默认跳过（导出器不改写别人的文件），跳过项会如实列出来。
  const exportDir = () =>
    guard(async () => {
      const to = await dialog({
        title: '批量导出',
        message: '导出为「目录 + 一张自包含 index.html 看板页」，可直接打包交接。同名文件默认跳过。',
        input: true,
        placeholder: 'D:\\icons\\export',
        okText: '导出',
      });
      if (!to) return;
      const body = { to, board: true };
      if (group) body.group = group;
      const r = await api('/api/svg/export', { method: 'POST', body });
      setModal({
        title: '导出完成',
        node: (
          <Result
            title={`已导出 ${r.exported.length} 个 → ${r.to}${r.skipped.length ? ` · 跳过 ${r.skipped.length} 个` : ''}`}
            lines={[
              ...r.exported.map((e) => `→ ${e.group}/${e.name}.svg  (${e.bytes} B)`),
              ...r.skipped.map((s) => `= ${s.group}/${s.name} —— ${s.reason}`),
              r.board ? `\n看板页: ${r.board}` : '',
            ].filter(Boolean)}
            empty="没有导出任何图标。"
          />
        ),
      });
    });

  const node = modal ? (
    <Modal title={modal.title} onClose={close}>
      {modal.node}
      <div className="batch-foot">
        <span className="muted">
          等价命令：<code className="mono">{bin} svg spec check</code> ·{' '}
          <code className="mono">{bin} svg spec fix</code> · <code className="mono">{bin} svg import</code> ·{' '}
          <code className="mono">{bin} svg export</code>
        </span>
        <button className="btn" onClick={close}>
          知道了
        </button>
      </div>
    </Modal>
  ) : null;

  return { check, fix, importDir, exportDir, node };
}
