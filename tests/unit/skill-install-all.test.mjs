// skill install --all：一次装齐随包 skill，且**直接覆盖**。
//
// 与 installGroup 的差别是刻意的：--group 是「挑一组装」，仍走无副作用预检
// （任一冲突整批不落盘，让用户加 --force 决策）；--all 是「把本机装全并对齐包内版本」，
// 覆盖是其定义的一部分——否则得先 --all 看冲突、再 --all --force 重来，多一个来回。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as skills from '../../src/core/skills/index.js';
import skillModule from '../../src/modules/skill/index.js';

const action = skillModule.actions.find((a) => a.id === 'skill.install');
const temp = () => mkdtemp(join(tmpdir(), 'nxft-skillall-'));

test('installAll：把 assets 下所有 skill 一次装进 --to 目录', async () => {
  const dir = await temp();
  try {
    const names = await skills.bundledSkillNames();
    assert.ok(names.length > 1, '随包应有多个 skill（主 skill + 配套）');

    const r = await skills.installAll({ to: dir });
    assert.equal(r.status, 'ok');
    assert.equal(r.all, true);
    assert.deepEqual(r.skills.map((s) => s.name), names);
    // 每个 skill 都真的落到了盘上（不是只返回了个清单）
    assert.deepEqual((await readdir(dir)).sort(), [...names].sort());
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('installAll：幂等——已经是最新时全部 skipped', async () => {
  const dir = await temp();
  try {
    await skills.installAll({ to: dir });
    const again = await skills.installAll({ to: dir });
    assert.equal(again.status, 'ok');
    assert.ok(again.skills.every((s) => s.status === 'skipped'), '第二次应全部 skipped');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('installAll：本地有差异 → 直接覆盖（--all 的语义，不需要 --force）', async () => {
  const dir = await temp();
  try {
    const names = await skills.bundledSkillNames();
    assert.equal((await skills.installAll({ to: dir })).status, 'ok');

    const victim = join(dir, names[0], 'SKILL.md');
    const original = await readFile(victim, 'utf8');
    await writeFile(victim, original + '\n<!-- 本地改动 -->\n', 'utf8');

    const r = await skills.installAll({ to: dir });
    assert.equal(r.status, 'ok');
    assert.equal(r.all, true);
    // 被动过的那一个被 replaced；没动过的仍是 skipped
    const touched = r.skills.find((s) => s.name === names[0]);
    assert.equal(touched.replaced, true, '--all 恒覆盖，不走冲突预检');
    assert.equal(await readFile(victim, 'utf8'), original, '本地改动被包内版本替换');
    assert.ok(
      r.skills.filter((s) => s.name !== names[0]).every((s) => s.status === 'skipped'),
      '没动过的 skill 不该重装'
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('installGroup 仍保留冲突预检（--all 与 --group 语义不同）', async () => {
  const dir = await temp();
  try {
    const names = await skills.bundledSkillNames();
    const manifest = await skills.loadGroups();
    // 找任意一个含多个 skill 的 group；没有就跳过这条对照
    const multi = Object.entries(manifest.groups || {}).find(([, g]) => (g.skills || []).length > 1);
    if (!multi) return;

    await skills.installGroup(multi[0], { to: dir });
    const victim = join(dir, names[0], 'SKILL.md');
    const original = await readFile(victim, 'utf8');
    await writeFile(victim, original + '\n<!-- 本地改动 -->\n', 'utf8');

    const r = await skills.installGroup(multi[0], { to: dir });
    assert.equal(r.status, 'conflict', '--group 遇到差异仍是 conflict，不静默覆盖');
    assert.match(await readFile(victim, 'utf8'), /本地改动/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('命令层：name / --group / --all 三者互斥', async () => {
  await assert.rejects(() => action.run({ name: 'nx-ft', all: true }), /互斥/);
  await assert.rejects(() => action.run({ group: 'nx-ft', all: true }), /互斥/);
  await assert.rejects(() => action.run({ name: 'nx-ft', group: 'nx-ft' }), /互斥/);
});
