// CLI 命令构造：把「当前页面上看到的这个资源」翻译成可以直接粘贴执行的一行命令。
//
// 这是「AI 通过 CLI 编辑」这条链路的可见面：面板上任何一个操作，用户（或 agent）
// 都能在同一个位置读到等价命令，不需要去翻 --help。命令本身由 action 声明派生
// （bootstrap.commands 里有全量），这里只补上「带具体参数」的那一层——
// 通用清单说「有 svg put」，这里说「对 ui/icons add-icon 的 default 风格怎么 put」。

const BIN = (name) => name || 'nx-ft';

// 分组路径可能带斜杠，作为单个位置参数传入即可（CLI 侧按一次解析）。
export function ref(group, name) {
  return [group, name].filter(Boolean).join(' ');
}

// 读 → 改 → 写回：agent 编辑图标的最小闭环，三条命令。
export function assetCommands(bin, { group, name, style, slot = 'svg' }) {
  const b = BIN(bin);
  const r = ref(group, name);
  const st = style ? ` --style ${style}` : '';
  return [
    { id: 'cat', label: '读源码', cmd: `${b} svg cat ${r}${st} --slot ${slot}` },
    { id: 'put', label: '写回（stdin）', cmd: `${b} svg put ${r}${st || ' --style default'} --code -` },
    { id: 'check', label: '规范自检', cmd: `${b} svg spec check ${group}` },
    { id: 'fix', label: '按规范修复', cmd: `${b} svg spec fix ${group}${st}` },
    { id: 'detail', label: '资源详情', cmd: `${b} svg detail ${r}` },
  ];
}

// 写回时的标准姿势：flag 必须在 <<'EOF' 之前，EOF 顶格且加引号（否则会被 shell 展开）。
export function heredocSnippet(bin, { group, name, style, svg }) {
  const b = BIN(bin);
  const r = ref(group, name);
  return [
    `${b} svg put ${r} --style ${style || 'default'} --code - <<'EOF'`,
    String(svg || '<svg …>…</svg>').trim(),
    'EOF',
  ].join('\n');
}

export function boardCommands(bin, { group } = {}) {
  const b = BIN(bin);
  return [
    { id: 'board', label: '看板', cmd: `${b} svg board` },
    { id: 'import', label: '批量导入', cmd: `${b} svg import ${group || '<组>'} --from <目录>` },
    { id: 'export', label: '批量导出', cmd: `${b} svg export ${group || ''}`.trim() + ' --to <目录>' },
    { id: 'check', label: '整库自检', cmd: `${b} svg spec check` },
  ];
}
