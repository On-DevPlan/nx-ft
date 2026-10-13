// 资产域单元测试：分组 / 资源 / 风格 / 编辑历史的全部业务规则。
// 每个用例独立临时目录（NX_FT_DATA 覆盖），绝不碰用户真实数据目录。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as groups from '../../src/core/assets/groups.js';
import * as assets from '../../src/core/assets/assets.js';
import * as assetStyles from '../../src/core/assets/styles.js';

function sandbox() {
  process.env.NX_FT_DATA = mkdtempSync(join(tmpdir(), 'nx-ft-assets-'));
}

test('分组：创建 / 重复跳过 / 树 / 非空删除 blocked / --force 删除', () => {
  sandbox();
  const r1 = groups.addGroup({ group: 'ui/buttons', label: '按钮' });
  assert.equal(r1.status, 'ok');
  const r2 = groups.addGroup({ group: 'ui/buttons' });
  assert.equal(r2.status, 'skipped');

  assets.createAsset({ kind: 'html', group: 'ui/buttons', name: 'login-btn' });
  const blocked = groups.removeGroup({ group: 'ui/buttons' });
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.assets, 1);

  const forced = groups.removeGroup({ group: 'ui/buttons', force: true });
  assert.equal(forced.status, 'ok');
  assert.equal(forced.removed.assets, 1);
  assert.equal(groups.listTree().count.groups, 0);
});

test('分组：多层路径（1~8 段）/ 超深拒绝 / 非法字符', () => {
  sandbox();
  // 多层是常态：中间层可只做目录（无清单），叶层建组
  assert.equal(groups.addGroup({ group: 'ui/buttons/primary' }).status, 'ok');
  assert.equal(groups.addGroup({ group: 'ui/buttons/primary/danger/lg' }).status, 'ok');
  assert.throws(() => groups.addGroup({ group: 'a/b/c/d/e/f/g/h/i' }), /1~8 段/);
  assert.throws(() => groups.addGroup({ group: '../x' }), /非法/);
  assert.throws(() => groups.addGroup({ group: '/x' }), /非法/);
  assert.equal(groups.addGroup({ group: 'a' }).status, 'ok');
});

test('多层分组：中间层与叶层可各自持有资源，树/筛选都能查到', () => {
  sandbox();
  groups.addGroup({ group: 'ui/buttons' });
  groups.addGroup({ group: 'ui/buttons/primary' });
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
  const rmLeaf = groups.removeGroup({ group: 'ui/buttons/primary', force: true });
  assert.equal(rmLeaf.status, 'ok');
  assert.equal(groups.listTree('html').groups.length, 1);
  groups.removeGroup({ group: 'ui/buttons', force: true });
  assert.equal(groups.listTree('html').count.groups, 0);
});

test('资源：创建带首风格，add 到不存在分组报 notFound', () => {
  sandbox();
  groups.addGroup({ group: 'ui/buttons' });
  const r = assets.createAsset({
    kind: 'html',
    group: 'ui/buttons',
    name: 'login-btn',
    label: '登录按钮',
    style: 'minimal',
    code: { html: '<b>x</b>' },
  });
  assert.equal(r.status, 'ok');
  const a = assets.loadAsset({ kind: 'html', group: 'ui/buttons', name: 'login-btn', code: true });
  assert.equal(a.label, '登录按钮');
  assert.equal(a.styles.length, 1);
  assert.equal(a.activeStyle, 'minimal');
  assert.equal(a.code.minimal.html, '<b>x</b>');
  assert.throws(
    () => assets.createAsset({ kind: 'html', group: 'no/such', name: 'x' }),
    /分组不存在/
  );
});

test('保存：改动前进入历史，无变化时 skipped', () => {
  sandbox();
  groups.addGroup({ group: 'ui/buttons' });
  assets.createAsset({ kind: 'html', group: 'ui/buttons', name: 'btn', style: 'minimal', code: { css: 'a{}' } });

  const s1 = assetStyles.saveCode({ kind: 'html', group: 'ui/buttons', name: 'btn', style: 'minimal', files: { css: 'b{}' } });
  assert.equal(s1.status, 'ok');
  assert.equal(s1.historyCount, 1);

  const skip = assetStyles.saveCode({ kind: 'html', group: 'ui/buttons', name: 'btn', style: 'minimal', files: { css: 'b{}' } });
  assert.equal(skip.status, 'skipped');

  const hist = assetStyles.listHistory({ kind: 'html', group: 'ui/buttons', name: 'btn', style: 'minimal' });
  assert.equal(hist.history.length, 1);
  const snap = assetStyles.readHistory({
    kind: 'html',
    group: 'ui/buttons',
    name: 'btn',
    style: 'minimal',
    entry: hist.history[0].id,
  });
  assert.equal(snap.code.css, 'a{}'); // 改动前的状态
});

