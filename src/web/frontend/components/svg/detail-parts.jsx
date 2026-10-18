// 资源页的呈现件：风格条 / 描述面板 / 规范问题 / 标签条 / CLI 命令块。
import { Btn } from '../btn/index.jsx';
import { Copyable } from '../ui.jsx';
import { assetCommands, heredocSnippet } from './cli.js';
import { Icon, IconGhost } from './svg-inline.jsx';

// 风格条：多风格横排成一条「胶囊 + 描述」，点胶囊即切换编辑目标。
//
// 原来是一格一卡的「卡片墙」——每张卡 130px 高，把整页顶到折叠线以下（用户实测）。
// 第一版改 26px 胶囊 + 描述塞 title，但用户反馈「不同风格的特征没地方看」：
// 描述是「alt vs bold 差在哪」的关键信息，hover 才看见等于没看。
// 这次再改：胶囊下方常驻一行描述（2 行截断 + hover 看完整），
// 整套 53px 高，还是只占描述条一小段，但描述**常驻可见**。
// 描述之外的信息（待规范数、历史条数）继续在胶囊的 title 里，按需 hover。
export function StyleStrip({ styles = [], activeStyle, current, onPick }) {
  if (!styles.length) {
    return <span className="muted f11">还没有风格</span>;
  }
  return (
    <div className="style-pills">
      {styles.map((s) => {
        const issues = s.audit?.issues || [];
        const isActive = s.name === activeStyle;
        const isCur = s.name === current;
        const tip = [
          issues.length ? `${issues.length} 项待规范` : '合规',
          s.historyCount ? `历史 ${s.historyCount} 条` : null,
          isActive ? '当前风格' : null,
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <div key={s.name} className={'style-pill-cell' + (isCur ? ' cur' : '')}>
            <button
              type="button"
              className="style-pill"
              title={`编辑 ${s.name}\n${tip}`}
              onClick={() => onPick(s.name)}
              data-testid={`style-pill-${s.name}`}
            >
              <span className="style-pill-art">
                {s.svg ? <Icon svg={s.svg} size={13} /> : <IconGhost size={13} />}
              </span>
              <span className="mono nowrap">{s.name}</span>
              {isActive ? <span className="tag strong">当前</span> : null}
            </button>
            <div className="style-pill-desc" title={s.desc || '（未写描述）'}>
              {s.desc || '—'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 描述编辑器已搬进抽屉（./desc-drawer.jsx 的 DescDrawer）：主描述 + 全部风格
// 一次填完。为什么要有「主描述」：资源多了以后靠名字找不回来，靠描述才召回得准
// （配合 tree --search —— 搜索会命中主描述与风格描述）。

// 规范问题清单：每条带 code 短标签 + 人读说明 + 怎么改。
// profile 决定「没问题」时那句话怎么说——插画/动画不套图标那套，
// 说它「符合图标规范（24pt·1.8·currentColor）」是错的（用户实测指出）。
export function IssueList({ issues = [], style, onFix, profile = 'line' }) {
  if (!issues.length) {
    return (
      <div className="issue-clean">
        {profile === 'color'
          ? '原色图形：不套图标规范——配色与线宽按设计保留，只校验几何容器。'
          : profile === 'duotone'
            ? '这一版符合规范（双色：主题色走 currentColor，点缀色保留）。'
            : '这一版符合图标规范（24pt 网格 · stroke 1.8 · currentColor）。'}
      </div>
    );
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
        <Btn size="sm" variant="secondary" onClick={onFix}>
          按规范修复 {style}
        </Btn>
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
