// 工作台的两处「跨会话记忆」：筛选条件与左栏宽度。
//
// 都是**选择落 localStorage、数据永远从后端拿**——面板硬标准：
// 刷新后筛选不丢，但绝不能拿本地缓存的旧数据当真相（别人用 CLI 改过库就看不见了）。
import { useCallback, useEffect, useRef, useState } from 'react';

const LS_KEY = 'nx-ft-svg-ws';
const LS_W = 'nx-ft-svg-tree-w';
export const W_MIN = 180;
export const W_MAX = 460;
const W_DEFAULT = 260;

export function loadSavedFilter() {
  try {
    return { search: '', tags: [], ...(JSON.parse(localStorage.getItem(LS_KEY)) || {}) };
  } catch {
    return { search: '', tags: [] };
  }
}

export function useSavedFilter(searchInput, tags) {
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ search: searchInput, tags }));
    } catch {
      /* 隐私模式静默 */
    }
  }, [searchInput, tags]);
}

// 左栏宽度：拖动 + 记住。用 pointer 事件（鼠标/触控/笔一套），拖动中才改内存、停下落盘。
export function usePaneWidth() {
  const [w, setW] = useState(() => {
    const n = Number(localStorage.getItem(LS_W));
    return Number.isFinite(n) && n >= W_MIN && n <= W_MAX ? n : W_DEFAULT;
  });
  useEffect(() => {
    try {
      localStorage.setItem(LS_W, String(w));
    } catch {
      /* 隐私模式静默 */
    }
  }, [w]);

  const drag = useRef(null);
  const onDown = useCallback(
    (e) => {
      e.preventDefault();
      drag.current = { x: e.clientX, w };
      const move = (ev) =>
        setW(Math.min(W_MAX, Math.max(W_MIN, drag.current.w + (ev.clientX - drag.current.x))));
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        document.body.classList.remove('ws-dragging');
      };
      // 拖动时给 body 挂 class：避免经过文字时被选中、鼠标形状也不会乱闪
      document.body.classList.add('ws-dragging');
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [w]
  );
  return { w, onDown, reset: () => setW(W_DEFAULT) };
}

// 当前目录（含整棵子树）的统计。
// 目录页的视野是「这一支做得怎么样」——只数直属资源会让 ui 这种中间层永远显示 0，
// 而它下面明明列着十几枚。根目录时它自然退化成全库统计，两处口径自动一致。
//
// 分组数只数**真正的分组**（有 group.json 的那种），不含 ui 这种仅为分层的空壳目录：
// CLI 的 `tree` 也是这个口径，两边必须一致，否则「UI 说 5 组、CLI 说 4 组」这种
// 对不上的数字最伤人——用户不知道该信哪个。
export function subtreeStats(node, realGroupPaths) {
  const real = realGroupPaths ? new Set(realGroupPaths) : null;
  const acc = { groups: 0, icons: 0, compliant: 0, flagged: 0, issues: 0 };
  const walk = (n) => {
    for (const a of n.direct || []) {
      const k = (a.audit?.issues || []).length;
      acc.icons++;
      acc.issues += k;
      if (k) acc.flagged++;
      else acc.compliant++;
    }
    for (const c of n.children || []) {
      if (!real || real.has(c.path)) acc.groups++;
      walk(c);
    }
  };
  if (node) walk(node);
  return acc;
}

// 树的展开状态。首次的默认值按库的规模自适应：
//   小库（分组数 ≤ 20）**全展开**——只有四个分组却把它们藏进折叠箭头里，
//     用户就得先点两下才知道自己有什么，没有任何好处；
//   大库只展开第一层——几十个分组全展开等于没有层级，反而找不到东西。
// 之后：进入某个目录时自动展开它的祖先链（「进去了但树里看不见自己在哪」很别扭）。
const AUTO_EXPAND_MAX = 20;

export function useAutoExpand(root, path, ancestorsOf) {
  const [expanded, setExpanded] = useState(() => new Set());
  const inited = useRef(false);

  useEffect(() => {
    if (inited.current) return;
    // 数据还没到（首帧的树是空的）不能下结论，否则会把「空」锁成初始状态，
    // 等分组回来了树已经记成「全都折叠」，再也展开不了
    if (!root?.children?.length) return;
    const withKids = [];
    const walk = (n) => {
      if (n.children?.length) withKids.push(n.path);
      for (const c of n.children || []) walk(c);
    };
    walk(root);
    const init = withKids.length <= AUTO_EXPAND_MAX ? withKids : withKids.filter((p) => !p.includes('/'));
    setExpanded(new Set(init));
    inited.current = true;
  }, [root]);

  useEffect(() => {
    if (!path) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const a of ancestorsOf(path)) {
        if (!next.has(a)) {
          next.add(a);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [path, ancestorsOf]);

  const toggle = (p) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  return { expanded, toggle };
}
