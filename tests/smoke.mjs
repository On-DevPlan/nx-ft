// smoke 测试：在真实进程里跑通关键路径。
// 这些是「面板能起、命令能跑」的最小证明——比单元测试更接近用户实际体验。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BIN = join(ROOT, 'bin', 'se.mjs');

function run(cmdline, env = {}) {
  // execFile 不走 shell，必须把命令串拆成 token 数组——
  // 整串塞进去会被当成一个 argv 元素，CLI 侧报「未知命令」。
  return exec(process.execPath, [BIN, ...cmdline.split(' ').filter(Boolean)], {
    cwd: tmpdir(),
    env: { ...process.env, ...env },
  });
}

// 每个测试独立的 store，防写脏真实数据
function isolatedEnv() {
  const dir = mkdtempSync(join(tmpdir(), 'nx-se-smoke-'));
  // 用方括号 + 字符串字面量：TS 不会试图把 NX_SE 解析成标识符，
  // 生成器替换后仍得到合法的属性名（'NX_SE_STORE' → 'NX_SE_STORE'）。
  return { env: { ['NX_SE_STORE']: join(dir, 'store.json') }, dir };
}

test(`version 输出裸版本号（可被 V=$(nx-se version) 消费）`, async () => {
  const { stdout } = await run('version');
  assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/);
});

test('routes: 命令表含各域命令且带 HTTP 对照', async () => {
  const { stdout } = await run('routes --json');
  const r = JSON.parse(stdout);
  assert.ok(r.count >= 10, `至少 10 条命令（studio + skill），实际 ${r.count}`);
  const ids = r.routes.map((x) => x.id);
  for (const id of ['studio.bootstrap', 'studio.manifest', 'studio.packs', 'studio.component']) {
    assert.ok(ids.includes(id), `缺命令 ${id}`);
  }
});

test('health：命令表可生成、存储路径可达', async () => {
  const { env } = isolatedEnv();
  const { stdout } = await run('health --json', env);
  const r = JSON.parse(stdout);
  assert.equal(r.status, 'ok');
  assert.ok(r.commands >= 10);
  assert.ok(r.components >= 1, `至少有组件，实际 ${r.components}`);
  assert.ok(r.styles >= 1, `至少有风格包，实际 ${r.styles}`);
});

test('studio manifest: GET 整库目录（含 components 与 styles）', async () => {
  const { stdout } = await run('studio manifest --json');
  const r = JSON.parse(stdout);
  assert.ok(Array.isArray(r.components), 'manifest 应包含 components 数组');
  assert.ok(r.styles && typeof r.styles === 'object', 'manifest 应包含 styles 对象');
  const ids = r.components.map((c) => c.id);
  for (const id of ['btn', 'card', 'row', 'kv']) {
    assert.ok(ids.includes(id), `manifest 缺组件 ${id}`);
  }
});

test('studio component: GET 单件（spec + css + tokens）', async () => {
  const { stdout } = await run('studio component btn --json');
  const r = JSON.parse(stdout);
  assert.equal(r.id, 'btn');
  assert.ok(r.spec, 'component 应包含 spec');
  assert.ok(r.css, 'component 应包含 css');
  assert.ok(r.tokens, 'component 应包含 tokens');
});

test('studio doctor: 自检通过（spec ↔ css ↔ catalog 一致）', async () => {
  const { stdout } = await run('studio doctor --json');
  const r = JSON.parse(stdout);
  assert.equal(r.status, 'ok', `一致性自检发现问题:\n${(r.issues || []).join('\n')}`);
});
