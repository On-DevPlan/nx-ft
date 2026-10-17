// color 域的 zip 往返：单 data 槽（Palette JSON），复用「一资源一目录」（core/assets/set.js）。
// 从 zip.test.mjs 拆出——该文件随 html/svg 用例增长已逼近 max-lines，
// color 是独立的「域」，单开一份契约更清晰。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzipStore, zipStore } from '../../src/core/zip.js';
import * as assetSet from '../../src/core/assets/set.js';
import * as st from '../../src/core/assets/storage.js';
import { sandbox } from './sandbox.mjs';

const PALETTE = JSON.stringify({
  name: '主色板',
  harmony: null,
  colors: [
    { id: 'c1', hex: '#FFB0A5', weight: 1, locked: false, note: '', tags: [], createdAt: 1, updatedAt: 1 },
    { id: 'c2', hex: '#F385FF', weight: 1, locked: false, note: '', tags: [], createdAt: 1, updatedAt: 1 },
  ],
  sortBy: 'manual',
  createdAt: 1,
  updatedAt: 1,
});

test('color 调色板：zip 导入按目录成资源，data 槽 + label 取 Palette name', () => {
  sandbox();
  const zip = zipStore([
    { name: 'demo/primary/data', data: PALETTE },
    { name: 'readme.md', data: '不是资源' },
  ]);
  const r = assetSet.importZipBuffer({ kind: 'color', group: 'pal', zip, labelFrom: 'title' });
  assert.equal(r.total, 1);
  assert.equal(r.imported[0].name, 'primary');
  assert.deepEqual(r.imported[0].slots, ['data']);
  assert.equal(r.imported[0].label, '主色板', '展示名取 Palette JSON 的 name');

  assert.equal(st.readCodeFiles('color', 'pal', 'primary', 'default', ['data']).data, PALETTE);
});

test('color 调色板：pick 导出递归，再导入往返恒等', () => {
  sandbox();
  assetSet.importZipBuffer({
    kind: 'color',
    group: 'pal/demo',
    zip: zipStore([{ name: 'primary/data', data: PALETTE }]),
    labelFrom: 'title',
  });

  const z = assetSet.exportZip({ kind: 'color', pick: [{ type: 'dir', path: 'pal/demo' }] });
  assert.equal(z.count, 1);
  assert.deepEqual(unzipStore(z.buffer).map((e) => e.name), ['pal/demo/primary/data']);

  // 导出的包再导入到另一目录：data 逐字节一致、label 仍是 Palette name
  const back = assetSet.importZipBuffer({ kind: 'color', group: 'pal/copy', zip: z.buffer, labelFrom: 'title' });
  assert.equal(back.imported[0].label, '主色板');
  assert.equal(st.readCodeFiles('color', 'pal/copy', 'primary', 'default', ['data']).data, PALETTE);
});
