// src/modules/color/index.js
//
// 色彩资源域：在 html/svg 共用的「资源 CRUD + 风格 + 历史」之上，追加
// color 作为「调色板集」才需要的能力——list 汇总、entry 增删、整组导出。
// data 槽位存一个 Palette JSON，CLI 可以直接读写。
//
// color.add 由 colorActions 重新声明（缺省 --style=default），所以从共享
// makeActions 里把 color.add 过滤掉，避免 id 冲突。
import { makeActions } from '../../core/assets/actions.js';
import { ASSET_KINDS } from '../../core/assets/constants.js';
import { colorActions } from '../../core/color/actions.js';

const shared = makeActions('color').filter((a) => a.id !== 'color.add' && a.id !== 'color.put');

export default {
  id: 'color',
  title: ASSET_KINDS.color.label,
  order: 12,
  actions: [...shared, ...colorActions()],
};
