// 工具栏模块表 + 「这一项长什么样」的四个判定。
//
// 为什么单独一个文件：面板（toolbar-layout-panel）与栏渲染（manage-bar）必须对
// 同一份判定达成一致（谁在菜单里、谁落左区、谁恒末位）——判定只此一处，两处各写
// 一份迟早分叉。再者排序内核（toolbar-dnd）要能在 node 里被单测，import 链上
// 不能牵进 react，本文件因此零依赖。
export const MODULES = [
  // 工具栏原生项
  { id: 'crumbs', label: '面包屑', sub: '导航路径',                 section: 'top', zone: 'left' },
  { id: 'search', label: '搜索',   sub: '名称 / 分组 / 标签 / 风格', section: 'top', zone: 'right' },
  // 「更多」是结构性按钮（菜单的入口），不能隐藏；noHide 锁死。里面的项独立配显隐。
  { id: 'more',   label: '更多',   sub: '菜单入口（视图 / 批量 / 目录）', section: 'top', zone: 'right', noHide: true },

  // 主按钮
  { id: 'new',    label: '+ 新建',   sub: '主按钮 · 恒在末位',
    section: 'primary', zone: 'right', lockLast: true, primary: true, noHide: true },

  // 「更多」菜单项（visible=在菜单里；quick=快捷显示在工具栏）
  // 视图是单选组（列表/画廊互斥），合并为一项：quick 开启时工具栏出现单选下拉。
  { id: 'views',            label: '视图',           sub: '列表 / 画廊等，单选切换',            section: 'more-view' },
  // 域动作 = 各域通过 toolbar 插槽注入的专项功能（svg：自检 / 归一化；color：Studio）。
  // 与下面「批量操作」（进入多选模式）是两回事，名字别都叫批量。
  { id: 'more-batch-extra', label: '域动作',         sub: '当前域特有的功能（svg：自检/归一化；color：Studio）', section: 'more-batch' },
  { id: 'export',           label: '导出 zip',       sub: '整目录或选中项',                    section: 'more-batch' },
  { id: 'import',           label: '导入 zip',       sub: '落当前目录',                        section: 'more-batch' },
  { id: 'more-batch',       label: '批量操作',       sub: '进入多选模式（全选/反选/导出选中/删除）', section: 'more-dir' },
  { id: 'more-rename',      label: '改名 / 移动',    sub: '仅在子目录时显示',                  section: 'more-dir' },
  { id: 'more-remove',      label: '删除当前文件夹', sub: '仅在子目录时显示',                  section: 'more-dir' },
];

const META = Object.fromEntries(MODULES.map((m) => [m.id, m]));
export const metaOf = (id) => META[id] || {};

// 「更多」菜单成员（section more-*）：visible = 在菜单里，quick = 快捷显示到工具栏
export const isMenuItemId = (id) => String(metaOf(id).section || '').startsWith('more-');

// 落撑杆之前（左区）还是之后（右区）：layout 项的 zone 覆盖模块表默认
export const effZoneOf = (item) => item.zone || metaOf(item.id).zone || 'right';

// 是否出现在工具栏上：原生项看 visible，菜单项看 quick（两个开关相互独立）
export const onBarOf = (item) => (isMenuItemId(item.id) ? !!item.quick : item.visible !== false);

// 锁定位（主按钮「+ 新建」）：不可拖、不可挪区、不可隐、恒在末位
export const isLocked = (id) => !!metaOf(id).lockLast;

// 归一：锁定项一律排到末位、同 id 只留第一条。
// 手改过的 localStorage 与早期版本写入的数据都可能乱序，而面板的插入位次算的是
// 数组序、栏的渲染次序也是数组序——乱序数据会让「拖到末位」落错地方，先扶正。
export function normalizeLayout(list) {
  const head = [];
  const locked = [];
  const seen = new Set();
  for (const x of list) {
    if (!x || !x.id || seen.has(x.id)) continue;
    seen.add(x.id);
    (isLocked(x.id) ? locked : head).push(x);
  }
  return [...head, ...locked];
}
