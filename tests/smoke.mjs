// smoke 测试：生成的 CLI 在真实进程里跑通关键路径。
// 这些是「面板能起、命令能跑」的最小证明——比单元测试更接近用户实际体验。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BIN = join(ROOT, 'bin', 'ft.mjs');

// 每个用例独立存储，避免写脏用户真实目录，也避免用例间计数互相干扰
function run(cmdline, cwd = tmpdir(), opts = {}) {
  const dir = opts.assetsDir || mkdtempSync(join(tmpdir(), 'nx-ft-smoke-'));
  // execFile 不走 shell，必须把命令串拆成 token 数组——
  // 整串塞进去会被当成一个 argv 元素，CLI 侧报「未知命令」。
  return exec(process.execPath, [BIN, ...cmdline.split(' ').filter(Boolean)], {
    cwd,
    env: { ...process.env, NX_FT_STORE: join(dir, 'store.json'), NX_FT_DATA: dir },
  });
}

// stdin 版：多行内容走 heredoc 等价路径（spawnSync + input 直达 stdin，不经 shell）
function runStdin(args, input, assetsDir) {
  const dir = assetsDir || mkdtempSync(join(tmpdir(), 'nx-ft-smoke-'));
  const res = spawnSync(process.execPath, [BIN, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    input,
    env: { ...process.env, NX_FT_DATA: dir },
  });
  return { ...res, assetsDir: dir };
}

test('version 输出裸版本号（可被 V=$(nx-ft version) 消费）', async () => {
  const { stdout } = await run('version');
  assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/);
});

test('routes: 命令表含 bootstrap/health 且带 HTTP 对照', async () => {
  const { stdout } = await run('routes --json');
  const r = JSON.parse(stdout);
  assert.ok(r.count >= 8, `至少 8 条命令，实际 ${r.count}`);
  const ids = r.routes.map((x) => x.id);
  for (const id of ['home.bootstrap', 'home.health']) {
    assert.ok(ids.includes(id), `缺命令 ${id}`);
  }
});

test('health：自检通过', async () => {
  const r = JSON.parse((await run('health --json')).stdout);
  assert.equal(r.status, 'ok');
});

test('未知命令 exit 1', async () => {
  await assert.rejects(() => run('nope'));
});

test('skill list：含主 skill 与默认 group', async () => {
  const r = JSON.parse((await run('skill list --json')).stdout);
  assert.ok(r.skills.includes('nx-ft'), '缺主 skill');
  assert.equal(r.defaultGroup, 'nx-ft');
});

test('skill install：项目根安装注入路径，非项目目录拒绝', async () => {
  const to = mkdtempSync(join(tmpdir(), 'nx-ft-skill-'));
  const ok = JSON.parse(
    (await run(`skill install nx-ft --to ${to} --json`, ROOT)).stdout
  );
  assert.equal(ok.status, 'ok');

  const skill = readFileSync(join(to, 'nx-ft', 'SKILL.md'), 'utf8');
  assert.ok(skill.includes(ROOT.replace(/\\/g, '/')), '应注入项目根路径');
  assert.ok(!skill.includes('{{PROJECT_ROOT}}'), '不应残留安装期占位');
  assert.ok(!existsSync(join(to, 'nx-ft', 'hooks.json')), 'hooks.json 不复制');
  assert.ok(!existsSync(join(to, 'nx-ft', 'install')), 'install/ 不复制');

  const wrong = mkdtempSync(join(tmpdir(), 'nx-ft-wrong-'));
  await assert.rejects(
    () => run(`skill install nx-ft --to ${wrong} --json`, wrong),
    (err) => {
      // --json 模式下错误信封走 stdout（人读模式才走 stderr）
      const payload = JSON.parse(err.stdout);
      assert.match(payload.error, /项目根目录内安装/);
      return true;
    }
  );
});

test('资产冒烟：建分组/资源 → heredoc 写代码 → 风格复制 → 历史进栈', async () => {
  const group = runStdin(['html', 'group', 'add', 'ui/buttons', '--label', '按钮', '--json'], '');
  assert.equal(group.status, 0, group.stderr);
  const dir = group.assetsDir;

  const html = '<button class="btn">\n登录\n</button>';
  const add = runStdin(
    ['html', 'add', 'ui/buttons', 'login-btn', '--label', '登录按钮', '--style', 'minimal', '--code-html', '-', '--json'],
    html,
    dir
  );
  assert.equal(add.status, 0, add.stderr);

  // 第二种风格 + 改代码 → 历史自动进栈
  const style = runStdin(['html', 'style', 'add', 'ui/buttons', 'login-btn', 'dark', '--copy-from', 'minimal', '--json'], '', dir);
  assert.equal(style.status, 0, style.stderr);
  const put = runStdin(
    ['html', 'put', 'ui/buttons', 'login-btn', '--style', 'dark', '--code-css', '.btn{color:#fff}', '--json'],
    '',
    dir
  );
  assert.equal(put.status, 0, put.stderr);
  assert.equal(JSON.parse(put.stdout).historyCount, 1);

  const load = JSON.parse(runStdin(['html', 'load', 'ui/buttons', 'login-btn', '--json'], '', dir).stdout);
  assert.equal(load.activeStyle, 'dark');
  assert.equal(load.code.dark.html, html); // heredoc 多行内容逐字节保留
  assert.equal(load.styles.length, 2); // 风格数不受 5 限制

  const hist = JSON.parse(
    runStdin(['html', 'history', 'list', 'ui/buttons', 'login-btn', 'dark', '--json'], '', dir).stdout
  );
  assert.equal(hist.history.length, 1);

  // 标签：加标签 → 按标签筛选 tree → 按关键词搜索
  const tagAdd = runStdin(['html', 'tag', 'add', 'ui/buttons', 'login-btn', '--tags', 'button,login', '--json'], '', dir);
  assert.equal(tagAdd.status, 0, tagAdd.stderr);
  assert.deepEqual(JSON.parse(tagAdd.stdout).tags, ['button', 'login']);

  const byTag = JSON.parse(runStdin(['html', 'tree', '--tags', 'login', '--json'], '', dir).stdout);
  assert.equal(byTag.count.assets, 1);
  assert.deepEqual(byTag.groups[0].assets[0].tags, ['button', 'login']);
  assert.equal(byTag.availableTags.find((t) => t.name === 'login').count, 1);

  const noHit = JSON.parse(runStdin(['html', 'tree', '--tags', 'nope', '--json'], '', dir).stdout);
  assert.equal(noHit.count.assets, 0);

  const bySearch = JSON.parse(runStdin(['html', 'tree', '--search', '登录', '--json'], '', dir).stdout);
  assert.equal(bySearch.count.assets, 1);
});

test('资产冒烟：html 与 svg 树按类型隔离', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'nx-ft-smoke-'));
  await run('html group add ui/mix --json', tmpdir(), { assetsDir: dir });
  await run('html add ui/mix page-hero --json', tmpdir(), { assetsDir: dir });
  await run('svg add ui/mix arrow --json', tmpdir(), { assetsDir: dir });

  const htmlTree = JSON.parse((await run('html tree --json', tmpdir(), { assetsDir: dir })).stdout);
  const svgTree = JSON.parse((await run('svg tree --json', tmpdir(), { assetsDir: dir })).stdout);
  assert.deepEqual(htmlTree.groups[0].assets.map((a) => a.name), ['page-hero']);
  assert.deepEqual(svgTree.groups[0].assets.map((a) => a.name), ['arrow']);
});
