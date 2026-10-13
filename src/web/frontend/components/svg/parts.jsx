// 看板的呈现件：面包屑 / 规范标签 / 统计条 / 标签云 / 图标格 / 分组头 / 面板壳。
// 全部是「无状态 + 只渲染入参」的纯件，页面的数据与操作留在各自的页面文件里。
import { Fragment } from 'react';
import { Icon, IconGhost } from './svg-inline.jsx';

// 审计问题 code → 短标签（问题清单里当锚点用，全文在 message 里）。
export const ISSUE_LABEL = {
  'no-root': '无根元素',
  viewbox: 'viewBox',
  'fixed-size': '写死尺寸',
  'hardcoded-color': '写死颜色',
  empty: '空图形',
  fill: 'fill',
  stroke: 'stroke',
  'stroke-width': '线宽',
};

export function hasError(issues = []) {
  return issues.some((i) => i.level === 'error');
}

// 时间戳：2026-10-13T07:07:35.542Z → 2026-10-13 07:07:35。
// 只截断不换算时区——快照 id 本身由 UTC 派生，显示成本地时间会让
// 「id 上的时间」和「界面上的时间」对不上，排查时反而更费劲。
export function stamp(iso) {
  return String(iso || '').replace('T', ' ').replace(/\.\d+Z?$/, '');
}

// 规范标签：合规 → 灰；有待规范项 → 墨色（用对比而不是用颜色喊）；
// 只有真正阻断的问题（无根元素 / 空图形）才动 --bad。
export function SpecBadge({ issues = [], compact = false }) {
  if (!issues.length) return <span className="spec-badge ok">合规</span>;
  const err = hasError(issues);
  const tip = issues.map((i) => '· ' + i.message).join('\n');
  if (compact) {
    return (
      <span className={'spec-badge' + (err ? ' err' : ' warn')} title={tip}>
        {issues.length}
      </span>
    );
  }
  return (
    <span className={'spec-badge' + (err ? ' err' : ' warn')} title={tip}>
      {issues.length} 项待规范
    </span>
  );
}

// 面包屑：最后一段是当前位置（不可点），前面都可点。
export function Crumb({ segs }) {
  return (
    <nav className="crumb">
      {segs.map((s, i) => (
        <Fragment key={s.key ?? s.label + i}>
          {i > 0 ? <span className="crumb-sep">/</span> : null}
          {i === segs.length - 1 || !s.onGo ? (
            <span className="crumb-cur">{s.label}</span>
          ) : (
            <button className="crumb-seg" onClick={s.onGo}>
              {s.label}
            </button>
          )}
        </Fragment>
      ))}
    </nav>
  );
}

export function Panel({ title, extra, children, className = '' }) {
  return (
    <section className={'panel-card' + (className ? ' ' + className : '')}>
      {title || extra ? (
        <div className="panel-card-head">
          <span>{title}</span>
          <span className="panel-card-extra">{extra}</span>
        </div>
      ) : null}
      <div className="panel-card-body">{children}</div>
    </section>
  );
}

// 统计条：一屏之内说清「有多少、多少合规」。
export function StatBar({ count, total, stats, spec }) {
  const items = [
    { k: '分组', v: count?.groups ?? 0 },
    { k: '图标', v: stats?.icons ?? 0 },
    { k: '合规', v: stats?.compliant ?? 0 },
    { k: '待规范', v: stats?.flagged ?? 0 },
    { k: '问题', v: stats?.issues ?? 0 },
  ];
  return (
    <div className="statbar">
      {items.map((it) => (
        <div key={it.k} className={'statbar-cell' + (it.k === '待规范' && it.v ? ' hot' : '')}>
          <span className="statbar-v">{it.v}</span>
          <span className="statbar-k">{it.k}</span>
        </div>
      ))}
      {total?.assets > (stats?.icons ?? 0) ? (
        <div className="statbar-cell muted-cell" title="被当前筛选条件挡掉的资源数">
          <span className="statbar-v">-{total.assets - stats.icons}</span>
          <span className="statbar-k">已筛掉</span>
        </div>
      ) : null}
      {spec ? (
        <div className="statbar-spec mono" title="图标规范">
          {spec.grid}pt · stroke {spec.strokeWidth} · {spec.color}
        </div>
      ) : null}
    </div>
  );
}

export function TagCloud({ tags = [], active = [], onToggle, onClear }) {
  if (!tags.length) return null;
  return (
    <div className="tag-cloud">
      {tags.map((t) => (
        <button
          key={t.name}
          className={'tag-chip' + (active.includes(t.name) ? ' active' : '')}
          title={`${t.count} 个资源`}
          onClick={() => onToggle(t.name)}
        >
          {t.name}
          <span className="tag-chip-count">{t.count}</span>
        </button>
      ))}
      {active.length ? (
        <button className="tag-chip ghost" onClick={onClear}>
          清除筛选
        </button>
      ) : null}
    </div>
  );
}

// 图标格：主体面积给图形，名字一行、目录名一行。
//
// 角标只标「异常」：合规的图标保持干净——13 枚里 12 枚都挂个「合规」是没有信息量的噪音，
// 而「待规范」和「多风格」才是需要停下来的地方。
export function IconTile({ asset, groupPath, onOpen, onFull }) {
  const issues = asset.audit?.issues || [];
  const missing = !asset.svg;
  return (
    <div className="icon-tile">
      <button
        className="icon-tile-main"
        onClick={onOpen}
        title={
          `${asset.label}（${asset.name}）\n${groupPath}` +
          (issues.length ? '\n' + issues.map((i) => '· ' + i.message).join('\n') : '\n符合图标规范') +
          (asset.styleCount > 1 ? `\n${asset.styleCount} 个风格` : '')
        }
      >
        <span className="icon-tile-art">
          {missing ? <IconGhost size={34} /> : <Icon svg={asset.svg} size={34} />}
          {issues.length ? (
            <span className="icon-tile-marks">
              <SpecBadge issues={issues} compact />
            </span>
          ) : null}
        </span>
        <span className="icon-tile-name nowrap">{asset.label}</span>
      </button>
      <div className="icon-tile-foot">
        <span className="icon-tile-path mono nowrap">{asset.name}</span>
        {/* 风格数放在脚注而不是压在图形上：它是「有多个版本」的中性事实，
            不该和「待规范」抢图形右上角那块注意力。 */}
        {asset.styleCount > 1 ? (
          <span className="icon-tile-count mono" title={`${asset.styleCount} 个风格`}>
            ×{asset.styleCount}
          </span>
        ) : null}
        <button className="icon-tile-act" onClick={onFull} title="整页预览">
          全页
        </button>
      </div>
    </div>
  );
}

export function GroupHead({ group, onOpen, children }) {
  return (
    <div className="group-head">
      <button className="group-head-path mono" onClick={onOpen} title="进入分组">
        {group.path}
      </button>
      <span className="group-head-label muted">{group.label}</span>
      <span className="group-head-count">
        {group.assets.length} 枚
        {group.flagged ? <span className="group-head-flagged"> · {group.flagged} 待规范</span> : null}
      </span>
      <span className="group-head-more">{children}</span>
    </div>
  );
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}
