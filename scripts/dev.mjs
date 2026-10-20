// dev 启动器：一条命令起 vite + 后端 serve，一个 ctrl-c 一起退。
//
// 为什么需要它：`pnpm dev` 若只起 vite，后端得另开终端跑 dev:serve——
// 两边端口、生命周期、日志各自为政，关的时候还容易漏一个。
//
// 关键决策（照 A08-framework-runtime 的规范，别即兴发挥）：
//   1. vite ready 之后再起 serve —— 反过来 vite 的 ready 行会被 serve 早期噪音吞掉
//   2. 直接 spawn node 二进制，不走 `npm run` —— Windows 上调 npm.cmd 时参数会被
//      cmd.exe 重排/截断（`npm.cmd dev:serve` 会被理解成 npm 自己的 --silent 子命令）
//   3. vite 必须 --host 127.0.0.1 —— Node 18+ 默认监听 [::1]，curl 127.0.0.1 会 ECONNREFUSED
//   4. 一个 ctrl-c 关两个：任意信号都转发 SIGTERM 给子进程再自己退
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { probePanel, autoOpenEnabled, describeOccupant } from '../src/core/serve-port.js';
import { openBrowser } from '../src/core/open.js';
import { APP_NAME } from '../src/core/paths.js';

const ROOT = dirname(fileURLToPath(import.meta.url)).replace(/[\\/]scripts$/, '');
const NODE = process.execPath;

const BACKEND_PORT = Number(process.env.NX_FT_PORT) || 7869;
const VITE_PORT = Number(process.env.NX_FT_VITE_PORT) || 7870;

const VITE_BIN = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
if (!existsSync(VITE_BIN)) {
  console.error(`未找到 vite：${VITE_BIN}\n先跑 pnpm install。`);
  process.exit(1);
}

const children = [];
let shuttingDown = false;

function start(name, args, env) {
  const child = spawn(NODE, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    // Windows 上 node 可直接 spawn，不需要 shell —— 加了 shell 反而会重新引入参数重排
    shell: false,
  });
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(`\n[dev] ${name} 退出（code=${code}${signal ? ', signal=' + signal : ''}），一并关闭另一个。`);
    shutdown(code ?? 1);
  });
  children.push({ name, child });
  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const { child } of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 300);
}

// 等端口就绪：轮询直到不再 ECONNREFUSED。
// 通用实现（等任意端口）而非只等 vite——后端也可能需要等。
async function waitForPort(port, { tries = 60, gapMs = 250 } = {}) {
  const net = await import('node:net');
  for (let i = 0; i < tries; i++) {
    const ok = await new Promise((resolve) => {
      const sock = net.connect({ host: '127.0.0.1', port });
      sock.once('connect', () => {
        sock.destroy();
        resolve(true);
      });
      sock.once('error', () => {
        sock.destroy();
        resolve(false);
      });
      setTimeout(() => {
        sock.destroy();
        resolve(false);
      }, 400);
    });
    if (ok) return true;
    await new Promise((r) => setTimeout(r, gapMs));
  }
  return false;
}

// 起进程之前先查端口。
//
// 端口被占时子进程会立刻退出，而本脚本只会含糊地报「某个子进程退出了」——
// 用户看到的是「链路不通」，却完全找不到原因。实测踩过：上一次 serve 没退干净
// 占着 7869，新的 dev 一起来就崩，而报错一个字都没提端口。
// 提前查清、指名端口，比事后猜要省事得多。
async function portBusy(port) {
  const net = await import('node:net');
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', (e) => resolve(e.code === 'EADDRINUSE'));
    srv.once('listening', () => srv.close(() => resolve(false)));
    srv.listen(port, '127.0.0.1');
  });
}

// 端口被占且占着的不是自己的面板：中止，并把「谁占了、怎么查、怎么换端口」写清楚。
function abortBusyPort(port, label, occupant) {
  console.error(`[dev] 端口 ${port} 被占用（${label}），已中止。`);
  if (occupant) console.error(`      占用者: ${occupant}`);
  console.error('      多半是上一次的 nx-ft serve / pnpm dev 没退干净。');
  console.error(`      查占用进程:  netstat -ano | findstr :${port}     （Windows）`);
  console.error(`                   lsof -i :${port}                    （macOS / Linux）`);
  console.error(`      或换一组端口:  NX_FT_PORT=${BACKEND_PORT + 100} NX_FT_VITE_PORT=${VITE_PORT + 100} pnpm dev`);
  process.exit(1);
}

// 后端端口被占时先问一句「上面跑的是不是我」。
//
// 占着后端端口的最常见情况不是「有别的服务」，而是「我自己已经开着一个面板」
// （上次没退干净 / 手滑起了两个）。这种情况直接复用：不再 spawn 第二个 serve
// 子进程，把浏览器指过去，vite 的代理目标照旧指向这个端口即可。
let reuseBackend = false;
if (await portBusy(BACKEND_PORT)) {
  const panel = await probePanel(BACKEND_PORT, '127.0.0.1', 800);
  const occupant = panel && panel.app ? panel.app.name : null;
  if (occupant === APP_NAME) {
    console.log(`[dev] 后端端口 ${BACKEND_PORT} 上已经是本项目的面板，直接复用（不重复启动）。`);
    reuseBackend = true;
    if (autoOpenEnabled(false)) openBrowser(`http://127.0.0.1:${BACKEND_PORT}`);
  } else {
    abortBusyPort(BACKEND_PORT, '后端 serve', describeOccupant(occupant));
  }
}

// vite 端口被占 → 保持现状：vite 跑在 --strictPort 下没法复用，只能中止。
if (await portBusy(VITE_PORT)) {
  abortBusyPort(VITE_PORT, 'vite dev server', null);
}

start('vite', [VITE_BIN, '--host', '127.0.0.1', '--strictPort', '--port', String(VITE_PORT)]);
const ready = await waitForPort(VITE_PORT);

if (!ready) {
  console.error('[dev] vite 没起来（--strictPort：端口被占会直接失败），仍然启动后端；请检查上面的报错。');
} else {
  console.log(
    `\n[dev] vite 就绪 http://127.0.0.1:${VITE_PORT}  →  后端 http://127.0.0.1:${BACKEND_PORT}\n`
  );
}

// 后端已经被本项目的面板占着时不再起第二个 serve——复用即可。
if (!reuseBackend) {
  start('serve', [join(ROOT, 'bin', 'ft.mjs'), 'serve', '--no-open'], {
    NX_FT_PORT: String(BACKEND_PORT),
  });
}

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => shutdown(0));
}
process.stdin.on('close', () => shutdown(0));
