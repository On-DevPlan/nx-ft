// skill install --all：一次装齐随包 skill。
//
// 语义与 installGroup 是同一条铁律——**先无副作用预检，任一冲突就整批不落盘**。
// 理由：装了一半的分组比全没装更糟，用户看不出哪几个是新的、哪几个还是旧的；
// 宁可返回 conflict 让他加 --force 整批重来。
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

test('installAll：有一个已存在且有差异 → 整批 conflict，本地改动不被静默覆盖', async () => {
  const dir = await temp();
  try {
    const names = await skills.bundledSkillNames();
    assert.equal((await skills.installAll({ to: dir })).status, 'ok');

    const victim = join(dir, names[0], 'SKILL.md');
    const original = await readFile(victim, 'utf8');
    await writeFile(victim, original + '\n<!-- 本地改动 -->\n', 'utf8');

    const r = await skills.installAll({ to: dir });
    assert.equal(r.status, 'conflict');
    assert.equal(r.all, true);
    assert.equal(r.skills.length, 1, '只有被动过的那一个算冲突');
    assert.equal(r.skills[0].name, names[0]);
    assert.match(await readFile(victim, 'utf8'), /本地改动/, '冲突时一个文件都不许动');

    // 加 --force 才整批覆盖
    const forced = await skills.installAll({ to: dir, force: true });
    assert.equal(forced.status, 'ok');
    assert.equal(await readFile(victim, 'utf8'), original);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('命令层：name / --group / --all 三者互斥', async () => {
  await assert.rejects(() => action.run({ name: 'nx-ft', all: true }), /互斥/);
  await assert.rejects(() => action.run({ group: 'nx-ft', all: true }), /互斥/);
  await assert.rejects(() => action.run({ name: 'nx-ft', group: 'nx-ft' }), /互斥/);
});
