// 分组页（路由 `#/svg/group/<分组路径>`）：钻进一个分组，看它和它下面所有子分组。
//
// 与看板的差别不是「换个数据集」，而是**视野收窄**：看板回答「库里有什么」，
// 分组页回答「这一组做得怎么样、还差哪几枚」。所以这里带面包屑、
// 带子分组入口，并把批量动作默认收敛到本组范围（自检/归一化/导出都只动这一组）。
import { useMemo } from 'react';
import { useStore } from '../../store.jsx';
import { useDialog, useGuard, useToast } from '../ui.jsx';
import { useBatch } from './batch.jsx';
import { Empty, GroupHead, IconTile, StatBar, Crumb } from './parts.jsx';
import { useBoard, useNav } from './useSvg.js';

// 路径 → 逐级面包屑：[{label, onGo}]，最后一段是当前组（不可点）。
function crumbsFor(path, nav) {
  const segs = String(path).split('/').filter(Boolean);
  const out = [{ label: 'SVG 看板', key: 'root', onGo: () => nav.board() }];
  segs.forEach((s, i) => {
    const upto = segs.slice(0, i + 1).join('/');
    out.push({ label: s, key: upto, onGo: () => nav.group(upto) });
  });
  return out;
}

export default function Group({ path }) {
  const toast = useToast();
  const guard = useGuard();
  const { dialog, node: dlgNode } = useDialog();
  const { boot } = useStore();
  const nav = useNav();
  const bin = boot?.app?.name || 'nx-ft';

  const { data, err, busy, reload } = useBoard({});
  const batch = useBatch({ bin, dialog, guard, toast, reload, group: path });

  const view = useMemo(() => {
    const all = data?.groups || [];
    const here = all.filter((g) => g.path === path);
    const kids = all.filter((g) => g.path.startsWith(path + '/'));
    const assets = here.flatMap((g) => g.assets.map((a) => ({ ...a, groupPath: g.path })));
    // 统计覆盖**整棵子树**：分组页的视野是「这一支做得怎么样」，
    // 只数直属资源会让 ui 这种中间层永远显示 0，而下面明明列着十几枚。
    const scope = [...here, ...kids].flatMap((g) => g.assets);
    const stats = scope.reduce(
      (s, a) => {
        const n = (a.audit?.issues || []).length;
        s.icons++;
        s.issues += n;
        if (n) s.flagged++;
        else s.compliant++;
        return s;
      },
      { icons: 0, compliant: 0, flagged: 0, issues: 0 }
    );
    return { here, kids, assets, stats, exists: here.length > 0, groups: here.length + kids.length };
  }, [data, path]);

  if (err) return <div className="empty bad">接口调用失败：{err}</div>;

  return (
    <div className="svg-board">
      <div className="page-head">
        <Crumb segs={crumbsFor(path, nav)} />
        <div className="page-head-acts">
          <button className="btn ghost" onClick={() => batch.check(path)}>自检本组</button>
          <button className="btn ghost" onClick={() => batch.fix(path)}>归一化本组</button>
          <button className="btn ghost" onClick={() => batch.exportDir()}>导出本组</button>
        </div>
      </div>

      <StatBar count={{ groups: view.groups }} stats={view.stats} spec={data?.spec} />

      {data && !view.exists && !view.kids.length ? (
        <Empty>
          分组 <code className="mono">{path}</code> 不存在（或已删除）。
          <button className="btn small ghost" onClick={() => nav.board()}>回到看板</button>
        </Empty>
      ) : null}

      {view.assets.length ? (
        <section className="board-group">
          <GroupHead
            group={{ path, label: view.here[0]?.label || path, assets: view.assets, flagged: view.stats.flagged }}
          >
            <button className="btn small ghost" onClick={() => batch.check(path)}>自检</button>
            <button className="btn small ghost" onClick={() => batch.fix(path)}>归一化</button>
          </GroupHead>
          <div className="icon-grid">
            {view.assets.map((a) => (
              <IconTile
                key={a.groupPath + '/' + a.name}
                asset={a}
                groupPath={a.groupPath}
                onOpen={() => nav.asset(a.groupPath, a.name)}
                onFull={() => nav.full(a.groupPath, a.name)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {view.kids.map((k) => (
        <section key={k.path} className="board-group">
          <GroupHead
            group={{ ...k, flagged: k.assets.filter((a) => (a.audit?.issues || []).length).length }}
            onOpen={() => nav.group(k.path)}
          >
            <button className="btn small ghost" onClick={() => batch.check(k.path)}>自检</button>
            <button className="btn small ghost" onClick={() => batch.fix(k.path)}>归一化</button>
          </GroupHead>
          <div className="icon-grid">
            {k.assets.map((a) => (
              <IconTile
                key={k.path + '/' + a.name}
                asset={a}
                groupPath={k.path}
                onOpen={() => nav.asset(k.path, a.name)}
                onFull={() => nav.full(k.path, a.name)}
              />
            ))}
          </div>
        </section>
      ))}

      <div className="board-foot">
        <div className="board-hints">
          <span className="muted">AI 在本组内工作（等价命令）：</span>
          <code className="mono board-hint-cmd">{bin} svg board</code>
          <code className="mono board-hint-cmd">{bin} svg spec check {path}</code>
          <code className="mono board-hint-cmd">{bin} svg spec fix {path}</code>
          <code className="mono board-hint-cmd">{bin} svg export {path} --to &lt;目录&gt;</code>
        </div>
      </div>
      {busy && !data ? <Empty>加载中…</Empty> : null}
      {batch.node}
      {dlgNode}
    </div>
  );
}
