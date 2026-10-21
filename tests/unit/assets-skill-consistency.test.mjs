// assets/ 里的 skill 文档 ↔ 真实命令面的防漂移断言。
//
// 为什么要有这个文件：assets/ 随包发给用户侧 agent，文档里的命令一旦对不上
// 真实命令表，agent 照抄就是「不存在的命令」——**没有任何测试会红**（单向断言）。
// 这里从命令表（唯一的��相源）出发，反过来校验文档：
//   1. groups.json 里每个 skill 都有真实目录（防悬空安装项）
//   2. 文档 bash 块里每条 CLI 调用都真实存在（防命令改名/删除后文档滞留）
//   3. 文档里「N 条通用/专属命令」的数字与真实命令表一致（防数字腐烂）
//   4. 主 skill 三个域都出现（加第四域时不能忘了写引导）
//   5. color 域删色命令的 hex 是 flag 而不是位置参数（实测踩过的坑）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { commandTable } from '../../src/modules/home/commands.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const ASSETS = join(ROOT, 'assets');
const DOMAINS = ['html', 'svg', 'color'];

function mdFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir, { recursive: true })) {
    if (name.endsWith('.md')) out.push(join(dir, name));
  }
  return out;
}
const ALL_MD = mdFiles(ASSETS);

// 真实命令表：command 形如 "nx-ft color entry add"
const TABLE = (await commandTable()).map((r) => r.command);
const TOKENS = TABLE.map((c) => c.split(' ').filter(Boolean));

function isPrefixOfSomeCommand(tokens) {
  return TOKENS.some((t) => t.every((tok, i) => tokens[i] === tok));
}

// bash 代码块里属于本 CLI 的调用行
function cliLines(md) {
  const lines = [];
  const blocks = [...md.matchAll(/```bash\n([\s\S]*?)```/g)];
  for (const b of blocks) {
    const raw = b[1].split('\n');
    const joined = [];
    for (const line of raw) {
      if (joined.length && joined.at(-1).endsWith('\\')) {
        joined[joined.length - 1] = joined.at(-1).replace(/\\\s*$/, ' ') + line.trim();
      } else {
        joined.push(line);
      }
    }
    for (const line of joined) {
      const t = line.trim().replace(/^\$\s*/, '');
      if (t.startsWith('nx-ft ') || t.startsWith('node bin/ft.mjs ')) lines.push(t);
    }
  }
  return lines;
}

test('groups.json：每个 skill 都有真实目录（不允许悬空安装项）', () => {
  const groups = JSON.parse(readFileSync(join(ASSETS, 'groups.json'), 'utf8'));
  const seen = [];
  for (const [name, g] of Object.entries(groups.groups)) {
    assert.ok(g.skills.length, `group ${name} 没有任何 skill`);
    for (const s of g.skills) {
      seen.push(s);
      assert.ok(
        existsSync(join(ASSETS, s, 'SKILL.md')),
        `group ${name} 列了 ${s}，但 assets/${s}/SKILL.md 不存在——装这个 group 会装到空气`
      );
    }
  }
  assert.ok(seen.includes('nx-ft'), '主 skill 必须进 group');
  for (const d of DOMAINS) {
    assert.ok(
      seen.some((s) => s === `ft-${d}`),
      `域 ${d} 的配套 skill 没进 group——装了主 skill 却没有该域的协作层`
    );
  }
});

test('assets 文档里的 CLI 调用都真实存在于命令表', () => {
  const bad = [];
  for (const f of ALL_MD) {
    for (const line of cliLines(readFileSync(f, 'utf8'))) {
      const norm = line.replace(/^node bin\/ft\.mjs /, 'nx-ft ');
      const tokens = norm.split(' ').filter(Boolean);
      if (!isPrefixOfSomeCommand(tokens)) {
        bad.push(`${f.replace(ROOT + '\\', '')}: ${line}`);
      }
    }
  }
  assert.deepEqual(bad, [], '文档里的命令在命令表里不存在：\n' + bad.join('\n'));
});

