// 工具栏编排：持久化（localStorage，key 形态与侧边栏 storageKey 同模式）。
// 持久化的是「{id, visible, quick?, zone?}」数组——数组次序 = bar 渲染次序。
//
// 本文件只管「存」：模块表与四项判定在 toolbar-modules.js（面板 / 栏渲染 / 排序内核
// 共用同一份），次序怎么变在 toolbar-dnd.js（纯函数）。这里只负责 load / 迁移 / 写回。
//
// 两类按钮、两个开关：
//   工具栏原生项（section top/primary）：visible 控制显隐，zone 控制左/右
//   「更多」菜单项（section more-*）：visible = 是否在菜单里；quick = 是否快捷显示在工具栏
//   两个开关相互独立：只挂工具栏 / 只在菜单 / 两边都有 / 都不显示，四种状态都合法。
//
// 注意 id 合并历史：原「batch（bar 版批量操作）」与「more-batch（菜单版）」是同一动作，
// 已合并为 more-batch 一个 id；老 layout 里的 batch / loc 字段在 load 时迁移。
import { useEffect, useState } from 'react';
import { MODULES, normalizeLayout } from './toolbar-modules.js';

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
        // 容错：未知 id 补尾（版本升级新增）、缺失的用默认；旧字段迁移；
        // 最后归一——锁定项扶到末位、重复 id 只留一条（手改过的脏数据先扶正，
        // 否则面板的插入位次（数组序）与栏的渲染次序会对不上）
        const migrated = migrate(s.filter((x) => x && x.id));
        const have = new Set(migrated.map((x) => x.id));
        const knownExtras = extraIds.filter((id) => !MODULES.some((m) => m.id === id));
        return normalizeLayout([
          ...migrated
            // noHide 模块（更多 / 主按钮）即使老数据是 visible:false，也强制可见
            .map((x) => (MODULES.find((m) => m.id === x.id && m.noHide) ? { ...x, visible: true } : x))
            .filter((x) => MODULES.some((m) => m.id === x.id) || extraIds.includes(x.id)),
          ...MODULES.filter((m) => !have.has(m.id)).map((m) => ({ id: m.id, visible: true })),
          ...knownExtras.filter((id) => !have.has(id)).map((id) => ({ id, visible: true })),
        ]);
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
