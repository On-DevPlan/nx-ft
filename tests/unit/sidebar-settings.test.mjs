// 侧边栏「默认收起」设置（sidebar/settings.js）的单元测试。
// 两条设置三域共享一份（key 不带 kind），并带老 key（按域各存）的一次性迁移。
// settings.js 读 globalThis.localStorage，这里先 stub 再调。
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadDefault, saveDefault } from '../../src/web/frontend/components/sidebar/settings.js';

// 极简 localStorage 替身：get/set/remove + 直塞预置数据用
class MemStore {
  constructor(init = {}) { this.map = { ...init }; }
  getItem(k) { return k in this.map ? this.map[k] : null; }
  setItem(k, v) { this.map[k] = String(v); }
  removeItem(k) { delete this.map[k]; }
}

beforeEach(() => { globalThis.localStorage = new MemStore(); });

test('默认关：共享 key 没写过、也没有旧 key → false', () => {
  assert.equal(loadDefault('folders'), false);
  assert.equal(loadDefault('sidebar'), false);
});

test('写读一致：save 后 load 返回同值，且 key 不带 kind（三域共享的证据）', () => {
  saveDefault('folders', true);
  assert.equal(globalThis.localStorage.getItem('nx-ft-side--default-folders'), '1');
  assert.equal(loadDefault('folders'), true);
  saveDefault('folders', false);
  assert.equal(loadDefault('folders'), false);
  // 两条设置互不串
  saveDefault('sidebar', true);
  assert.equal(loadDefault('folders'), false);
  assert.equal(loadDefault('sidebar'), true);
});

test('迁移：旧 key（按域各存）任一为 1 → 开，搬进共享 key，旧键删除', () => {
  globalThis.localStorage = new MemStore({
    'nx-ft-side-svg--default-folders': '1',
    'nx-ft-side-html--default-folders': '0',
  });
  assert.equal(loadDefault('folders'), true);
  assert.equal(globalThis.localStorage.getItem('nx-ft-side--default-folders'), '1');
  assert.equal(globalThis.localStorage.getItem('nx-ft-side-svg--default-folders'), null);
  assert.equal(globalThis.localStorage.getItem('nx-ft-side-html--default-folders'), null);
});

test('迁移：旧 key 全为 0（或只有 0）→ 关，同样归位共享 key', () => {
  globalThis.localStorage = new MemStore({ 'nx-ft-side-color--default-folders': '0' });
  assert.equal(loadDefault('folders'), false);
  assert.equal(globalThis.localStorage.getItem('nx-ft-side--default-folders'), '0');
  assert.equal(globalThis.localStorage.getItem('nx-ft-side-color--default-folders'), null);
});

test('迁移只发生一次：共享 key 已在时旧键不参与判定', () => {
  globalThis.localStorage = new MemStore({
    'nx-ft-side--default-folders': '0',
    'nx-ft-side-svg--default-folders': '1',
  });
  assert.equal(loadDefault('folders'), false);
  assert.equal(globalThis.localStorage.getItem('nx-ft-side-svg--default-folders'), '1'); // 未被动过
});