test('历史：最多保留 5 条，第 6 次保存淘汰最旧', () => {
  sandbox();
  groups.addGroup({ group: 'ui/buttons' });
  assets.createAsset({ kind: 'html', group: 'ui/buttons', name: 'btn', style: 'minimal', code: { css: 'v0' } });
  for (let i = 1; i <= 6; i++) {
    assetStyles.saveCode({ kind: 'html', group: 'ui/buttons', name: 'btn', style: 'minimal', files: { css: 'v' + i } });
  }
  const hist = assetStyles.listHistory({ kind: 'html', group: 'ui/buttons', name: 'btn', style: 'minimal' });
  assert.equal(hist.history.length, 5);

  const current = assets.loadAsset({ kind: 'html', group: 'ui/buttons', name: 'btn', code: true });
  assert.equal(current.code.minimal.css, 'v6');
});

test('历史恢复：写回快照，当前状态再入历史，恢复可再回滚', () => {
  sandbox();
  groups.addGroup({ group: 'ui/buttons' });
  assets.createAsset({ kind: 'html', group: 'ui/buttons', name: 'btn', style: 'minimal', code: { css: 'old' } });
  assetStyles.saveCode({ kind: 'html', group: 'ui/buttons', name: 'btn', style: 'minimal', files: { css: 'new' } });

  const h1 = assetStyles.listHistory({ kind: 'html', group: 'ui/buttons', name: 'btn', style: 'minimal' });
  const restore = assetStyles.restoreHistory({
    kind: 'html',
    group: 'ui/buttons',
    name: 'btn',
    style: 'minimal',
    entry: h1.history[0].id,
  });
  assert.equal(restore.status, 'ok');

  const after = assets.loadAsset({ kind: 'html', group: 'ui/buttons', name: 'btn', code: true });
  assert.equal(after.code.minimal.css, 'old');

  // 恢复后又产生一条历史（= 上次的 new），再恢复可回到 new
  const h2 = assetStyles.listHistory({ kind: 'html', group: 'ui/buttons', name: 'btn', style: 'minimal' });
  assetStyles.restoreHistory({
    kind: 'html',
    group: 'ui/buttons',
    name: 'btn',
    style: 'minimal',
    entry: h2.history[0].id,
  });
  const back = assets.loadAsset({ kind: 'html', group: 'ui/buttons', name: 'btn', code: true });
  assert.equal(back.code.minimal.css, 'new');
});

test('风格：不限数量、复制、切换、删除后回落', () => {
  sandbox();
  groups.addGroup({ group: 'ui/buttons' });
  assets.createAsset({ kind: 'html', group: 'ui/buttons', name: 'btn', style: 's0', code: { css: 'base' } });

  // 远超过「5」个风格都要允许——5 是历史的上限，不是风格的上限
  for (let i = 1; i <= 8; i++) {
    const r = assetStyles.addStyle({ kind: 'html', group: 'ui/buttons', name: 'btn', style: 's' + i, copyFrom: 's0' });
    assert.equal(r.status, 'ok');
  }
  const styles = assetStyles.listStyles({ kind: 'html', group: 'ui/buttons', name: 'btn' });
  assert.equal(styles.styles.length, 9);
  assert.equal(styles.styles.find((s) => s.name === 's8').slot, 'css');

  assetStyles.setActiveStyle({ kind: 'html', group: 'ui/buttons', name: 'btn', style: 's5' });
  const switched = assetStyles.removeStyle({ kind: 'html', group: 'ui/buttons', name: 'btn', style: 's5' });
  assert.equal(switched.status, 'ok');
  assert.notEqual(switched.activeStyle, 's5');
});

test('删除资源：含风格 blocked，force 删除', () => {
  sandbox();
  groups.addGroup({ group: 'ui/buttons' });
  assets.createAsset({ kind: 'html', group: 'ui/buttons', name: 'btn', style: 'minimal', code: { css: 'a' } });
  const blocked = assets.removeAsset({ kind: 'html', group: 'ui/buttons', name: 'btn' });
  assert.equal(blocked.status, 'blocked');
  const forced = assets.removeAsset({ kind: 'html', group: 'ui/buttons', name: 'btn', force: true });
  assert.equal(forced.status, 'ok');
  assert.throws(() => assets.loadAsset({ kind: 'html', group: 'ui/buttons', name: 'btn' }), /资源不存在/);
});

