// 存储迁移测试：老布局（html/svg 共用一棵分组树）→ 新布局（按 kind 分成两棵）。
//
// 这个用例是在保护**用户已有的数据**，所以每条断言都对应一个「迁错了就丢东西」的场景：
//   · 一个分组同时含两类资源 → 各自只带走属于自己那类的资源目录，不重复、不遗漏
//   · 空分组（老清单里没有任何归属信息）→ 两棵都留一份，不能让用户「目录不见了」
//   · 只属于某一类的分组 → 另一棵树里不该凭空冒出来
//   · 老树必须原样留档，不是删掉
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { migrateLegacyLayout } from '../../src/core/assets/storage.js';
import * as groups from '../../src/core/assets/groups.js';
import * as assets from '../../src/core/assets/assets.js';
import { sandbox } from './sandbox.mjs';

// 手写一份老布局（不经过业务层——业务层已经写不出老布局了，这正是要迁的东西）
function legacyGroup(root, groupPath, assetsMap, files) {
  const dir = join(root, 'groups', ...groupPath.split('/'));
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'group.json'),
    JSON.stringify(
      {
        version: 1,
        group: { path: groupPath, name: groupPath.split('/').pop(), label: groupPath, createdAt: '2026-01-01T00:00:00.000Z' },
        assets: assetsMap,
      },
      null,
      2
    )
  );
  for (const [assetName, slot, content] of files) {
    const styleDir = join(dir, 'assets', assetName, 'styles', 'minimal');
    mkdirSync(styleDir, { recursive: true });
    writeFileSync(join(styleDir, slot), content);
  }
}

const entry = (name, kind) => ({
  name,
  kind,
  label: name,
  tags: [],
  activeStyle: 'minimal',
  styleCount: 1,
  styles: { minimal: { name: 'minimal', slot: kind === 'svg' ? 'svg' : 'html', history: [] } },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

test('迁移：混合分组按 kind 分流，空分组两边都留，老树留档', () => {
  sandbox();
  const root = process.env.NX_FT_DATA;

  // 一个分组同时含 html 与 svg 资源
  legacyGroup(
    root,
    'ui/mix',
    { 'page-hero': entry('page-hero', 'html'), arrow: entry('arrow', 'svg') },
    [
      ['page-hero', 'html', '<b>hero</b>'],
      ['arrow', 'svg', '<svg/>'],
    ]
  );
  // 只有 svg 资源的分组
  legacyGroup(root, 'icons/nav', { home: entry('home', 'svg') }, [['home', 'svg', '<svg id="home"/>']]);
  // 空分组：老清单里没有任何能判断归属的信息
  legacyGroup(root, 'empty-one', {}, []);

  const r = migrateLegacyLayout();
  assert.equal(r.migrated, true);
  assert.ok(r.archive && existsSync(r.archive), '老树必须留档，不能删');
  // r.groups 是**被移走的顶层目录名**（留档时的搬运单位），不是完整分组路径
  assert.deepEqual([...r.groups].sort(), ['empty-one', 'icons', 'ui']);

  // html 树：只该有 ui/mix（带 page-hero）与 empty-one
  assert.deepEqual(
    groups.listTree('html').groups.map((g) => g.path),
    ['empty-one', 'ui/mix']
  );
  assert.equal(groups.listTree('html').count.assets, 1);
  assert.equal(groups.listTree('html').groups.find((g) => g.path === 'ui/mix').assets[0].name, 'page-hero');

  // svg 树：ui/mix（带 arrow）+ icons/nav + empty-one
  assert.deepEqual(
    groups.listTree('svg').groups.map((g) => g.path),
    ['empty-one', 'icons/nav', 'ui/mix']
  );
  assert.equal(groups.listTree('svg').count.assets, 2);

  // 分流后的资源内容仍在（目录跟着到了正确的那棵树）
  const hero = assets.loadAsset({ kind: 'html', group: 'ui/mix', name: 'page-hero', code: true });
  assert.equal(hero.code.minimal.html, '<b>hero</b>');
  const home = assets.loadAsset({ kind: 'svg', group: 'icons/nav', name: 'home', code: true });
  assert.equal(home.code.minimal.svg, '<svg id="home"/>');

  // 不留重复副本：html 树里的 ui/mix 不该有 arrow
  let threw = false;
  try {
    assets.loadAsset({ kind: 'html', group: 'ui/mix', name: 'arrow' });
  } catch {
    threw = true;
  }
  assert.equal(threw, true, 'html 树里不该出现 svg 资源');
});

test('迁移：幂等——跑第二遍不再改动任何东西', () => {
  sandbox();
  const root = process.env.NX_FT_DATA;
  legacyGroup(root, 'ui/a', { b: entry('b', 'html') }, [['b', 'html', 'x']]);

  assert.equal(migrateLegacyLayout().migrated, true);
  const second = migrateLegacyLayout();
  assert.equal(second.migrated, false, '老树已不在原位，第二遍应当什么都不做');

  // 数据仍然可读，且没有被第二次迁移打乱
  assert.equal(groups.listTree('html').count.assets, 1);
  assert.equal(assets.loadAsset({ kind: 'html', group: 'ui/a', name: 'b', code: true }).code.minimal.html, 'x');
});

test('迁移：全新安装（没有 groups 目录）不报错', () => {
  sandbox();
  assert.equal(migrateLegacyLayout().migrated, false);
  // 迁完之后照常能用
  assert.equal(groups.addGroup({ kind: 'svg', group: 'ui/icons' }).status, 'ok');
  assert.deepEqual(
    readdirSync(join(process.env.NX_FT_DATA, 'groups')).sort(),
    ['svg']
  );
  assert.equal(groups.listTree('svg').count.groups, 1);
});
