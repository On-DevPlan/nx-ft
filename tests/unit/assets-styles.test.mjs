// 风格与编辑历史测试：多风格并存、复制、切换、删除回落、历史 5 条上限与恢复。
// 历史是「改坏了能退回去」的唯一保障，所以上限与恢复都要钉住。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as groups from '../../src/core/assets/groups.js';
import * as assets from '../../src/core/assets/assets.js';
import * as assetStyles from '../../src/core/assets/styles.js';
import { sandbox } from './sandbox.mjs';

test('保存：改动前进入历史，无变化时 skipped', () => {
  sandbox();
  groups.addGroup({ kind: 'html', group: 'ui/buttons' });
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
  groups.addGroup({ kind: 'html', group: 'ui/buttons' });
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
  groups.addGroup({ kind: 'html', group: 'ui/buttons' });
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
  groups.addGroup({ kind: 'html', group: 'ui/buttons' });
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

test('风格描述：addStyle 带 desc / 设置 / 清除 / 超长拒绝', () => {
  sandbox();
  groups.addGroup({ kind: 'html', group: 'ui/buttons' });
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
  groups.addGroup({ kind: 'html', group: 'ui/buttons' });
  assets.createAsset({ kind: 'html', group: 'ui/buttons', name: 'btn', style: 'minimal' });
  assert.throws(
    () => assetStyles.saveCode({ kind: 'html', group: 'ui/buttons', name: 'btn', style: 'minimal', files: { html5: 'x' } }),
    /未知代码槽位/
  );
});
