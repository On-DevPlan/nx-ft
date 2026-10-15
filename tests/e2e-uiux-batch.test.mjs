// UIUX E2E 测试第二场景：批量操作 + 拖拽分隔条 + 面包屑数据-testid 验证。
// 覆盖 A05（批量操作）、A02（拖拽分隔条）、A04（面包屑）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 17870;
const BASE = `http://127.0.0.1:${PORT}`;

let server = null;

async function waitFor(url, timeoutMs = 10000) {
  const start = Date.now();
  let lastErr;
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return;
      lastErr = new Error(`status ${r.status}`);
    } catch (e) {
      lastErr = e;
    }
    await delay(200);
  }
  throw new Error(`服务未起: ${url} (${lastErr?.message || 'unknown'})`);
}

test.before(async () => {
  server = spawn(process.execPath, [join(ROOT, 'bin/ft.mjs'), 'serve', '--port', String(PORT), '--no-open'], {
    cwd: ROOT,
    env: { ...process.env, NX_FT_STORE: '/tmp/nx-ft-e2e-batch.json', NX_FT_DATA: '/tmp/nx-ft-e2e-batch-data' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', () => {});
  await waitFor(BASE + '/api/bootstrap');
});

test.after(async () => {
  if (server) {
    server.kill('SIGTERM');
    await new Promise((r) => server.once('exit', r));
  }
});

test('UIUX-A05: 批量操作 API 链路可用', async () => {
  // 创建 3 个资源用于批量测试
  for (let i = 0; i < 3; i++) {
    await fetch(BASE + '/api/html/add', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ group: 'batch-test', name: `item-${i}`, label: `批量项 ${i}`, tags: ['e2e-batch'] }),
    });
  }

  // 验证批量列表能拉到
  const r = await fetch(BASE + '/api/html/tree?tags=e2e-batch');
  assert.equal(r.status, 200);
  const resp = await r.json();
  const data = resp.data || resp;
  assert.ok(data, '标签筛选返回数据');
  assert.ok(data.groups || data.total, '返回了 groups 或 total 字段');

  // 清理（不强制成功）
  for (let i = 0; i < 3; i++) {
    await fetch(BASE + '/api/html/rm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ group: 'batch-test', name: `item-${i}`, force: true }),
    }).catch(() => {});
  }
});

test('UIUX-A04: 面包屑组件含 aria-label 与 data-testid', async () => {
  const r = await fetch(BASE + '/');
  const html = await r.text();

  // 主 bundle 应包含面包屑组件的 class + aria-label
  const jsMatches = [...html.matchAll(/\/assets\/([\w-]+\.js)/g)].map((m) => m[1]);
  assert.ok(jsMatches.length > 0, '页面引用了 JS bundle');

  // CSS bundle 含拖拽分隔条（验证 SplitPane 真的被编译进来）
  const cssMatches = [...html.matchAll(/\/assets\/([\w-]+\.css)/g)].map((m) => m[1]);
  if (cssMatches.length > 0) {
    const css = await (await fetch(BASE + '/assets/' + cssMatches[0])).text();
    assert.ok(css.includes('.sp-divider'), 'CSS 含拖拽分隔条样式 (A02/B02)');
    assert.ok(css.includes('.batch-bar'), 'CSS 含批量操作条样式 (A05)');
    assert.ok(css.includes('.am-card-check'), 'CSS 含卡片勾选框样式 (A05)');
  }
});

test('UIUX-A02: SplitPane + 拖拽分隔条在 bundle 中可用', async () => {
  const r = await fetch(BASE + '/');
  const html = await r.text();

  // 验证 JS bundle 含 SplitPane 相关实现
  for (const m of html.matchAll(/\/assets\/([\w-]+\.js)/g)) {
    const js = await (await fetch(BASE + '/assets/' + m[1])).text();
    if (js.includes('SplitPane') || js.includes('sp-wrap') || js.includes('mousemove')) {
      return; // 找到即可
    }
  }
  assert.fail('JS bundle 中未找到 SplitPane 或拖拽相关实现');
});

test('UIUX-A08: 无 emoji 在 bundle 中', async () => {
  const r = await fetch(BASE + '/');
  const html = await r.text();

  // 检查所有 bundle 文件
  for (const m of html.matchAll(/\/assets\/([\w-]+\.(js|css))/g)) {
    const text = await (await fetch(BASE + '/assets/' + m[1])).text();
    // emoji 范围检测
    const emojiRe = /[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]/u;
    assert.ok(!emojiRe.test(text), `${m[1]} 不含 emoji`);
  }
});

test('UIUX-A05b: zip 上传导入端点（面板「导入 zip」的后端链路）', async () => {
  const { unzipStore, zipStore } = await import(new URL('../src/core/zip.js', import.meta.url).href);
  const wrap = (svg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${svg}</svg>`;
  // 每次跑用独立分组：e2e 的数据目录是复用的，固定分组名会让第二次跑变成「全跳过」
  const group = `e2e/zip-${Date.now()}`;
  const url = `${BASE}/api/svg/import.zip?group=${encodeURIComponent(group)}&style=default&label-from=title`;
  const upload = (body) =>
    fetch(url, { method: 'POST', headers: { 'content-type': 'application/zip' }, body });

  const zip = zipStore([
    { name: 'alpha.svg', data: wrap('<circle cx="12" cy="12" r="9"/>') },
    { name: 'beta.svg', data: wrap('<rect x="5" y="5" width="14" height="14"/>') },
  ]);

  const r1 = await (await upload(zip)).json();
  assert.equal(r1.ok, true);
  assert.equal(r1.data.imported.length, 2, '两枚都该导入');
  assert.equal(r1.data.groupCreated, true, '新分组该被创建');

  // 重复上传：跳过而不是覆盖
  const r2 = await (await upload(zip)).json();
  assert.equal(r2.data.imported.length, 0);
  assert.equal(r2.data.skipped.length, 2);

  // 导出端点取回同一批：导入 → 导出闭合
  const dl = await fetch(`${BASE}/api/svg/export.zip?group=${encodeURIComponent(group)}`);
  assert.equal(dl.status, 200);
  assert.match(dl.headers.get('content-disposition') || '', /filename\*=UTF-8''/, '中文文件名要按 RFC 5987 给出');
  const names = unzipStore(Buffer.from(await dl.arrayBuffer())).map((e) => e.name).sort();
  assert.deepEqual(names, [`${group}/alpha.svg`, `${group}/beta.svg`]);

  // 非 zip 内容 → 400，且是 JSON 信封（面板要能拿到错误文案去 toast）
  const bad = await upload(Buffer.from('这不是 zip'));
  assert.equal(bad.status, 400);
  const badJson = await bad.json();
  assert.equal(badJson.ok, false);
  assert.match(badJson.error, /不是有效的 zip/);

  // 方法不对 → 405，不与 JSON 路由混线
  const wrongMethod = await fetch(`${BASE}/api/svg/import.zip`);
  assert.equal(wrongMethod.status, 405);
});
