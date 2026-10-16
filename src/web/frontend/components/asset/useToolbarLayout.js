// 工具栏编排：模块表 + 持久化（localStorage，key 形态与侧边栏 storageKey 同模式）
// 持久化的是「{id, visible, quick?, zone?}」数组——数组次序 = bar 渲染次序。
//
// 两类按钮、两个开关：
//   工具栏原生项（section top/primary）：visible 控制显隐，zone 控制左/右
//   「更多」菜单项（section more-*）：visible = 是否在菜单里；quick = 是否快捷显示在工具栏右侧
//   两个开关相互独立：只挂工具栏 / 只在菜单 / 两边都有 / 都不显示，四种状态都合法。
//
// 注意 id 合并历史：原「batch（bar 版批量操作）」与「more-batch（菜单版）」是同一动作，
// 已合并为 more-batch 一个 id；老 layout 里的 batch / loc 字段在 load 时迁移。
import { useEffect, useState } from 'react';

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

const STORAGE_KEY = (kind) => `nx-ft-tb-${kind}`;

function defaultLayout(extraIds = []) {
  const ids = [...MODULES.map((m) => m.id), ...extraIds];
  return ids.map((id) => ({ id, visible: true }));
}

// 老 layout 兼容：
//   batch（bar 版批量）→ more-batch
//   loc 字段（旧位置模型）→ quick 开关（loc:'bar' 即快捷显示）
//   view-default / view-{id}（旧逐视图项）→ 合并为 views 单项（单选组）
function migrate(list) {
  const hasMoreBatch = list.some((x) => x.id === 'more-batch');
  const hasViews = list.some((x) => x.id === 'views');
  const isViewItem = (x) => x.id === 'view-default' || (typeof x.id === 'string' && x.id.startsWith('view-'));
  const viewItems = list.filter(isViewItem);
  const out = [];
  let viewsDone = hasViews;
  for (const raw of list) {
    if (isViewItem(raw)) {
      if (!viewsDone) {
        out.push({
          id: 'views',
          visible: viewItems.some((v) => v.visible !== false),
          quick: viewItems.some((v) => v.quick),
        });
        viewsDone = true;
      }
      continue; // 旧逐视图项一律丢弃
    }
    let item = { ...raw };
    if (item.id === 'batch') {
      if (hasMoreBatch || out.some((o) => o.id === 'more-batch')) continue;
      item = { id: 'more-batch', visible: item.visible };
    }
    if (item.loc !== undefined) {
      if (item.loc === 'bar') item.quick = true;
      delete item.loc;
    }
    out.push(item);
  }
  return out;
}

export function useToolbarLayout(kind, extraIds = []) {
  const [layout, setLayout] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY(kind)));
      if (Array.isArray(s)) {
        // 容错：未知 id 补尾（版本升级新增）、缺失的用默认；旧字段迁移
        const migrated = migrate(s.filter((x) => x && x.id));
        const have = new Set(migrated.map((x) => x.id));
        const knownExtras = extraIds.filter((id) => !MODULES.some((m) => m.id === id));
        const merged = [
          ...migrated
            // noHide 模块（更多 / 主按钮）即使老数据是 visible:false，也强制可见
            .map((x) => (MODULES.find((m) => m.id === x.id && m.noHide) ? { ...x, visible: true } : x))
            .filter((x) => MODULES.some((m) => m.id === x.id) || extraIds.includes(x.id)),
          ...MODULES.filter((m) => !have.has(m.id)).map((m) => ({ id: m.id, visible: true })),
          ...knownExtras.filter((id) => !have.has(id)).map((id) => ({ id, visible: true })),
        ];
        return merged;
      }
    } catch { /* 隐私模式或脏数据 → 走默认 */ }
    return defaultLayout(extraIds);
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY(kind), JSON.stringify(layout)); } catch { /* 隐私模式静默 */ }
  }, [layout, kind]);

  return {
    layout,
    setLayout,
    resetLayout: () => setLayout(defaultLayout(extraIds)),
  };
}
