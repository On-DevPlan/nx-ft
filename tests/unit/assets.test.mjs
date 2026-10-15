// 资源业务测试：CRUD、改名（展示名 / 目录名）、标签归一化。
// 风格与编辑历史在 assets-styles.test.mjs。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as groups from '../../src/core/assets/groups.js';
import * as assets from '../../src/core/assets/assets.js';
import * as assetStyles from '../../src/core/assets/styles.js';
import { buildAssetDetail } from '../../src/core/svg/board.js';
import { sandbox } from './sandbox.mjs';

test('资源：创建带首风格，add 到不存在分组报 notFound', () => {
  sandbox();
  groups.addGroup({ kind: 'html', group: 'ui/buttons' });
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

test('删除资源：含风格 blocked，force 删除', () => {
  sandbox();
  groups.addGroup({ kind: 'html', group: 'ui/buttons' });
  assets.createAsset({ kind: 'html', group: 'ui/buttons', name: 'btn', style: 'minimal', code: { css: 'a' } });
  const blocked = assets.removeAsset({ kind: 'html', group: 'ui/buttons', name: 'btn' });
  assert.equal(blocked.status, 'blocked');
  const forced = assets.removeAsset({ kind: 'html', group: 'ui/buttons', name: 'btn', force: true });
  assert.equal(forced.status, 'ok');
  assert.throws(() => assets.loadAsset({ kind: 'html', group: 'ui/buttons', name: 'btn' }), /资源不存在/);
});

test('资源改名：--label 改展示名、--to 改目录名，内容与历史不动', () => {
  sandbox();
  groups.addGroup({ kind: 'html', group: 'ui/buttons' });
  assets.createAsset({
    kind: 'html',
    group: 'ui/buttons',
    name: 'old-name',
    style: 'minimal',
    code: { css: 'a{}' },
  });
  assetStyles.saveCode({
    kind: 'html',
    group: 'ui/buttons',
    name: 'old-name',
    style: 'minimal',
    files: { css: 'b{}' },
  });

  // 只改展示名：目录名不动
  const r1 = assets.renameAsset({ kind: 'html', group: 'ui/buttons', name: 'old-name', label: '登录按钮' });
  assert.equal(r1.renamed, false);
  assert.equal(r1.name, 'old-name');
  assert.equal(r1.label, '登录按钮');

  // 只改目录名：内容与编辑历史跟着目录一起搬
  const r2 = assets.renameAsset({ kind: 'html', group: 'ui/buttons', name: 'old-name', to: 'login-btn' });
  assert.equal(r2.renamed, true);
  assert.equal(r2.name, 'login-btn');
  const a = assets.loadAsset({ kind: 'html', group: 'ui/buttons', name: 'login-btn', code: true });
  assert.equal(a.code.minimal.css, 'b{}');
  assert.equal(a.styles[0].historyCount, 1);
  assert.equal(a.label, '登录按钮'); // 没给 label，保留原展示名

  // 树里的键同步改了，旧名字查不到
  assert.equal(groups.listTree('html').groups[0].assets[0].name, 'login-btn');
  assert.throws(
    () => assets.loadAsset({ kind: 'html', group: 'ui/buttons', name: 'old-name' }),
    /资源不存在/
  );

  // 重名 → blocked，不覆盖
  assets.createAsset({ kind: 'html', group: 'ui/buttons', name: 'taken' });
  assert.equal(
    assets.renameAsset({ kind: 'html', group: 'ui/buttons', name: 'login-btn', to: 'taken' }).status,
    'blocked'
  );

  // 还没有风格的资源（连目录都还没建）也必须能改名——
  // 「先建资源、稍后再写代码」是常见顺序，改名不能假定目录已存在
  assets.createAsset({ kind: 'html', group: 'ui/buttons', name: 'no-style-yet' });
  const r3 = assets.renameAsset({
    kind: 'html',
    group: 'ui/buttons',
    name: 'no-style-yet',
    to: 'renamed-empty',
  });
  assert.equal(r3.renamed, true);
  assert.equal(r3.label, 'renamed-empty');
  assert.equal(assets.loadAsset({ kind: 'html', group: 'ui/buttons', name: 'renamed-empty' }).styles.length, 0);
});

test('标签：归一化（小写/空白转-）/ 去重 / 添加 / 移除 / 非法拒绝', () => {
  sandbox();
  groups.addGroup({ kind: 'html', group: 'ui/buttons' });
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

// 主描述曾经「只写不读」：setAssetDesc 把 desc 存进了资源条目，但 buildAssetDetail
// 只返回 styles[].desc（每个风格的），漏了资源级的主描述 —— 前端 data.desc 恒为
// undefined，于是「填写描述 → 保存」写盘明明成功了，界面却一直显示「还没有主描述」。
// 这条测试盯的就是「写进去的，必须能从详情接口读回来」。
test('主描述：写进去后 buildAssetDetail 要带回来（资源级与风格级是两个字段）', () => {
  sandbox();
  groups.addGroup({ kind: 'svg', group: 'icons/nav' });
  assets.createAsset({ kind: 'svg', group: 'icons/nav', name: 'clock', style: 'default' });

  // 没写时返回空串而不是 undefined —— 前端靠它判断要不要显示「还没有主描述」占位
  assert.equal(buildAssetDetail('svg', { group: 'icons/nav', name: 'clock' }).desc, '');

  assets.setAssetDesc({ kind: 'svg', group: 'icons/nav', name: 'clock', desc: '一只钟' });
  const d = buildAssetDetail('svg', { group: 'icons/nav', name: 'clock' });
  assert.equal(d.desc, '一只钟');
  // 互不串：主描述落在 d.desc，风格描述落在 d.styles[].desc
  assert.equal(d.styles[0].desc, '');
});