test('树按 kind 隔离：html 与 svg 资源互不串树', () => {
  sandbox();
  groups.addGroup({ group: 'ui/mix' });
  assets.createAsset({ kind: 'html', group: 'ui/mix', name: 'page-hero' });
  assets.createAsset({ kind: 'svg', group: 'ui/mix', name: 'arrow' });

  const htmlTree = groups.listTree('html');
  assert.equal(htmlTree.count.assets, 1);
  assert.equal(htmlTree.groups[0].assets[0].name, 'page-hero');

  const svgTree = groups.listTree('svg');
  assert.equal(svgTree.count.assets, 1);
  assert.equal(svgTree.groups[0].assets[0].name, 'arrow');
});

test('风格描述：addStyle 带 desc / 设置 / 清除 / 超长拒绝', () => {
  sandbox();
  groups.addGroup({ group: 'ui/buttons' });
  assets.createAsset({ kind: 'html', group: 'ui/buttons', name: 'btn', style: 'minimal' });

  assetStyles.addStyle({
    kind: 'html',
    group: 'ui/buttons',
    name: 'btn',
    style: 'glass',
    desc: '  玻璃拟态，主色紫  ',
  });
  let a = assets.loadAsset({ kind: 'html', group: 'ui/buttons', name: 'btn' });
  assert.equal(a.styles.find((s) => s.name === 'glass').desc, '玻璃拟态，主色紫');

  const set = assetStyles.setStyleDesc({
    kind: 'html',
    group: 'ui/buttons',
    name: 'btn',
    style: 'glass',
    text: '改用更深的紫',
  });
  assert.equal(set.desc, '改用更深的紫');

  const cleared = assetStyles.setStyleDesc({
    kind: 'html',
    group: 'ui/buttons',
    name: 'btn',
    style: 'glass',
    text: '',
  });
  assert.equal(cleared.desc, '');
  a = assets.loadAsset({ kind: 'html', group: 'ui/buttons', name: 'btn' });
  assert.equal(a.styles.find((s) => s.name === 'glass').desc, '');

  assert.throws(
    () => assetStyles.setStyleDesc({ kind: 'html', group: 'ui/buttons', name: 'btn', style: 'glass', text: 'x'.repeat(201) }),
    /最长 200 字符/
  );
  assert.throws(
    () => assetStyles.setStyleDesc({ kind: 'html', group: 'ui/buttons', name: 'btn', style: 'nope', text: 'x' }),
    /风格不存在/
  );
});

test('代码槽位校验：未知槽位报 badInput（防写错键名静默丢内容）', () => {
  sandbox();
  groups.addGroup({ group: 'ui/buttons' });
  assets.createAsset({ kind: 'html', group: 'ui/buttons', name: 'btn', style: 'minimal' });
  assert.throws(
    () => assetStyles.saveCode({ kind: 'html', group: 'ui/buttons', name: 'btn', style: 'minimal', files: { html5: 'x' } }),
    /未知代码槽位/
  );
});

test('标签：归一化（小写/空白转-）/ 去重 / 添加 / 移除 / 非法拒绝', () => {
  sandbox();
  groups.addGroup({ group: 'ui/buttons' });
  assets.createAsset({
    kind: 'html',
    group: 'ui/buttons',
    name: 'btn',
    tags: ['Button', 'LOGIN', '  毛玻璃  '],
  });
  const a0 = assets.loadAsset({ kind: 'html', group: 'ui/buttons', name: 'btn' });
  assert.deepEqual(a0.tags, ['button', 'login', '毛玻璃']);

  const add = assets.addTags({ kind: 'html', group: 'ui/buttons', name: 'btn', tags: ['button', 'dark'] });
  assert.equal(add.status, 'ok'); // button 已存在不重复加
  assert.deepEqual(add.added, ['dark']);
  assert.deepEqual(add.tags, ['button', 'login', '毛玻璃', 'dark']);

  const again = assets.addTags({ kind: 'html', group: 'ui/buttons', name: 'btn', tags: ['dark'] });
  assert.equal(again.status, 'skipped');

  const rm = assets.removeTags({ kind: 'html', group: 'ui/buttons', name: 'btn', tags: ['login', 'nope'] });
  assert.equal(rm.status, 'ok');
  assert.deepEqual(rm.removed, ['login']);
  assert.deepEqual(rm.tags, ['button', '毛玻璃', 'dark']);

  assert.throws(
    () => assets.addTags({ kind: 'html', group: 'ui/buttons', name: 'btn', tags: ['bad tag!'] }),
    /非法标签/
  );
  assert.throws(
    () => assets.addTags({ kind: 'html', group: 'ui/buttons', name: 'btn', tags: ['x'.repeat(25)] }),
    /最长 24 字符/
  );
});

test('筛选：tree 按标签（多选 AND）与关键词搜索（名称/分组/标签/风格名）', () => {
  sandbox();
  groups.addGroup({ group: 'ui/buttons' });
  groups.addGroup({ group: 'ui/cards' });
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
