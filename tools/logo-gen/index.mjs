// LOGO 生成实现已下沉到 src/core/logo/（单一源）。
// 本文件保留为 re-export：`pnpm logo`（cli.mjs）与 nx-ft 的 logo 模块
// 共用同一套 schemes/generateAll，不会出现两份实现慢慢漂移。
export { SCHEMES, DEFAULT_SCHEME, listSchemes, resolveScheme } from '../../src/core/logo/schemes.js';
export { logoSvg, logoPng, generateAll, toRGB } from '../../src/core/logo/gen.js';
