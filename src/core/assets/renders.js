// CLI 人读渲染：tree / load 的输出较长且带筛选说明，独立成文件让 actions.js 保持薄。
// 数据形状与 core/assets/groups.js（listTree）和 assets.js（loadAsset）一致。
export function describeFilter(f) {
  const parts = [];
  if (f.search) parts.push(`搜索 "${f.search}"`);
  if (f.tags.length) parts.push('标签 ' + f.tags.map((t) => '#' + t).join(' + '));
  return parts.join('，');
}

export const fmtTags = (tags) => (tags || []).map((t) => '#' + t).join(' ') || '无';

export function renderTree(r, kind) {
  const filtered = r.filter.search || r.filter.tags.length;
  // 判据是**有没有分组**，不是有没有资源。
  // 刚建好分组、还没往里放东西，是这个工具最常见的中间状态；
  // 这时候回一句「还没有任何资源」等于告诉用户「你刚建的分组不见了」（真实踩过）。
  if (!r.groups.length) {
    return filtered
      ? `没有匹配的资源（共 ${r.total.assets} 个，条件: ${describeFilter(r.filter)}）`
      : `还没有任何分组（先建分组: nx-ft ${kind} group add <路径>）`;
  }
  const lines = [
    `共 ${r.count.groups} 组 / ${r.count.assets} 个资源` +
      (filtered ? `（筛选自 ${r.total.assets} 个）` : ''),
  ];
  for (const g of r.groups) {
    // 空分组也要列出来（并标明），否则列表数对不上、也不知道哪些还没放东西
    lines.push(`  ${g.path}/  (${g.label})${g.assets.length ? '' : '  暂无资源'}`);
    for (const a of g.assets) {
      const tagStr = a.tags.length ? '  ' + a.tags.map((t) => '#' + t).join(' ') : '';
      lines.push(
        `    ${a.name.padEnd(20)} ${a.styles} 风格  active: ${a.activeStyle || '-'}${tagStr}`
      );
    }
  }
  if (r.availableTags.length) {
    lines.push('', '标签: ' + r.availableTags.map((t) => `#${t.name}(${t.count})`).join(' '));
  }
  return lines.join('\n');
}

export function renderLoad(r, appName) {
  const lines = [`${r.group}/${r.name}  (${r.label})`];
  if (r.tags?.length) lines.push('  标签: ' + r.tags.map((t) => '#' + t).join(' '));
  for (const s of r.styles) {
    lines.push(
      `  ${s.name}${s.name === r.activeStyle ? ' *' : ''}  slot=${s.slot || '-'}  历史 ${s.historyCount}  更新 ${s.updatedAt || '-'}`
    );
    if (s.desc) lines.push(`      ${s.desc}`);
  }
  if (!r.styles.length) lines.push('  （还没有风格，用 style add 建一个）');
  lines.push('', `提示: 面板 ${appName} serve 可直接编辑与预览`);
  return lines.join('\n');
}
