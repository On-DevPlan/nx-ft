// 编程入口：供其他工具 / agent 以库方式调用。
// 导出的是各模块的 service（业务真相源），不是 CLI/HTTP 壳——库用方自己组织 I/O。
export * as errors from './core/errors/index.js';

export * as home from './modules/home/service.js';

// 资产域的两个 kind（html / svg）共用 core/assets 的业务实现
export * as assetGroups from './core/assets/groups.js';
export * as assetStore from './core/assets/assets.js';
export * as assetStyles from './core/assets/styles.js';

// SVG 作为「图标集」的专属能力（规范 / 看板 / 审计 / 批量搬运）
export * as svgSpec from './core/svg/spec.js';
export * as svgBoard from './core/svg/board.js';
export * as svgAudit from './core/svg/audit.js';
export * as svgSet from './core/svg/set.js';

// LOGO 生成（脚本产图）
export * as logoGallery from './core/logo/gallery.js';

export { ACTIONS, MODULES } from './runtime/registry.js';
export { startServer } from './runtime/server.js';
export { runCli } from './runtime/cli.js';
