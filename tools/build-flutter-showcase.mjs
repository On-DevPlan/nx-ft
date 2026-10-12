// build-flutter-showcase.mjs
// 一键重建 Flutter showcase 并覆盖到面板：
//   flutter build web --release → 修正 <base href> → 拷到 src/studio/public/flutter/
//
// 为什么不用 `flutter build web --base-href /flutter/`：Git Bash 在 Windows 上
// 会把 `/flutter/` 当文件系统路径吞掉，传不到 Flutter CLI；改成 build 后 sed
// 修正是最稳的等价做法，CI 也一样跑（无需关心 shell 转义）。

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)); // nx-ft/tools
const ROOT = resolve(HERE, '..'); // nx-ft（HERE 已在 tools/ 里，上退一级即仓库根）
const SHOWCASE = join(HERE, 'flutter-showcase');
const OUT = join(ROOT, 'src', 'studio', 'public', 'flutter');

// ROOT 定位守卫：错一次就会在仓库外建目录树（已踩过一次），这里先断言再干活
if (!existsSync(join(ROOT, 'package.json'))) {
  console.error(`✗ 仓库根定位失败：${ROOT} 下没有 package.json，请检查脚本 ROOT 计算`);
  process.exit(1);
}

function step(label, fn) {
  process.stdout.write(`▸ ${label} ... `);
  const t = Date.now();
  fn();
  console.log(`ok (${((Date.now() - t) / 1000).toFixed(1)}s)`);
}

// 1. flutter build web
step('flutter build web --release', () => {
  const r = spawnSync('flutter', ['build', 'web', '--release', '--pwa-strategy=none'], {
    cwd: SHOWCASE,
    stdio: 'inherit',
    shell: true,
  });
  if (r.status !== 0) throw new Error('flutter build failed');
});

// 2. 修正 <base href> + 注入早期路由捕获
//   - base href：iframe 在 /flutter/ 子路径下，相对资源要从此起算
//   - hxRoute：Flutter 的 URL 策略会在 main() 之前把 hash 归一化掉，这里在
//     framework 启动**之前**把完整 URL 存进 <html data-hx-route> 供 Dart 读
step('patch index.html (base href + early route capture)', () => {
  const idx = join(SHOWCASE, 'build', 'web', 'index.html');
  if (!existsSync(idx)) throw new Error('index.html not found');
  let html = readFileSync(idx, 'utf8');

  if (html.includes('<base href="/">')) {
    html = html.replace('<base href="/">', '<base href="/flutter/">');
  }
  const capture = '<script>document.documentElement.dataset.hxRoute = location.href;</script>';
  if (!html.includes('dataset.hxRoute')) {
    html = html.replace('<script src="flutter_bootstrap.js"', `${capture}\n  <script src="flutter_bootstrap.js"`);
  }
  writeFileSync(idx, html, 'utf8');
});

// 3. 覆盖到面板静态目录
step('copy build/web → src/studio/public/flutter', () => {
  const from = join(SHOWCASE, 'build', 'web');
  if (!existsSync(from)) throw new Error('build/web not found');
  rmSync(OUT, { recursive: true, force: true });
  cpSync(from, OUT, { recursive: true });
});

console.log(`\n✓ showcase dist 覆盖到 ${OUT}`);
console.log('  下一步：pnpm build 复制到 src/web/public，浏览器验证 iframe 渲染。');
