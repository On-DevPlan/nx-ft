// scripts/test-harmony-click.mjs
// 回归:色盘点规则 → 立即派生(force 绕过 autoFill)→ 切规则槽位复用 → 点「无」清理。
// 引擎文件是无扩展名 import,node 直跑不了;用 esbuild bundle 成单文件再跑。
// 跑法:node scripts/test-harmony-click.mjs
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';

const esbuild = await import(
  pathToFileURL('node_modules/.pnpm/esbuild@0.25.12/node_modules/esbuild/lib/main.js').href
);
const build = esbuild.default?.build ?? esbuild.build;

mkdirSync('.tmp-test', { recursive: true });
await build({
  entryPoints: ['src/web/frontend/external/color-studio/src/engine/autoFill.js'],
  loader: { '.js': 'js' },
  bundle: true,
  outfile: '.tmp-test/autofill.bundle.mjs',
  format: 'esm',
  platform: 'node',
  logLevel: 'silent',
});
const { applyAutoFill } = await import(pathToFileURL('.tmp-test/autofill.bundle.mjs').href);

// 模拟用户状态:1 色、无和声
const doc = {
  meta: { schemaVersion: '1.3.0', createdAt: 0, updatedAt: 0, authorEmail: '' },
  activePaletteId: 'primary',
  palettes: [{ id: 'primary', name: '主色板', colorIds: ['anchor'], harmony: null, sortBy: 'manual', createdAt: 0, updatedAt: 0 }],
  colorEntries: [{ id: 'anchor', hex: '#F6FFA5', weight: 1, locked: false, note: '', tags: [], createdAt: 0, updatedAt: 0 }],
  filterStack: [],
  pickHistory: [],
  viewState: { leftPane: 'palettes', showHarmony: false, selectedHarmony: null, brightness: 100, mainView: 'wheel', selectedColorId: null },
};

// 模拟 ColorWheel 按钮 onClick:先设 harmony,再 force 派生
const click = (doc0, value) => {
  const next = {
    ...doc0,
    palettes: doc0.palettes.map((p) => {
      if (p.id !== doc0.activePaletteId) return p;
      if (!value) return { ...p, harmony: null, updatedAt: Date.now() };
      return {
        ...p,
        harmony: { type: value, anchorColorId: p.colorIds[0] ?? '', autoFill: p.harmony?.autoFill ?? false },
        updatedAt: Date.now(),
      };
    }),
  };
  return applyAutoFill(next, doc0.activePaletteId, { force: true });
};
const dump = (out, label) => {
  const palette = out.palettes.find((p) => p.id === 'primary');
  const entries = palette.colorIds.map((cid) => out.colorEntries.find((c) => c.id === cid));
  console.log(`[${label}] ${entries.length} 色:`, entries.map((e) => `${e.hex}${e.derivedFrom ? '←' + e.derivedFrom.rule + '#' + e.derivedFrom.slot : ''}`).join(' '));
  return entries.length;
};

const out1 = click(doc, 'triadic');
const n1 = dump(out1, '点三角');
const out2 = click(out1, 'analogous');
const n2 = dump(out2, '切类似');
const out3 = click(out2, null);
const n3 = dump(out3, '点无');

const ok = n1 === 3 && n2 === 3 && n3 === 1;
console.log(ok ? 'PASS' : 'FAIL');
if (!ok) process.exit(1);
