// SVG 画廊：把「当前文件夹的图标」平铺成一堵墙，配一条主题色范围，快速浏览 + 验证配色。
//
// 为什么需要它：图标是拿去做业务界面的，真正的验收问题是「跟着主题色一起变的时候好不好看」——
// 单看一枚不改色的图标说明不了任何事。图标规范强制 currentColor，所以这里切一次色，
// 整墙图标同时变，一眼能看出哪一枚在某个主题色下发虚 / 发糊。
//
// 数据走 /api/svg/board（已带 svg 源码与规范审计），受当前 search/tags 影响，
// 与「编辑模式」的筛选口径完全一致——两个视图看的是同一批图标。
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client.js';
import { Btn } from '../btn/index.jsx';
import { Icon, IconGhost } from './svg-inline.jsx';
import { SpecBadge, Empty } from './parts.jsx';
import { SubdirCard } from '../asset/parts.jsx';
import { byOrder } from '../asset/tree.jsx';

// 规范颜色范围：图标必须在这些色下都立得住。
// 前七色对齐面板 tokens（正文 / 次要 / 主色 / 链接 / 警示 / 危险 / 紫），
// 末位白色用来在深底上核对——业务里图标经常落在深色导航条上。
export const THEME_COLORS = [
  { name: '正文黑', value: '#14161a' },
  { name: '次要灰', value: '#8b9096' },
  { name: '主色绿', value: '#2da44e' },
  { name: '链接蓝', value: '#0969da' },
  { name: '警示橙', value: '#bf8700' },
  { name: '危险红', value: '#b3261e' },
  { name: '紫', value: '#8250df' },
  { name: '白（深底）', value: '#ffffff' },
];

const SIZES = [20, 24, 32, 48, 64, 96];
// 每行列数：auto = 按容器自适应；固定值适合「一张一张看清楚」——
// 动画类的资源在密集网格里根本看不清（用户实测），3 列配大尺寸才是它的读法。
const COLS = [0, 2, 3, 4, 6, 8];
const LS_KEY = 'nx-ft-svg-gallery';

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || {};
  } catch {
    return {};
  }
}

