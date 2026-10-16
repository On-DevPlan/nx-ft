// 资源排序（reorderAssets）的行为契约：同集合重排，写每个资源条目的 order 字段。
//
// 盯四件事：
//   1. 同集合重排 → ok，order 落到 manifest.assets[n].order = 0..n-1
//   2. 缺一个 / 多一个 / 重复 → badInput
//   3. 分组不存在 → notFound
//   4. 落盘后再读：listTree 输出的 order 与提交顺序一致
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reorderAssets, createAsset } from '../../src/core/assets/assets.js';
import { addGroup, listTree } from '../../src/core/assets/groups.js';
import * as st from '../../src/core/assets/storage.js';
import { sandbox } from './sandbox.mjs';

const CODE = { html: '<p>hi</p>', css: 'p{color:red}' };

function setup() {
  sandbox();
  addGroup({ kind: 'html', group: 'fr' });
}

test('reorderAssets：同集合重排，order 写到每条资源', () => {
  setup();
  createAsset({ kind: 'html', group: 'fr', name: 'a', style: 'default', code: CODE });
  createAsset({ kind: 'html', group: 'fr', name: 'b', style: 'default', code: CODE });
  createAsset({ kind: 'html', group: 'fr', name: 'c', style: 'default', code: CODE });

  const r = reorderAssets({ kind: 'html', group: 'fr', order: ['c', 'a', 'b'] });
  assert.equal(r.status, 'ok');
  assert.deepEqual(r.order, ['c', 'a', 'b']);

  const manifest = st.loadGroup('html', 'fr');
  assert.equal(manifest.assets.a.order, 1);
  assert.equal(manifest.assets.b.order, 2);
  assert.equal(manifest.assets.c.order, 0);
});

test('reorderAssets：listTree 透出 order 字段，供前端 byOrder 排序', () => {
  setup();
  for (const n of ['a', 'b', 'c']) createAsset({ kind: 'html', group: 'fr', name: n, style: 'default', code: CODE });
  reorderAssets({ kind: 'html', group: 'fr', order: ['c', 'a', 'b'] });

  const t = listTree('html');
  const fr = t.groups.find((g) => g.path === 'fr');
  assert.ok(fr);
  // listTree 不做排序（前端 byOrder 排），只验证 order 字段已透出且与提交一致
  const orderBy = (n) => fr.assets.find((a) => a.name === n).order;
  assert.equal(orderBy('c'), 0);
  assert.equal(orderBy('a'), 1);
  assert.equal(orderBy('b'), 2);
});

test('reorderAssets：缺少/多余/重复 → badInput，原状态不变', () => {
  setup();
  for (const n of ['a', 'b', 'c']) createAsset({ kind: 'html', group: 'fr', name: n, style: 'default', code: CODE });
  const before = JSON.stringify(st.loadGroup('html', 'fr').assets);

  assert.throws(() => reorderAssets({ kind: 'html', group: 'fr', order: ['a', 'b'] }), /缺少这些资源/); // 缺 c
  assert.throws(() => reorderAssets({ kind: 'html', group: 'fr', order: ['a', 'b', 'c', 'd'] }), /不存在的资源/); // 多 d
  assert.throws(() => reorderAssets({ kind: 'html', group: 'fr', order: ['a', 'b', 'b'] }), /重复的资源名/); // 重复
  assert.equal(JSON.stringify(st.loadGroup('html', 'fr').assets), before, '校验失败不应改清单');
});

test('reorderAssets：分组不存在 → notFound', () => {
  sandbox();
  assert.throws(() => reorderAssets({ kind: 'html', group: 'ghost', order: ['a'] }), /分组不存在/);
});

test('reorderAssets：order 为空数组 → badInput', () => {
  setup();
  assert.throws(() => reorderAssets({ kind: 'html', group: 'fr', order: [] }), /需要 --order/);
});
