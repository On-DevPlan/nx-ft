// SVG 渲染域：在 html 共用的「资源 CRUD + 风格 + 历史」之上，追加 SVG 作为
// 「图标集」才需要的能力——看板、批量导入导出、规范审计与归一化、取源码。
//
// 专属能力全部声明在 core/svg/actions.js；共用部分仍与 html 逐条同构
// （tests/unit/registry.test.mjs 断言 svg ⊇ html）。
import { makeModule } from '../../core/assets/actions.js';
import { svgActions } from '../../core/svg/actions.js';

export default makeModule('svg', 11, svgActions());
