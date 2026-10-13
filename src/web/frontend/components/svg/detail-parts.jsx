// 资源页的呈现件：风格条 / 描述面板 / 规范问题 / 标签条 / CLI 命令块。
import { useEffect, useState } from 'react';
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

// 描述面板：**主描述（资源级）+ 风格列表**，两个模式——
//   显示模式：只读，一段主描述 + 每个风格一行「名字 · 描述」，便于快速核对 / 复制
//   编辑模式：主描述一个输入框，每个风格一个输入框，各自保存
// 为什么要有「主描述」：资源多了以后靠名字找不回来，靠描述才召回得准
// （配合 tree --search —— 搜索会命中主描述与风格描述）。
export function DescPanel({ desc, styles = [], editing, onToggleEdit, onSaveDesc, busy }) {
  const [mainText, setMainText] = useState(desc || '');
  const [styleText, setStyleText] = useState({});
  useEffect(() => {
    setMainText(desc || '');
  }, [desc]);
  useEffect(() => {
    const init = {};
    for (const s of styles) init[s.name] = s.desc || '';
    setStyleText(init);
  }, [styles]);

  if (!editing) {
    return (
      <div className="desc-view" data-testid="desc-view">
        <p className="desc-main">{desc || <span className="muted">（还没有主描述）</span>}</p>
        <ul className="desc-styles">
          {styles.map((s) => (
            <li key={s.name}>
              <span className="mono desc-style-name">{s.name}</span>
              <span className="desc-style-text">{s.desc || <span className="muted">—</span>}</span>
            </li>
          ))}
          {!styles.length ? <li className="muted">还没有风格</li> : null}
        </ul>
      </div>
    );
  }

  return (
    <div className="desc-edit" data-testid="desc-edit">
      <label className="desc-field">
        <span className="desc-label">主描述（这个资源是什么场景）</span>
        <input
          className="desc-input"
          spellCheck="false"
          placeholder="如：一只骑车送外卖的鹈鹕，用于首页加载动画"
          value={mainText}
          disabled={busy}
          onChange={(e) => setMainText(e.target.value)}
          data-testid="desc-main-input"
        />
      </label>
      {styles.map((s) => (
        <label key={s.name} className="desc-field">
          <span className="desc-label">
            风格 <span className="mono">{s.name}</span>（这一套的特征）
          </span>
          <input
            className="desc-input"
            spellCheck="false"
            placeholder="如：整体更圆润，适合深色底"
            value={styleText[s.name] || ''}
            disabled={busy}
            onChange={(e) => setStyleText((prev) => ({ ...prev, [s.name]: e.target.value }))}
            data-testid={`desc-style-input-${s.name}`}
          />
        </label>
      ))}
      <div className="desc-actions">
        <button
          className="btn small primary"
          disabled={busy}
          onClick={() => onSaveDesc(mainText, styleText)}
          data-testid="desc-save"
        >
          保存全部
        </button>
        <button className="btn small ghost" disabled={busy} onClick={onToggleEdit}>
          取消
        </button>
      </div>
    </div>
  );
}

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
