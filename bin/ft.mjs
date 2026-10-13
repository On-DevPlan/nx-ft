#!/usr/bin/env node
// nx-ft 唯一入口。
//
// 设计约定：Web 面板上每个按钮，都对应这里的一条 CLI 命令——二者由同一份 action
// 声明派生（见 src/modules/*/index.js），不是靠人维护两份清单。
import { migrateLegacyLayout } from '../src/core/assets/storage.js';
import { runCli } from '../src/runtime/cli.js';

// 一次性迁移：把「html/svg 共用一棵分组树」的老数据按 kind 分到两棵树。
//
// 放在进程入口而不是某个业务函数里——迁移必须是**每个进程只跑一次**的启动动作，
// 挂在被频繁调用的路径上就变成每次调用都去扫一遍目录。
// 幂等：老树已不在原位就什么都不做。
// 失败不阻断启动（宁可让用户照常跑，也不要因为一次迁移失败整个工具打不开），但会明确报出来。
try {
  const r = migrateLegacyLayout();
  if (r.migrated) {
    console.error(`[nx-ft] 已迁移分组存储（html / svg 分成两棵树）：${r.groups.join(', ')}`);
    console.error(`[nx-ft] 老数据留档在 ${r.archive}（确认无误后可自行删除）`);
  }
} catch (err) {
  console.error('[nx-ft] 分组存储迁移失败（已跳过，老数据未改动）：' + (err?.message || err));
}

runCli(process.argv.slice(2)).catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exitCode = 1;
});