export function SvgGallery({
  dir, dirNode, search, activeTags, onOpen, pickDir,
  // 批量勾选（管理页 views.render ctx 注入；缺省 undefined → SubdirCard 走兼容默认）
  batchMode, selected, selectedDirs, onToggle, onToggleDir, tree,
}) {
  const prefs = loadPrefs();
  const [color, setColor] = useState(prefs.color || THEME_COLORS[0].value);
  const [size, setSize] = useState(prefs.size || 32);
  const [deep, setDeep] = useState(!!prefs.deep); // 含子目录
  const [kind, setKind] = useState(prefs.kind || 'all'); // all | duotone | line
  const [cols, setCols] = useState(prefs.cols ?? 0); // 0 = 自适应
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ color, size, deep, kind, cols }));
    } catch {
      /* 隐私模式静默 */
    }
  }, [color, size, deep, kind, cols]);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (search) p.set('search', search);
    if (activeTags?.length) p.set('tags', activeTags.join(','));
    return p.toString();
  }, [search, activeTags]);

  useEffect(() => {
    let dead = false;
    api(`/api/svg/board${params ? '?' + params : ''}`)
      .then((d) => {
        if (!dead) {
          setData(d);
          setErr('');
        }
      })
      .catch((e) => !dead && setErr(String((e && e.message) || e)));
    return () => {
      dead = true;
    };
  }, [params]);

  // 当前文件夹（含可选子目录）的资源 + 名字过滤 + 单色/双色筛选
  const subdirs = dirNode?.children || [];
  const all = useMemo(() => {
    const out = [];
    // 分组与组内资源都按树序（byOrder），图标墙的先后跟随侧边栏的手动排序
    for (const g of (data?.groups || []).slice().sort(byOrder)) {
      // 根节点默认只看直系（根无直系资源 → 空墙 + 文件夹卡片），与主页面「仅显示当前目录」
      // 口径一致；「含子文件夹」是显式选择才放行全库（或后代）。
      // 旧实现 `!dir || ...` 在根时恒真，把所有子文件夹的文件平铺到根页，违反 03 主页面任务。
      const inScope =
        g.path === dir ||
        (deep && (dir ? g.path.startsWith(dir + '/') : true));
      if (!inScope) continue;
      for (const a of g.assets.slice().sort(byOrder)) out.push({ ...a, groupPath: g.path });
    }
    return out;
  }, [data, dir, deep]);

  const cells = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return all.filter((c) => {
      if (kind === 'duotone' && c.profile !== 'duotone') return false;
      if (kind === 'line' && c.profile === 'duotone') return false;
      if (!kw) return true;
      return `${c.name} ${c.label} ${c.groupPath}`.toLowerCase().includes(kw);
    });
  }, [all, kind, q]);

  const duotoneCount = all.filter((c) => c.profile === 'duotone').length;
  // 主题色只对「跟随主题」的资源有意义。整屏都是原色图形（动画 / 插画）时
  // 那一行控件与图例都是死按钮——直接不渲染（不同 SVG 类型的兼容）。
  const hasFollowers = all.some((c) => c.profile !== 'color');

  const darkBg = color.toLowerCase() === '#ffffff';

  return (
    <>
      <div className="gal-bar">
        {hasFollowers ? (
          <>
            <span className="gal-label">主题色</span>
            <div className="gal-swatches">
              {THEME_COLORS.map((c) => (
                <button
                  key={c.value}
                  className={'gal-swatch' + (color === c.value ? ' active' : '')}
                  style={{ background: c.value }}
                  title={c.name}
                  aria-label={c.name}
                  onClick={() => setColor(c.value)}
                  data-testid={`gal-color-${c.name}`}
                />
              ))}
              <label className="gal-custom" title="业务自定义色（用定后建议回填到规范）">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  data-testid="gal-color-custom"
                />
              </label>
            </div>
          </>
        ) : null}

        <span className="gal-label">尺寸</span>
        <div className="gal-sizes">
          {SIZES.map((s) => (
            <Btn
              key={s}
              size="sm"
              className={size === s ? 'on' : ''}
              onClick={() => setSize(s)}
              testId={`gal-size-${s}`}
            >
              {s}
            </Btn>
          ))}
        </div>

        <span className="gal-label">类型</span>
        <div className="gal-sizes">
          {[
            { id: 'all', label: '全部' },
            { id: 'duotone', label: `双色 ${duotoneCount}` },
            { id: 'line', label: '单色' },
          ].map((v) => (
            <Btn
              key={v.id}
              size="sm"
              className={kind === v.id ? 'on' : ''}
              onClick={() => setKind(v.id)}
              testId={`gal-kind-${v.id}`}
            >
              {v.label}
            </Btn>
          ))}
        </div>

        <label className="gal-deep">
          <input
            type="checkbox"
            checked={deep}
            onChange={(e) => setDeep(e.target.checked)}
            data-testid="gal-deep"
          />
          含子文件夹
        </label>

        <span className="gal-label">每行</span>
        <div className="gal-sizes">
          {COLS.map((n) => (
            <Btn
              key={n}
              size="sm"
              className={cols === n ? 'on' : ''}
              onClick={() => setCols(n)}
              title={n === 0 ? '按容器宽度自适应' : `一行 ${n} 个`}
              testId={`gal-cols-${n === 0 ? 'auto' : n}`}
            >
              {n === 0 ? '自动' : n}
            </Btn>
          ))}
        </div>

        <div className="gal-spacer" />
        <input
          className="gal-search"
          spellCheck="false"
          placeholder="在墙上找资源"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          data-testid="gal-search"
        />
        <span className="muted gal-count" data-testid="gal-count">{cells.length} 枚</span>
      </div>

      {err ? <div className="empty bad">{err}</div> : null}

      {/* 空态只在「既无直系资源、也无子文件夹」时出；有子文件夹时让上面的文件夹区块
          顶替说话，避开「这个文件夹还没有资源。也可能在子文件夹里……」的语义打架。
          「勾上含子文件夹」提示仅在根且 deep 关时给——其它情形与当前目录规则无冲突。 */}
      {data && !cells.length && !subdirs.length ? (
        <Empty>
          {dir ? '这个文件夹还没有资源' : '还没有任何资源'}
          {!deep && !dir ? '。勾上「含子文件夹」可平铺全部子文件夹的图标' : ''}
        </Empty>
      ) : null}

      {/* 文件夹在画廊**之上**：一个文件夹的内容才铺成画廊。
          少了这一段，画廊模式就成了「只能看、进不去」的死页面（用户实测反馈）。 */}
      {subdirs.length ? (
        <>
          <div className="am-sec-title">文件夹 · {subdirs.length}</div>
          <div className="am-subdirs">
            {subdirs.map((c) => (
              <SubdirCard
                key={c.path}
                node={c}
                onSelect={pickDir}
                selectable={!!batchMode}
                selected={selected || new Set()}
                selectedDirs={selectedDirs || new Set()}
                onToggle={onToggle}
                onToggleDir={onToggleDir}
                tree={tree}
              />
            ))}
          </div>
        </>
      ) : null}

      {/* 网格只在有图可铺时渲染；cells=0 的空 div（grid-template-columns 已设但无子项）
          会留个零高度容器在 DOM 里——既无视觉价值，也容易在后续样式里吃掉版面。 */}
      {cells.length ? (
      <div
        className={'gal-grid' + (darkBg ? ' gal-grid-dark' : '') + (cols ? ' gal-grid-fixed' : '')}
        style={{
          color,
          // 固定列数时直接写死列模板；自适应时交给 CSS 的 auto-fill
          ...(cols ? { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } : {}),
        }}
        data-testid="gal-grid"
      >
        {cells.map((c) => {
          const key = `${c.groupPath}/${c.name}`;
          const picked = batchMode && (selected || new Set()).has(key);
          return (
          <button
            key={key}
            className={'gal-cell' + (c.profile === 'color' ? ' gal-cell-art' : '') + (picked ? ' picked' : '')}
            onClick={() => (batchMode ? onToggle?.(c.groupPath, c.name) : onOpen(c.groupPath, c.name))}
            title={`${c.label}（${c.name}）\n${c.groupPath}${c.profile === 'color' ? '\n原色图形：按自身长宽比撑满格子' : ''}${batchMode ? '\n（批量模式：点选加入批量）' : ''}`}
            data-testid={`gal-cell-${c.name}`}
          >
            {batchMode ? (
              <span className={'gal-check' + (picked ? ' on' : '')} aria-hidden="true" />
            ) : null}
            <span className="gal-art">
              {c.svg ? <Icon svg={c.svg} size={size} /> : <IconGhost size={size} />}
              {c.audit?.issues?.length ? (
                <span className="gal-mark">
                  <SpecBadge issues={c.audit.issues} compact />
                </span>
              ) : null}
            </span>
            <span className="gal-name nowrap">{c.label}</span>
            {/* 类型与风格数：让「这枚会不会跟主题走」「它有几种做法」在墙上就能看出来 */}
            <span className="gal-marks">
              {c.profile === 'duotone' ? <span className="gal-mark-chip">双色</span> : null}
              {c.profile === 'color' ? <span className="gal-mark-chip">原色</span> : null}
              {c.styleCount > 1 ? (
                <span className="gal-mark-chip" title={`${c.styleCount} 个风格`}>×{c.styleCount}</span>
              ) : null}
            </span>
          </button>
          );
        })}
      </div>
      ) : null}
    </>
  );
}
