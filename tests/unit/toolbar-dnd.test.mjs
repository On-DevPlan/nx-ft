// 工具栏编排排序内核（asset/toolbar-dnd.js + toolbar-modules.js）的单元测试。
// 面板负责「指针落在哪一行」，内核只管「落到某个位次怎么算」——这里测后者：
// 前插/后插、跨区挪位、末位落点、锁定项护栏、菜单项上栏、脏数据归一。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMenuOnly, moveModule, setFlag } from '../../src/web/frontend/components/asset/toolbar-dnd.js';
import { effZoneOf, isLocked, normalizeLayout } from '../../src/web/frontend/components/asset/toolbar-modules.js';

// 紧凑造布局：'crumbs>search>more>new'，'search@left' 指定区
function L(spec) {
  return spec.split('>').map((part) => {
    const [id, zone] = part.split('@');
    return zone ? { id, zone } : { id };
  });
}
const ids = (layout) => layout.map((x) => (x.zone ? `${x.id}@${x.zone}` : x.id)).join('>');

test('段内排序：向下拖时前插 / 后插按行的上/下半区分', () => {
  const base = L('a>b>c');
  // c 拖到 a 的上半 = 插到 a 之前
  assert.equal(ids(moveModule(base, { id: 'c', anchorId: 'a', after: false })), 'c>a>b');
  // c 拖到 a 的下半 = 插到 a 之后（老实现没有这个语义，只有「换到锚点位次」）
  assert.equal(ids(moveModule(base, { id: 'c', anchorId: 'a', after: true })), 'a>c>b');
});

test('段内排序：向上拖，插到锚点之后保持相对次序', () => {
  const base = L('a>b>c');
  // a 拖到 b 的下半 = 两者换位
  assert.equal(ids(moveModule(base, { id: 'a', anchorId: 'b', after: true })), 'b>a>c');
});

test('跨区挪位：zone 一并改写，另一区的相对次序不动', () => {
  const base = L('l1@left>l2@left>r1@right>r2@right');
  const next = moveModule(base, { id: 'l1', anchorId: 'r2', after: true, zone: 'right' });
  assert.equal(ids(next), 'l2@left>r1@right>r2@right>l1@right');
  assert.equal(effZoneOf(next.find((x) => x.id === 'l1')), 'right');
});

test('末位落点：不传锚点 = 该区末位；右区末位在主按钮之前', () => {
  const base = L('s@left>r1@right>new@right');
  const next = moveModule(base, { id: 's', zone: 'right' });
  assert.equal(ids(next), 'r1@right>s@right>new@right');
});

test('末位落点：空区（该区一个非锁定项都没有）落在数组头', () => {
  const base = L('r1@right>new@right');
  const next = moveModule(base, { id: 'r1', zone: 'left' });
  assert.equal(ids(next), 'r1@left>new@right');
});

test('锁定项护栏：拖主按钮原样返回；任何落点都不越过主按钮', () => {
  const base = L('a>b>new@right');
  assert.equal(moveModule(base, { id: 'new', anchorId: 'a' }), base); // 引用相等：没动
  const next = moveModule(base, { id: 'a', anchorId: 'new', after: true, zone: 'right' });
  assert.equal(ids(next), 'b>a@right>new@right'); // after 主按钮被夹回它之前
});

test('落回自己身上：anchorId === id，次序不变', () => {
  const base = L('a>b>c');
  assert.equal(ids(moveModule(base, { id: 'b', anchorId: 'b', after: true })), 'a>b>c');
});

test('不存在的 id：原样返回；不存在的锚点退到该区末位', () => {
  const base = L('a@left>b@right');
  assert.equal(moveModule(base, { id: 'ghost', anchorId: 'a' }), base);
  assert.equal(ids(moveModule(base, { id: 'a', anchorId: 'ghost', zone: 'right' })), 'b@right>a@right');
});

test('菜单项上栏：quick 一并置位', () => {
  const base = L('a@left>new@right>export'); // export 平时在菜单里，不在工具栏段
  const next = moveModule(base, { id: 'export', anchorId: 'a', after: true, zone: 'right', quick: true });
  assert.equal(ids(next), 'a@left>export@right>new@right');
  assert.equal(next.find((x) => x.id === 'export').quick, true);
});

test('setFlag / isMenuOnly：开关改写不挪位置', () => {
  const base = L('a>b');
  assert.deepEqual(setFlag(base, 'a', { quick: false }), [{ id: 'a', quick: false }, { id: 'b' }]);
  assert.equal(isMenuOnly({ id: 'export' }), true);                 // 菜单项、没快捷
  assert.equal(isMenuOnly({ id: 'export', quick: true }), false);   // 已上栏
  assert.equal(isMenuOnly({ id: 'search' }), false);                // 原生项不是菜单成员
});

test('normalizeLayout：锁定项扶正到末位、重复 id 只留第一条', () => {
  const out = normalizeLayout(L('new>a>b>new'));
  assert.equal(isLocked(out.at(-1).id), true);
  assert.equal(out.filter((x) => x.id === 'new').length, 1);
  assert.equal(ids(out), 'a>b>new');
});
