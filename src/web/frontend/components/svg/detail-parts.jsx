// 资源页的呈现件：风格条 / 规范问题 / 标签条 / CLI 命令块。
import { Copyable } from '../ui.jsx';
import { assetCommands, heredocSnippet } from './cli.js';
import { Icon, IconGhost } from './svg-inline.jsx';

// 多风格并排：一眼看出「同一个图标的不同做法」，点一下即切换编辑目标。
export function StyleStrip({ styles = [], activeStyle, current, onPick, onSetActive }) {
  if (!styles.length) {
    return (
      <div className="empty">
        这个图标还没有任何风格。先「新建风格」，再往 SVG 槽位里写路径；也可以让 AI 写：
        <code className="mono"> svg put … --code -</code>。
      </div>
    );
  }
  return (
    <div className="style-strip">
      {styles.map((s) => {
        const issues = s.audit?.issues || [];
        const isActive = s.name === activeStyle;
        const isCur = s.name === current;
        return (
          <div key={s.name} className={'style-card' + (isCur ? ' cur' : '')}>
            <button className="style-card-main" onClick={() => onPick(s.name)} title={`编辑 ${s.name}`}>
              <span className="style-card-art">
                {s.svg ? <Icon svg={s.svg} size={30} /> : <IconGhost size={30} />}
              </span>
              <span className="style-card-name mono nowrap">{s.name}</span>
              {/* 风格描述（svg style desc 写）：多风格并排时，光看名字看不出
                  alt 与 bold 差在哪，这行是唯一说清「这套实现的特征」的地方。 */}
              <span className="style-card-desc nowrap" title={s.desc || ''}>
                {s.desc || '—'}
              </span>
              <span className="style-card-badges">
                {isActive ? <span className="tag strong">当前</span> : null}
                {issues.length ? (
                  <span className="tag" title={issues.map((i) => '· ' + i.message).join('\n')}>
                    {issues.length} 待规范
                  </span>
                ) : (
                  <span className="tag">合规</span>
                )}
                <span className="tag" title="该风格的编辑历史条数">历史 {s.historyCount}</span>
              </span>
            </button>
            {!isActive ? (
              <button className="style-card-act" onClick={() => onSetActive(s.name)}>
                设为当前
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// 规范问题清单：每条带 code 短标签 + 人读说明 + 怎么改。
export function IssueList({ issues = [], style, onFix }) {
  if (!issues.length) {
    return <div className="issue-clean">这一版符合图标规范（24pt 网格 · stroke 1.8 · currentColor）。</div>;
  }
  return (
    <div className="issue-list">
      {issues.map((i, idx) => (
        <div key={i.code + idx} className={'issue-row ' + (i.level === 'error' ? 'err' : 'warn')}>
          <span className="issue-code mono">{i.code}</span>
          <span className="issue-msg">{i.message}</span>
          <span className="issue-hint muted">{i.hint}</span>
        </div>
      ))}
      <div className="issue-foot">
        <button className="btn small ghost" onClick={onFix}>
          按规范修复 {style}
        </button>
        <span className="muted">改动会写入该风格的编辑历史，可逐条回退。</span>
      </div>
    </div>
  );
}

export function TagBar({ tags = [], onAdd, onRemove }) {
  return (
    <div className="tag-bar">
      {tags.length ? (
        tags.map((t) => (
          <span key={t} className="tag-chip">
            {t}
            <button className="tag-chip-x" title="移除标签" onClick={() => onRemove(t)}>
              ×
            </button>
          </span>
        ))
      ) : (
        <span className="muted">无标签</span>
      )}
      <button className="tag-chip ghost" onClick={onAdd}>
        + 标签
      </button>
    </div>
  );
}

// CLI 命令块：读 → 改 → 写回 的三条命令，外加可直接粘贴的 heredoc。
// 这是「AI 通过 CLI 编辑这枚图标」的说明书，命令里已经带上了当前上下文参数。
export function CliBlock({ bin, group, name, style, svg }) {
  const cmds = assetCommands(bin, { group, name, style });
  return (
    <div className="cli-block">
      <div className="cli-block-row">
        {cmds.map((c) => (
          <span key={c.id} className="cli-item">
            <span className="cli-item-label muted">{c.label}</span>
            <Copyable className="cli-item-cmd mono" text={c.cmd} title="点击复制">
              {c.cmd}
            </Copyable>
          </span>
        ))}
      </div>
      <div className="cli-block-heredoc">
        <div className="muted">
          AI 写回的标准姿势（flag 必须在 <code className="mono">&lt;&lt;'EOF'</code> 之前，EOF 顶格且加引号）：
        </div>
        <Copyable className="snippet-box mono" text={heredocSnippet(bin, { group, name, style, svg })}>
          <pre>{heredocSnippet(bin, { group, name, style, svg })}</pre>
        </Copyable>
      </div>
    </div>
  );
}
