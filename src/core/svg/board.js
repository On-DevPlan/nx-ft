// 看板数据：一次调用把「整库 SVG 图标 + 规范审计结论」取齐，供面板看板直接渲染。
//
// 为什么单独成一层而不是让前端逐资源调 load：看板上百个图标会变成上百次请求，
// 而每次请求都要重扫目录。这里复用 groups.listTree 的同一套筛选（**不另写一份筛选逻辑**，
// 否则 CLI 与面板的「搜索结果」迟早不一致），再补上每个资源当前风格的 SVG 源码与审计。
import { loadAsset } from '../assets/assets.js';
import * as groups from '../assets/groups.js';
import * as st from '../assets/storage.js';
import { auditSvg, detectProfile, ICON_SPEC } from './spec.js';

const SLOTS = ['svg', 'css', 'js'];

function auditOf(svg) {
  if (!svg) {
    return {
      ok: false,
      issues: [
        {
          level: 'warn',
          code: 'no-code',
          message: '该资源还没有代码内容',
          hint: '用 svg put <组> <名> --style <风格> --code - 写入',
        },
      ],
      meta: null,
    };
  }
  // 档位按资源形态自动判定（auditSvg 默认 auto）：双色图标的点缀色、插画与动画的
  // 配色/线宽都是设计意图，不该被当成「写死了颜色」。档位规则见 spec.js 的 detectProfile。
  return auditSvg(svg);
}

export function buildBoard(kind, { search = '', tags = [] } = {}) {
  const tree = groups.listTree(kind, { search, tags });
  const stats = { icons: 0, compliant: 0, flagged: 0, issues: 0 };

  const out = tree.groups.map((g) => ({
    path: g.path,
    label: g.label,
    assets: g.assets.map((a) => {
      const style = a.activeStyle || null;
      const svg = style ? st.readCodeFiles(kind, g.path, a.name, style, SLOTS).svg || '' : '';
      const audit = auditOf(svg);
      stats.icons++;
      stats.issues += audit.issues.length;
      if (audit.issues.length) stats.flagged++;
      else stats.compliant++;
      const profile = svg ? detectProfile(svg) : 'line';
      return {
        name: a.name,
        label: a.label,
        tags: a.tags || [],
        styleCount: a.styles,
        activeStyle: style,
        updatedAt: a.updatedAt || null,
        bytes: audit.meta ? audit.meta.bytes : 0,
        svg,
        profile,
        audit: { ok: audit.ok, issues: audit.issues },
      };
    }),
  }));

  return {
    status: 'ok',
    root: tree.root,
    spec: ICON_SPEC,
    count: tree.count,
    total: tree.total,
    filter: tree.filter,
    availableTags: tree.availableTags,
    stats,
    groups: out,
  };
}

// 单个资源的「全风格」视图：资源页要做多风格并排对比，需要每个风格各自的源码 + 审计。
// desc 一并带出来——它是上游用来记「这套实现的特征」的字段（svg style desc 写），
// 多风格并排时正是最该显示的东西：光看名字看不出 alt 和 bold 差在哪。
export function buildAssetDetail(kind, { group, name }) {
  const asset = loadAsset({ kind, group, name, code: false });
  const styles = asset.styles.map((s) => {
    const code = st.readCodeFiles(kind, asset.group, asset.name, s.name, SLOTS);
    const svg = code.svg || '';
    const audit = auditOf(svg);
    return {
      name: s.name,
      slot: s.slot,
      desc: s.desc || '',
      updatedAt: s.updatedAt,
      historyCount: s.historyCount,
      svg,
      css: code.css || '',
      js: code.js || '',
      profile: svg ? detectProfile(svg) : 'line',
      audit: { ok: audit.ok, issues: audit.issues },
    };
  });
  const totalIssues = styles.reduce((n, s) => n + s.audit.issues.length, 0);
  return {
    status: 'ok',
    group: asset.group,
    name: asset.name,
    label: asset.label,
    tags: asset.tags,
    activeStyle: asset.activeStyle,
    spec: ICON_SPEC,
    styles,
    stats: { styles: styles.length, issues: totalIssues },
  };
}
