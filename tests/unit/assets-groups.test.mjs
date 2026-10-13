// 分组（目录）业务测试：建/改名/移动/删、多层路径、两棵独立的树、筛选。
// 目录是 kind 分开的两棵树——html 与 svg 各建各的，同名互不影响。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as groups from '../../src/core/assets/groups.js';
import * as assets from '../../src/core/assets/assets.js';
import { sandbox } from './sandbox.mjs';

test('分组：创建 / 重复跳过 / 树 / 非空删除 blocked / --force 删除', () => {
  sandbox();
  const r1 = groups.addGroup({ kind: 'html', group: 'ui/buttons', label: '按钮' });
  assert.equal(r1.status, 'ok');
  const r2 = groups.addGroup({ kind: 'html', group: 'ui/buttons' });
  assert.equal(r2.status, 'skipped');

  assets.createAsset({ kind: 'html', group: 'ui/buttons', name: 'login-btn' });
  const blocked = groups.removeGroup({ kind: 'html', group: 'ui/buttons' });
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.assets, 1);

  const forced = groups.removeGroup({ kind: 'html', group: 'ui/buttons', force: true });
  assert.equal(forced.status, 'ok');
  assert.equal(forced.removed.assets, 1);
  assert.equal(groups.listTree('html').count.groups, 0);
});

test('分组：多层路径（1~8 段）/ 超深拒绝 / 非法字符', () => {
  sandbox();
  // 多层是常态：中间层可只做目录（无清单），叶层建组
  assert.equal(groups.addGroup({ kind: 'html', group: 'ui/buttons/primary' }).status, 'ok');
  assert.equal(groups.addGroup({ kind: 'html', group: 'ui/buttons/primary/danger/lg' }).status, 'ok');
  assert.throws(() => groups.addGroup({ kind: 'html', group: 'a/b/c/d/e/f/g/h/i' }), /1~8 段/);
  assert.throws(() => groups.addGroup({ kind: 'html', group: '../x' }), /非法/);
  assert.throws(() => groups.addGroup({ kind: 'html', group: '/x' }), /非法/);
  assert.equal(groups.addGroup({ kind: 'html', group: 'a' }).status, 'ok');
});

test('多层分组：中间层与叶层可各自持有资源，树/筛选都能查到', () => {
  sandbox();
  groups.addGroup({ kind: 'html', group: 'ui/buttons' });
  groups.addGroup({ kind: 'html', group: 'ui/buttons/primary' });
  assets.createAsset({ kind: 'html', group: 'ui/buttons', name: 'mid-btn', tags: ['button'] });
  assets.createAsset({ kind: 'html', group: 'ui/buttons/primary', name: 'leaf-btn', tags: ['button', 'primary'] });

  const t = groups.listTree('html');
  assert.deepEqual(t.groups.map((g) => g.path), ['ui/buttons', 'ui/buttons/primary']);
  assert.equal(t.count.assets, 2);

  const deep = groups.listTree('html', { tags: ['primary'] });
  assert.equal(deep.groups.length, 1);
  assert.equal(deep.groups[0].path, 'ui/buttons/primary');
  assert.equal(deep.groups[0].assets[0].name, 'leaf-btn');

  // 删叶层后，中间层不受影响；再删中间层，空父目录链被清理
  const rmLeaf = groups.removeGroup({ kind: 'html', group: 'ui/buttons/primary', force: true });
  assert.equal(rmLeaf.status, 'ok');
  assert.equal(groups.listTree('html').groups.length, 1);
  groups.removeGroup({ kind: 'html', group: 'ui/buttons', force: true });
  assert.equal(groups.listTree('html').count.groups, 0);
});

test('html 与 svg 是两棵独立的目录树：同名分组各存各的，互不影响', () => {
  sandbox();
  // 两棵树各建同名分组——这正是分开的意义：同一个名字在两边可以有完全不同的含义
  groups.addGroup({ kind: 'html', group: 'ui/mix' });
  groups.addGroup({ kind: 'svg', group: 'ui/mix' });
  assets.createAsset({ kind: 'html', group: 'ui/mix', name: 'page-hero' });
  assets.createAsset({ kind: 'svg', group: 'ui/mix', name: 'arrow' });

  const htmlTree = groups.listTree('html');
  assert.equal(htmlTree.count.assets, 1);
  assert.deepEqual(htmlTree.groups.map((g) => g.path), ['ui/mix']);
  assert.equal(htmlTree.groups[0].assets[0].name, 'page-hero');

  const svgTree = groups.listTree('svg');
  assert.equal(svgTree.count.assets, 1);
  assert.equal(svgTree.groups[0].assets[0].name, 'arrow');

  // 只在 svg 树里建的分组，不会出现在 html 树里（老布局下这是做不到的）
  groups.addGroup({ kind: 'svg', group: 'icons/nav' });
  assert.equal(groups.listTree('svg').count.groups, 2);
  assert.equal(groups.listTree('html').count.groups, 1);

  // 删掉 svg 的 ui/mix，html 的同名分组与它的资源毫发无伤
  assert.equal(groups.removeGroup({ kind: 'svg', group: 'ui/mix', force: true }).status, 'ok');
  assert.equal(groups.listTree('svg').count.assets, 0);
  assert.equal(groups.listTree('html').count.assets, 1);

  // 在另一棵树里给不存在的分组建资源 → 报错，不会「串」过去
  assert.throws(
    () => assets.createAsset({ kind: 'svg', group: 'no/such', name: 'x' }),
    /分组不存在/
  );
});