test('「N 条通用 / 专属命令」的数字与真实命令表一致', () => {
  const sets = Object.fromEntries(
    DOMAINS.map((d) => [
      d,
      new Set(
        TABLE.filter((c) => c.startsWith(`nx-ft ${d} `))
          .map((c) => c.split(' ').slice(2).join(' '))
      ),
    ])
  );
  const common = [...sets.html].filter((x) => sets.svg.has(x) && sets.color.has(x));
  const colorOnly = [...sets.color].filter((x) => !common.includes(x));

  const claims = [];
  for (const f of ALL_MD) {
    const md = readFileSync(f, 'utf8');
    for (const m of md.matchAll(/(\d+)\s*条(.{0,6}?)命令/g)) {
      claims.push({ file: f.replace(ROOT + '\\', ''), n: Number(m[1]), near: m[2] });
    }
  }
  for (const c of claims) {
    if (/通用/.test(c.near)) {
      assert.equal(c.n, common.length, `${c.file}: 「${c.n} 条通用命令」与真实交集 ${common.length} 条不符`);
    }
    if (/专属/.test(c.near)) {
      assert.equal(c.n, colorOnly.length, `${c.file}: 「${c.n} 条专属命令」与真实 ${colorOnly.length} 条不符`);
    }
  }
  assert.ok(claims.length, '没抓到任何「N 条…命令」的说法——断言本身可能失效了');
});

test('主 skill 三个域都出现（槽位表 + 域特有命令表各一行）', () => {
  const main = readFileSync(join(ASSETS, 'nx-ft', 'SKILL.md'), 'utf8');
  for (const d of DOMAINS) {
    const rows = main.split('\n').filter((l) => l.startsWith(`| \`${d}\` |`));
    assert.ok(rows.length >= 2, `主 skill 里域 ${d} 只出现 ${rows.length} 行（应至少 2：槽位表 + 域特有命令表）`);
  }
  // URL 词汇那一节必须把三个域都点名——只写「#/<域>」而没列出有哪些域，
  // 就是当初第三域被漏掉时的那种写法
  const urlSection = main.split('## 用户贴了一个面板 URL 时怎么读')[1]?.split('\n## ')[0] ?? '';
  assert.ok(urlSection, '主 skill 里找不到「面板 URL」那一节');
  for (const d of DOMAINS) {
    assert.ok(urlSection.includes(d), `主 skill 的 URL 词汇节没点名 ${d} 域`);
  }
});

test('color 域删色命令：hex 是 flag 不是位置参数（实测踩过的坑）', () => {
  // 只查「真命令」：bash 代码块里的行 + 全文里以 nx-ft 开头的调用。
  // 散文里故意展示错误写法的反例（用来警告读者）不在此列。
  const HEXISH = /^["']?#[0-9A-Fa-f]{3,8}["']?$|^["']?<hex>["']?$/;
  const bad = [];
  for (const f of ALL_MD) {
    const md = readFileSync(f, 'utf8');
    const candidates = [
      ...cliLines(md).filter((l) => l.includes('color entry rm')),
      ...[...md.matchAll(/nx-ft color entry rm[^\n]*/g)].map((m) => m[0]),
    ];
    for (const line of candidates) {
      if (line.includes('会被 CLI 拒')) continue; // 反例说明（警告读者用的错误写法）
      const after = (line.split('color entry rm')[1] ?? '').trim();
      // 形状：<组> <调色板> <hex> —— 第三个位置参数是 hex 就说明写错位置了
      const positional = after.split(/\s+/).filter(Boolean);
      if (positional.length >= 3 && HEXISH.test(positional[2])) {
        bad.push(`${f.replace(ROOT + '\\', '')}: ${line.trim()}`);
      }
    }
  }
  assert.deepEqual(bad, [], 'color entry rm 的 hex 写成了位置参数（CLI 会报「多余的参数」）：\n' + bad.join('\n'));
});
