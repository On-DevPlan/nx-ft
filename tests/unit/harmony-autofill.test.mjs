// 锚色联动契约（引擎级集成）：external/color-studio/src/engine/{anchor,autoFill,wheelCommit}.js
//
// 覆盖用户可见的两件事：
//   1. 锚色响应式——换一张色卡当锚色，派生色整组按新锚色重算（不是按旧锚色）。
//   2. 锚色自动变化——勾上 autoFill 后拖色轮改锚色，派生色实时跟上。
//
// 引擎文件是无扩展名 import，node 直跑不了；用 esbuild bundle 成单文件再跑
// （与 scripts/test-harmony-click.mjs 同一套做法）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

function esbuildEntry() {
  const base = 'node_modules/.pnpm';
  const dirs = existsSync(base) ? readdirSync(base).filter((n) => /^esbuild@/.test(n)).sort().reverse() : [];
  for (const d of dirs) {
    const p = join(base, d, 'node_modules', 'esbuild', 'lib', 'main.js');
    if (existsSync(p)) return p;
  }
  throw new Error('找不到 esbuild（node_modules/.pnpm 下没有 esbuild@*）');
}

const esbuild = await import(pathToFileURL(esbuildEntry()).href);
const build = esbuild.default?.build ?? esbuild.build;

// bundle 产物落系统临时目录，不往仓库里丢文件
const ROOT = process.cwd().replace(/\\/g, '/');
const ENGINE = `${ROOT}/src/web/frontend/external/color-studio/src/engine`;
const work = mkdtempSync(join(tmpdir(), 'nx-ft-harmony-'));
const entry = join(work, 'engine-entry.js');
writeFileSync(entry, [
  `export { applyAutoFill } from '${ENGINE}/autoFill.js';`,
  `export { resolveAnchorId, withAnchor, withHarmonyRule } from '${ENGINE}/anchor.js';`,
  `export { commitWheelColor, pickWheelCommitMode } from '${ENGINE}/wheelCommit.js';`,
  `export { deriveHarmony } from '${ENGINE}/harmony.js';`,
].join('\n'));

await build({
  entryPoints: [entry],
  loader: { '.js': 'js' },
  bundle: true,
  outfile: join(work, 'harmony-engine.bundle.mjs'),
  format: 'esm',
  platform: 'node',
  logLevel: 'silent',
});
const {
  applyAutoFill,
  resolveAnchorId,
  withAnchor,
  withHarmonyRule,
  commitWheelColor,
  pickWheelCommitMode,
  deriveHarmony,
} = await import(pathToFileURL(join(work, 'harmony-engine.bundle.mjs')).href);

const entryOf = (id, hex, extra = {}) => ({
  id, hex, weight: 1, locked: false, note: '', tags: [], createdAt: 0, updatedAt: 0, ...extra,
});

// A/B 两张普通色卡 + triadic 规则，锚色 = A
function makeDoc() {
  return {
    meta: { schemaVersion: '1.3.0', createdAt: 0, updatedAt: 0, authorEmail: '' },
    activePaletteId: 'P',
    palettes: [{
      id: 'P',
      name: '主色板',
      colorIds: ['A', 'B'],
      harmony: { type: 'triadic', anchorColorId: 'A', autoFill: false },
      sortBy: 'manual',
      createdAt: 0,
      updatedAt: 0,
    }],
    colorEntries: [entryOf('A', '#FF0000'), entryOf('B', '#00FF00')],
    filterStack: [],
    pickHistory: [],
    viewState: {
      leftPane: 'palettes',
      showHarmony: true,
      selectedHarmony: 'triadic',
      brightness: 100,
      mainView: 'wheel',
      selectedColorId: 'A',
    },
  };
}

const hexesOf = (doc, ids) => ids.map((id) => doc.colorEntries.find((c) => c.id === id)?.hex);
const derivedIds = (doc) => doc.palettes[0].colorIds.filter((id) => {
  const c = doc.colorEntries.find((x) => x.id === id);
  return !!c?.derivedFrom;
});

