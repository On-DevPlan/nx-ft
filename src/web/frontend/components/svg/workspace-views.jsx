// 工作台右侧的几种内容形态：
//   DirCard      一个子目录（进去 / 改名 / 删除三个动作都在卡片上，不用先点进去再找）
//   ResultView   搜索或标签命中时的平铺结果（不做目录层级——检索时层级是干扰）
//   BatchHints   库级操作的等价 CLI 命令（「AI 能照着做」的入口）
import { boardCommands } from './cli.js';
import { Empty, IconTile } from './parts.jsx';

export function DirCard({ node, onOpen, onRename, onRemove }) {
  return (
    <div className="ws-dir">
      <button className="ws-dir-main" onClick={onOpen} title={node.path}>
        <span className="ws-dir-name">{node.label || node.name}</span>
        <span className="ws-dir-count mono">{node.total}</span>
      </button>
      <button className="ws-dir-act" title="改名 / 移动" onClick={onRename}>
        改名
      </button>
      <button className="ws-dir-act danger" title="删除该分组" onClick={onRemove}>
        删
      </button>
    </div>
  );
}

export function ResultView({ data, tags, onOpen, onClear }) {
  const groups = (data?.groups || []).map((g) => ({
    ...g,
    flagged: g.assets.filter((a) => (a.audit?.issues || []).length).length,
  }));

  if (!groups.length) {
    return (
      <Empty>
        没有匹配的图标。
        <button className="btn small ghost" onClick={onClear}>
          清除筛选
        </button>
      </Empty>
    );
  }

  return (
    <>
      <div className="am-sec-title">
        搜索结果 · {data.count.assets} 枚
        {tags.length ? `（${tags.map((t) => '#' + t).join(' + ')}）` : ''}
      </div>
      {groups.map((g) => (
        <section key={g.path} className="board-group">
          <div className="group-head">
            <button className="group-head-path mono" onClick={() => onOpen(g.path, g.assets[0].name)}>
              {g.path}
            </button>
            <span className="group-head-label muted">{g.label}</span>
            <span className="group-head-count">
              {g.assets.length} 枚
              {g.flagged ? <span className="group-head-flagged"> · {g.flagged} 待规范</span> : null}
            </span>
          </div>
          <div className="icon-grid">
            {g.assets.map((a) => (
              <IconTile
                key={g.path + '/' + a.name}
                asset={a}
                groupPath={g.path}
                onOpen={() => onOpen(g.path, a.name)}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

// 上游删掉了通用的 CliHints 组件（那面「30 条命令墙」没人读），
// 这里只列**当前语境**真正用得上的几条；某一枚图标的具体命令在资源页的 CLI 块里。
export function BatchHints({ bin }) {
  return (
    <div className="board-hints">
      <span className="muted">AI 批量运维（等价命令）：</span>
      {boardCommands(bin).map((c) => (
        <code key={c.id} className="mono board-hint-cmd">
          {c.cmd}
        </code>
      ))}
    </div>
  );
}
