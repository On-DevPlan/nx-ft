// CLI 多行输入（stdin）测试：参数值 '-' 走 heredoc/管道。
//
// spawnSync + input 直达 stdin，不经过 shell——测的就是 CLI 自己的读取路径。
// 状态目录同样隔离到临时目录。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BIN = join(ROOT, 'bin', 'ft.mjs');

function runCli(args, { input, assetsDir } = {}) {
  const dir = assetsDir || mkdtempSync(join(tmpdir(), 'nx-ft-stdin-'));
  const res = spawnSync(process.execPath, [BIN, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    input: input === undefined ? '' : input,
    env: { ...process.env, NX_FT_DATA: dir },
  });
  return { ...res, assetsDir: dir };
}

test('--code-html - 从 stdin 读多行内容（含空行，逐字节保留）', () => {
  const a = runCli(['html', 'group', 'add', 'ui/buttons']);
  assert.equal(a.status, 0, a.stderr);

  const html = '<button>\n\n第二行\n</button>';
  const put = runCli(
    ['html', 'add', 'ui/buttons', 'btn', '--style', 'minimal', '--code-html', '-', '--json'],
    { input: html, assetsDir: a.assetsDir }
  );
  assert.equal(put.status, 0, put.stderr);

  const load = runCli(['html', 'load', 'ui/buttons', 'btn', '--json'], { assetsDir: a.assetsDir });
  const data = JSON.parse(load.stdout);
  assert.equal(data.code.minimal.html, html);
});

test('stdin 内容之后的 flag 不被吞（走 argv 时必丢的场景）', () => {
  const a = runCli(['html', 'group', 'add', 'ui/buttons']);
  const put = runCli(
    ['html', 'add', 'ui/buttons', 'btn', '--style', 's1', '--code-css', '-', '--code-js', 'console.log(1)'],
    { input: '.x{}', assetsDir: a.assetsDir }
  );
  assert.equal(put.status, 0, put.stderr);

  const load = runCli(['html', 'load', 'ui/buttons', 'btn', '--json'], { assetsDir: a.assetsDir });
  const data = JSON.parse(load.stdout);
  assert.equal(data.code.s1.css, '.x{}');
  assert.equal(data.code.s1.js, 'console.log(1)');
});

test('空 stdin 报 INVALID_INPUT 且不建记录', () => {
  const a = runCli(['html', 'group', 'add', 'ui/buttons']);
  const put = runCli(
    ['html', 'add', 'ui/buttons', 'bad', '--style', 'minimal', '--code-html', '-', '--json'],
    { input: '   \n', assetsDir: a.assetsDir }
  );
  assert.notEqual(put.status, 0);
  const payload = JSON.parse(put.stdout);
  assert.equal(payload.code, 'INVALID_INPUT');
  assert.match(payload.error, /stdin 为空/);

  const load = runCli(['html', 'load', 'ui/buttons', 'bad', '--json'], { assetsDir: a.assetsDir });
  assert.notEqual(load.status, 0); // 资源没被建出来
});

test('put 同样支持 -（编辑路径），改动前进历史', () => {
  const a = runCli(['html', 'group', 'add', 'ui/buttons']);
  runCli(['html', 'add', 'ui/buttons', 'btn', '--style', 'minimal', '--code-css', 'v1'], { assetsDir: a.assetsDir });
  const put = runCli(
    ['html', 'put', 'ui/buttons', 'btn', '--style', 'minimal', '--code-css', '-', '--json'],
    { input: 'v2\n', assetsDir: a.assetsDir }
  );
  assert.equal(put.status, 0, put.stderr);
  const r = JSON.parse(put.stdout);
  assert.equal(r.historyCount, 1);

  const load = runCli(['html', 'load', 'ui/buttons', 'btn', '--json'], { assetsDir: a.assetsDir });
  assert.equal(JSON.parse(load.stdout).code.minimal.css, 'v2');
});

test('CLI 与 HTTP 的两种键名（--code-* 与 body 短键）语义一致', async () => {
  // 这里直接对服务层断言：collectFiles 的映射由 action 层完成，
  // 用真实 action.run 走一遍「HTTP body 短键」路径，防止两条入口分叉。
  const { ACTIONS } = await import('../../src/runtime/registry.js');
  const tmp = mkdtempSync(join(tmpdir(), 'nx-ft-keys-'));
  process.env.NX_FT_DATA = tmp;

  const groupAdd = ACTIONS.find((a) => a.id === 'html.group.add');
  await groupAdd.run({ group: 'ui/buttons' }, { transport: 'http' });

  const add = ACTIONS.find((a) => a.id === 'html.add');
  await add.run(
    { group: 'ui/buttons', name: 'btn', style: 'minimal', html: '<b>h</b>', css: '.c{}', js: '1' },
    { transport: 'http' }
  );

  const load = ACTIONS.find((a) => a.id === 'html.load');
  const data = await load.run({ group: 'ui/buttons', name: 'btn' }, { transport: 'http' });
  assert.equal(data.code.minimal.html, '<b>h</b>');
  assert.equal(data.code.minimal.css, '.c{}');
  assert.equal(data.code.minimal.js, '1');
});
