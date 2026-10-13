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
import { Icon, IconGhost } from './svg-inline.jsx';
import { SpecBadge, Empty } from './parts.jsx';

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

const SIZES = [20, 24, 32, 48];
const LS_KEY = 'nx-ft-svg-gallery';

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || {};
  } catch {
    return {};
  }
}

export function SvgGallery({ dir, search, activeTags, onOpen }) {
  const prefs = loadPrefs();
  const [color, setColor] = useState(prefs.color || THEME_COLORS[0].value);
  const [size, setSize] = useState(prefs.size || 32);
  const [deep, setDeep] = useState(!!prefs.deep); // 含子目录
  const [kind, setKind] = useState(prefs.kind || 'all'); // all | duotone | line
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ color, size, deep, kind }));
    } catch {
      /* 隐私模式静默 */
    }
  }, [color, size, deep, kind]);

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

  // 当前文件夹（含可选子目录）的图标 + 名字过滤 + 单色/双色筛选
  const all = useMemo(() => {
    const out = [];
    for (const g of data?.groups || []) {
      const inScope = !dir || g.path === dir || (deep && g.path.startsWith(dir + '/'));
      if (!inScope) continue;
      for (const a of g.assets) out.push({ ...a, groupPath: g.path });
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

  const darkBg = color.toLowerCase() === '#ffffff';

  return (
    <>
      <div className="gal-bar">
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

        <span className="gal-label">尺寸</span>
        <div className="gal-sizes">
          {SIZES.map((s) => (
            <button
              key={s}
              className={'btn small' + (size === s ? ' primary' : '')}
              onClick={() => setSize(s)}
              data-testid={`gal-size-${s}`}
            >
              {s}
            </button>
          ))}
        </div>

        <span className="gal-label">类型</span>
        <div className="gal-sizes">
          {[
            { id: 'all', label: '全部' },
            { id: 'duotone', label: `双色 ${duotoneCount}` },
            { id: 'line', label: '单色' },
          ].map((v) => (
            <button
              key={v.id}
              className={'btn small' + (kind === v.id ? ' primary' : '')}
              onClick={() => setKind(v.id)}
              data-testid={`gal-kind-${v.id}`}
            >
              {v.label}
            </button>
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

        <div className="gal-spacer" />
        <input
          className="gal-search"
          spellCheck="false"
          placeholder="在墙上找图标"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          data-testid="gal-search"
        />
        <span className="muted gal-count">{cells.length} 枚</span>
      </div>

      {err ? <div className="empty bad">{err}</div> : null}

      {data && !cells.length ? (
        <Empty>
          {dir ? '这个文件夹还没有图标' : '还没有任何图标'}
          {!deep && dir ? '。也可能图标在子文件夹里——勾上「含子文件夹」看看' : ''}
        </Empty>
      ) : null}

      <div
        className={'gal-grid' + (darkBg ? ' gal-grid-dark' : '')}
        style={{ color }}
        data-testid="gal-grid"
      >
        {cells.map((c) => (
          <button
            key={`${c.groupPath}/${c.name}`}
            className={'gal-cell' + (dir ? '' : '')}
            onClick={() => onOpen(c.groupPath, c.name)}
            title={`${c.label}（${c.name}）\n${c.groupPath}`}
            data-testid={`gal-cell-${c.name}`}
          >
            <span className="gal-art">
              {c.svg ? <Icon svg={c.svg} size={size} /> : <IconGhost size={size} />}
              {c.audit?.issues?.length ? (
                <span className="gal-mark">
                  <SpecBadge issues={c.audit.issues} compact />
                </span>
              ) : null}
            </span>
            <span className="gal-name nowrap">{c.label}</span>
            {/* 双色：点缀色不跟主题走，只有主题色那一半跟着变——标出来省得误判成「没生效」 */}
            {c.profile === 'duotone' ? <span className="gal-duo">双色</span> : null}
          </button>
        ))}
      </div>
    </>
  );
}
