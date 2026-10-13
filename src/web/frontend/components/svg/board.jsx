// SVG 看板（路由 `#/svg`）：整库图标一屏看全。
//
// 这是「图标集」的主视图，回答三个问题：
//   1. 库里有什么（分组 → 图标网格）
//   2. 哪些不合规（每格右上角的规范标签 + 顶部统计条）
//   3. 现在做什么（工具条的导入/导出/自检，以及「AI 用 CLI 改哪个资源」）
//
// 数据一次取齐（GET /api/svg/board），筛选交给后端同一套 listTree——
// 前端不另写一份过滤，否则面板的搜索结果和 CLI 迟早不一致。
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useStore } from '../../store.jsx';
import { useDialog, useGuard, useToast } from '../ui.jsx';
import { useBatch } from './batch.jsx';
import { boardCommands } from './cli.js';
import { Empty, GroupHead, IconTile, StatBar, TagCloud } from './parts.jsx';
import { useBoard, useDebounced, useNav } from './useSvg.js';

const LS_KEY = 'nx-ft-svg-board-filter';

function loadFilter() {
  try {
    return { search: '', tags: [], ...(JSON.parse(localStorage.getItem(LS_KEY)) || {}) };
  } catch {
    return { search: '', tags: [] };
  }
}

export default function Board() {
  const toast = useToast();
  const guard = useGuard();
  const { dialog, node: dlgNode } = useDialog();
  const { boot } = useStore();
  const nav = useNav();
  const bin = boot?.app?.name || 'nx-ft';

  const initial = loadFilter();
  const [searchInput, setSearchInput] = useState(initial.search);
  const [tags, setTags] = useState(initial.tags);
  const search = useDebounced(searchInput);

  const { data, err, busy, reload } = useBoard({ search, tags });

  // 「刷新后筛选不丢」是面板硬标准：选择落 localStorage，数据永远从后端拿。
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ search: searchInput, tags }));
    } catch {
      /* 隐私模式静默 */
    }
  }, [searchInput, tags]);

  const toggleTag = (t) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const batch = useBatch({ bin, dialog, guard, toast, reload, group: '' });

  const addGroup = () =>
    guard(async () => {
      const path = await dialog({
        title: '新建分组',
        message: '1~3 段路径，如 ui/icons、ui/icons/nav。',
        input: true,
        placeholder: 'ui/icons',
        okText: '创建',
      });
      if (!path) return;
      const r = await api('/api/svg/groups', { method: 'POST', body: { group: path } });
      await reload();
      toast(r.status === 'skipped' ? '分组已存在' : '已创建分组: ' + r.path);
    });

  const addAsset = () =>
    guard(async () => {
      const group = await dialog({
        title: '新建图标',
        message: '图标 = 一枚 SVG。建好后会进入资源页，可直接写路径或让 AI 用 CLI 写。',
        input: true,
        value: data?.groups?.[0]?.path || '',
        placeholder: 'ui/icons',
        okText: '下一步',
      });
      if (!group) return;
      const name = await dialog({
        title: '图标名',
        input: true,
        placeholder: 'add-icon（目录名，用 kebab-case）',
        okText: '下一步',
      });
      if (!name) return;
      const label = await dialog({ title: '展示名（回车跳过）', input: true, placeholder: '加号' });
      const r = await api('/api/svg/assets', {
        method: 'POST',
        body: { group, name, label: label || undefined },
      });
      await reload();
      nav.asset(r.group, r.name);
      toast('已创建: ' + r.group + '/' + r.name);
    });

  const groups = (data?.groups || []).map((g) => ({
    ...g,
    flagged: g.assets.filter((a) => (a.audit?.issues || []).length).length,
  }));

  return (
    <div className="svg-board">
      <div className="board-bar">
        <div className="board-bar-top">
          <input
            className="board-search"
            spellCheck="false"
            placeholder="搜索图标名 / 分组 / 标签 / 风格"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <div className="board-acts">
            <button className="btn ghost" onClick={addGroup}>
              新建分组
            </button>
            <button className="btn" onClick={addAsset}>
              新建图标
            </button>
            <span className="board-acts-sep" />
            {/* 这些处理函数带可选参数（scope 分组），必须包一层——
                直接 onClick={fn} 会把 MouseEvent 当成 scope 传进去。 */}
            <button className="btn ghost" onClick={() => batch.importDir()}>
              批量导入
            </button>
            <button className="btn ghost" onClick={() => batch.exportDir()}>
              批量导出
            </button>
            <button className="btn ghost" onClick={() => batch.check()}>
              规范自检
            </button>
            <button className="btn ghost" onClick={() => batch.fix()}>
              一键归一化
            </button>
          </div>
        </div>
        <TagCloud
          tags={data?.availableTags || []}
          active={tags}
          onToggle={toggleTag}
          onClear={() => setTags([])}
        />
      </div>

      {err ? <div className="empty bad">接口调用失败：{err}</div> : null}

      <StatBar count={data?.count} total={data?.total} stats={data?.stats} spec={data?.spec} />

      <div className="board-body">
        {!data && busy ? <Empty>加载中…</Empty> : null}
        {data && !groups.length ? (
          <Empty>
            {search || tags.length ? (
              <>
                没有匹配的图标。
                <button className="btn small ghost" onClick={() => { setSearchInput(''); setTags([]); }}>
                  清除筛选
                </button>
              </>
            ) : (
              <>
                库里还没有图标。先 <button className="btn small" onClick={batch.importDir}>批量导入</button> 一个目录，
                或 <button className="btn small ghost" onClick={addAsset}>新建一枚</button>，
                也可以让 AI 直接写：<code className="mono">{bin} svg put ui/icons add-icon --style default --code -</code>
              </>
            )}
          </Empty>
        ) : null}

        {groups.map((g) => (
          <section key={g.path} className="board-group">
            <GroupHead group={g} onOpen={() => nav.group(g.path)}>
              <button className="btn small ghost" onClick={() => batch.check(g.path)}>
                自检
              </button>
              <button className="btn small ghost" onClick={() => batch.fix(g.path)}>
                归一化
              </button>
            </GroupHead>
            <div className="icon-grid">
              {g.assets.map((a) => (
                <IconTile
                  key={g.path + '/' + a.name}
                  asset={a}
                  groupPath={g.path}
                  onOpen={() => nav.asset(g.path, a.name)}
                  onFull={() => nav.full(g.path, a.name)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="board-foot">
        <BatchHints bin={bin} />
      </div>
      {batch.node}
      {dlgNode}
    </div>
  );
}

// 底部固定提示：库级操作的等价命令。
// 上游删掉了通用的 CliHints 组件（那面「30 条命令墙」没人读），
// 所以这里只列**当前语境**真正用得上的四条，具体到某一枚图标的命令在资源页的 CLI 块里。
function BatchHints({ bin }) {
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
