// 资源搬家（moveAsset）的行为契约：跨分组移动，风格与历史随资源目录整搬。
//
// 盯四件事：
//   1. 清单键迁移 + 代码目录整搬（两份 manifest 各自增删，一致）
//   2. 目标已有同名资源 → blocked（不覆盖）；同分组 → skipped（原地不动）
//   3. 目标分组不存在 → 报错（不静默建组——建组是显式动作）
//   4. 还没写过代码的资源（无目录）也能搬：只动清单键
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveAsset, createAsset } from '../../src/core/assets/assets.js';
import { addGroup } from '../../src/core/assets/groups.js';
import * as st from '../../src/core/assets/storage.js';
import { sandbox } from './sandbox.mjs';

const CODE = { html: '<p>hi</p>', css: 'p{color:red}' };

function setup() {
  sandbox();
  addGroup({ kind: 'html', group: 'fr' });
  addGroup({ kind: 'html', group: 'test' });
}

test('moveAsset：跨分组移动，清单键迁移 + 目录整搬', () => {
  setup();
  createAsset({ kind: 'html', group: 'fr', name: '01-clock', style: 'default', code: CODE });
  assert.ok(st.assetExists('html', 'fr', '01-clock'), '测试前置：源目录应已创建');

  const r = moveAsset({ kind: 'html', from: 'fr', name: '01-clock', to: 'test' });
  assert.equal(r.status, 'ok');
  assert.equal(st.loadGroup('html', 'fr').assets['01-clock'], undefined, '源清单不再有它');
  assert.ok(st.loadGroup('html', 'test').assets['01-clock'], '目标清单有它');
  assert.ok(st.assetExists('html', 'test', '01-clock'), '代码目录整搬（风格文件随资源走）');
  assert.equal(st.assetExists('html', 'fr', '01-clock'), false, '源目录不再存在');
});

test('moveAsset：目标已有同名 → blocked；同分组 → skipped', () => {
  setup();
  createAsset({ kind: 'html', group: 'fr', name: 'dup', style: 'default', code: CODE });
  createAsset({ kind: 'html', group: 'test', name: 'dup', style: 'default', code: CODE });
  const blocked = moveAsset({ kind: 'html', from: 'fr', name: 'dup', to: 'test' });
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.reason, '目标分组已有同名资源');

  const skipped = moveAsset({ kind: 'html', from: 'test', name: 'dup', to: 'test' });
  assert.equal(skipped.status, 'skipped');
});

test('moveAsset：目标分组不存在 → 报错（不静默建组）', () => {
  setup();
  createAsset({ kind: 'html', group: 'fr', name: 'solo', style: 'default', code: CODE });
  assert.throws(() => moveAsset({ kind: 'html', from: 'fr', name: 'solo', to: 'nowhere' }), /目标分组不存在/);
});

test('moveAsset：没写过代码的资源（无目录）也能搬——只动清单键', () => {
  setup();
  createAsset({ kind: 'html', group: 'fr', name: 'bare' }); // 不给 style → 无目录
  assert.equal(st.assetExists('html', 'fr', 'bare'), false, '测试前置：确实没有目录');
  const r = moveAsset({ kind: 'html', from: 'fr', name: 'bare', to: 'test' });
  assert.equal(r.status, 'ok');
  assert.ok(st.loadGroup('html', 'test').assets['bare'], '清单键迁移到位');
});