test('分组改名 / 移动：目录与清单路径同步，资源与子分组跟着走', () => {
  sandbox();
  groups.addGroup({ kind: 'html', group: 'ui/buttons' });
  groups.addGroup({ kind: 'html', group: 'ui/buttons/primary' });
  assets.createAsset({
    kind: 'html',
    group: 'ui/buttons/primary',
    name: 'btn',
    style: 'minimal',
    code: { css: 'a{}' },
  });

  // 改名（同层）+ 换展示名
  const r1 = groups.renameGroup({ kind: 'html', group: 'ui/buttons', to: 'ui/actions', label: '操作' });
  assert.equal(r1.status, 'ok');
  assert.equal(r1.path, 'ui/actions');
  assert.equal(r1.label, '操作');
  assert.deepEqual(groups.listTree('html').groups.map((g) => g.path), [
    'ui/actions',
    'ui/actions/primary',
  ]);
  // 子分组里的资源内容跟着目录一起搬
  assert.equal(
    assets.loadAsset({ kind: 'html', group: 'ui/actions/primary', name: 'btn', code: true }).code.minimal.css,
    'a{}'
  );

  // 移动（换父层）
  const r2 = groups.renameGroup({ kind: 'html', group: 'ui/actions/primary', to: 'ui/forms/primary' });
  assert.equal(r2.path, 'ui/forms/primary');
  assert.equal(
    assets.loadAsset({ kind: 'html', group: 'ui/forms/primary', name: 'btn', code: true }).code.minimal.css,
    'a{}'
  );

  // 不能移进自己的子树（否则目录会被搬进自己里面）
  assert.throws(
    () => groups.renameGroup({ kind: 'html', group: 'ui/actions', to: 'ui/actions/inner' }),
    /自己的子树/
  );

  // 目标已存在 → blocked，不覆盖别人的分组
  groups.addGroup({ kind: 'html', group: 'ui/a' });
  groups.addGroup({ kind: 'html', group: 'ui/b' });
  assert.equal(groups.renameGroup({ kind: 'html', group: 'ui/a', to: 'ui/b' }).status, 'blocked');

  // 改名只影响自己那棵树
  groups.addGroup({ kind: 'svg', group: 'old/icons' });
  groups.renameGroup({ kind: 'svg', group: 'old/icons', to: 'new/icons' });
  assert.deepEqual(groups.listTree('svg').groups.map((g) => g.path), ['new/icons']);
  assert.equal(groups.listTree('html').groups.some((g) => g.path === 'new/icons'), false);
});

test('筛选：tree 按标签（多选 AND）与关键词搜索（名称/分组/标签/风格名）', () => {
  sandbox();
  groups.addGroup({ kind: 'html', group: 'ui/buttons' });
  groups.addGroup({ kind: 'html', group: 'ui/cards' });
  assets.createAsset({ kind: 'html', group: 'ui/buttons', name: 'login-btn', tags: ['button', 'login'], style: 'minimal', code: { css: 'a{}' } });
  assets.createAsset({ kind: 'html', group: 'ui/buttons', name: 'ghost-btn', tags: ['button'] });
  assets.createAsset({ kind: 'html', group: 'ui/cards', name: 'profile-card', tags: ['card', 'login'] });

  const oneTag = groups.listTree('html', { tags: ['login'] });
  assert.equal(oneTag.count.assets, 2);
  assert.equal(oneTag.total.assets, 3); // total 是筛选前的总量

  const andTags = groups.listTree('html', { tags: ['button', 'login'] });
  assert.equal(andTags.count.assets, 1);
  assert.equal(andTags.groups[0].assets[0].name, 'login-btn');

  const byName = groups.listTree('html', { search: 'ghost' });
  assert.equal(byName.count.assets, 1);

  const byGroup = groups.listTree('html', { search: 'ui/cards' });
  assert.equal(byGroup.count.assets, 1);

  const byTagWord = groups.listTree('html', { search: 'card' });
  assert.equal(byTagWord.count.assets, 1);

  const byStyleName = groups.listTree('html', { search: 'minimal' });
  assert.equal(byStyleName.count.assets, 1);
  assert.equal(byStyleName.groups[0].assets[0].name, 'login-btn');

  // 标签聚合（不受筛选影响）与筛选命中并存
  assert.equal(oneTag.availableTags.find((t) => t.name === 'login').count, 2);
  const none = groups.listTree('html', { search: '不存在的词xyz' });
  assert.equal(none.count.assets, 0);
  assert.equal(none.groups.length, 0);
});
