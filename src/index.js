// 编程入口：供其他工具 / agent 以库方式调用。
//
// 库用方只需要三类东西：
//   1. 组件（src/components/*.jsx）—— thin binding over class contract
//   2. 清单（src/manifest/catalog.json）—— 预生成，agent 可直接读
//   3. 命令工具集（src/runtime/*）—— 与 CLI / HTTP 共享同一份 action
export * as store from './core/store.js';
export * as errors from './core/errors/index.js';
export * as studio from './modules/studio/service.js';
export { ACTIONS, MODULES } from './runtime/registry.js';
export { startServer } from './runtime/server.js';
export { runCli } from './runtime/cli.js';
export { buildCatalog } from './manifest/build.mjs';