test('换锚色（选另一张色卡）：派生色整组按新锚色重算', () => {
  const doc = makeDoc();
  const next = applyAutoFill(withAnchor(doc, 'B'), 'P', { force: true });
  assert.equal(next.palettes[0].harmony.anchorColorId, 'B', '锚色跟到 B');
  assert.equal(next.viewState.selectedColorId, 'B');

  const expect = deriveHarmony('#00FF00', 'triadic').slice(1);
  const got = hexesOf(next, derivedIds(next));
  assert.deepEqual(got, expect, '派生色必须按新锚色算，不能还挂在旧锚色上');
  assert.equal(hexesOf(next, ['A'])[0], '#FF0000', '旧锚色卡本身不被改写');
});

test('锚色色卡被删：重新指锚 + 整组重派生', () => {
  let doc = makeDoc();
  doc = applyAutoFill(doc, 'P', { force: true });
  const derived = derivedIds(doc);
  assert.equal(derived.length, 2, 'triadic → 两张派生色');

  // 删掉锚色卡 A
  doc = {
    ...doc,
    colorEntries: doc.colorEntries.filter((c) => c.id !== 'A'),
    palettes: doc.palettes.map((p) => ({ ...p, colorIds: p.colorIds.filter((id) => id !== 'A') })),
  };
  const palette = doc.palettes[0];
  const rest = palette.colorIds.filter((id) => id !== 'A');
  const reanchored = withAnchor(doc, rest[0]);
  const next = applyAutoFill(reanchored, 'P', { force: true });
  assert.ok(next.palettes[0].harmony.anchorColorId, '锚色必须重新指到还在的卡上');
  assert.ok(next.palettes[0].colorIds.includes(next.palettes[0].harmony.anchorColorId), '锚色必须在本板里');
  assert.equal(derivedIds(next).length, 2, '派生色仍是两张');
});

test('autoFill 开：拖色轮改锚色 → 派生色实时跟上', () => {
  let doc = makeDoc();
  doc = applyAutoFill(doc, 'P', { force: true });
  doc = {
    ...doc,
    palettes: doc.palettes.map((p) => ({ ...p, harmony: { ...p.harmony, autoFill: true } })),
  };

  // 色轮编辑目标 = 锚色（resolveAnchorId），改的就是锚色本身
  const mode = pickWheelCommitMode(doc);
  assert.equal(mode.anchorColorId, 'A');
  const before = hexesOf(doc, derivedIds(doc));

  doc = commitWheelColor(doc, mode.anchorColorId, '#123456');
  // useAutoFillEffect 的行为：锚色 hex 变了 → 重派生
  doc = applyAutoFill(doc, 'P');

  const after = hexesOf(doc, derivedIds(doc));
  assert.notDeepEqual(after, before, '派生色必须跟着锚色变');
  assert.deepEqual(after, deriveHarmony('#123456', 'triadic').slice(1));
});

test('autoFill 关：手工调锚色不覆盖当前派生集（冻结语义不变）', () => {
  let doc = makeDoc();
  doc = applyAutoFill(doc, 'P', { force: true });
  const before = hexesOf(doc, derivedIds(doc));

  doc = commitWheelColor(doc, resolveAnchorId(doc), '#123456');
  doc = applyAutoFill(doc, 'P'); // autoFill=false → 不重派生

  assert.deepEqual(hexesOf(doc, derivedIds(doc)), before, '派生集应保持原样');
});

test('点规则：锚色定到当前选中的色卡，并立刻派生', () => {
  const doc = makeDoc();
  const next = applyAutoFill(withHarmonyRule(doc, 'analogous'), 'P', { force: true });
  assert.equal(next.palettes[0].harmony.type, 'analogous');
  assert.equal(next.palettes[0].harmony.anchorColorId, 'A');
  assert.equal(derivedIds(next).length, 2, '类似色 → 两张派生色');
  assert.deepEqual(
    hexesOf(next, derivedIds(next)),
    deriveHarmony('#FF0000', 'analogous').slice(1)
  );
});
