// manifest 一致性测试：spec 是单一真相源——catalog.json 必须从 spec 重建而来，
// spec 列出的 classes/tokens 必须能在 css/tokens.css 里找到。
//
// 这是「库」这个概念的兜底：消费者读 catalog 写代码，库作者改 spec 影响 catalog；
// 如果 spec 里的某个 class 在 css 里找不到，consumer 会以为有这个 class 但其实没有。
// 这种漂移只能在测试期抓——runtime 不报、build 不报、publish 也不报。
//
// 「一种风格 = 一套组件」：spec 文件位于 src/styles/<pack>/components/。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function listSpecFiles(packDir) {
  if (!existsSync(packDir)) return [];
  return readdirSync(packDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.spec.json'))
    .map((e) => e.name);
}

const stylesDir = join(ROOT, 'src', 'styles');
const packDirs = existsSync(stylesDir)
  ? readdirSync(stylesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  : [];

// 收集所有 (pack, specFileName)
const specEntries = packDirs.flatMap((p) =>
  listSpecFiles(join(stylesDir, p, 'components')).map((f) => ({ pack: p, file: f }))
);
const catalogPath = join(ROOT, 'src', 'manifest', 'catalog.json');

// 1. catalog.json 必须存在——若没生成，build 跑一次就好。
test('catalog.json 已生成（否则跑 studio build）', () => {
  assert.ok(existsSync(catalogPath), `缺 ${catalogPath}——先跑 studio build`);
});

test('每个 spec 都进了 catalog（漏 spec 会让 agent 看不到该组件）', () => {
  const cat = JSON.parse(readFileSync(catalogPath, 'utf8'));
  const catKeys = new Set(cat.components.map((c) => `${c.pack}/${c.id}`));
  const missing = specEntries
    .filter(({ pack, file }) => !catKeys.has(`${pack}/${file.replace(/\.spec\.json$/, '')}`));
  assert.deepEqual(missing, [], `spec 漏进 catalog: ${JSON.stringify(missing)}`);
});

test('每个 catalog 组件都有 spec（catalog 多出来的成分是孤儿）', () => {
  const cat = JSON.parse(readFileSync(catalogPath, 'utf8'));
  const specKeys = new Set(specEntries.map(({ pack, file }) => `${pack}/${file.replace(/\.spec\.json$/, '')}`));
  const orphan = cat.components
    .filter((c) => !specKeys.has(`${c.pack}/${c.id}`))
    .map((c) => `${c.pack}/${c.id}`);
  assert.deepEqual(orphan, [], `catalog 里的孤儿（无 spec）: ${orphan.join(', ')}`);
});

// 2. spec 声明的 class 必须能在 css 里找到（按各组件自己的 pack 校验）
test('spec 引用的 class 都有对应的 strategy css', () => {
  const cat = JSON.parse(readFileSync(catalogPath, 'utf8'));
  for (const c of cat.components) {
    const strategies = cat.styles[c.pack]?.strategies || [];
    for (const cls of c.classes || []) {
      const head = cls.split(/\s|\./)[0];
      // 跳过 .card-body 这种不是 strategy 名的派生类
      if (!strategies.includes(head)) continue;
      const file = join(stylesDir, c.pack, `${head}.css`);
      assert.ok(existsSync(file), `${c.pack}/${c.id}: spec 引用 .${head} 但 src/styles/${c.pack}/${head}.css 缺失`);
    }
  }
});

// 3. spec 声明的 token 必须出现在至少一个 palette 文件（src/tokens/<axis>.css）里
test('spec 引用的 token 都出现在 palette tokens.css 里', () => {
  const cat = JSON.parse(readFileSync(catalogPath, 'utf8'));
  const tokensDir = join(ROOT, 'src', 'tokens');
  const paletteFiles = existsSync(tokensDir)
    ? readdirSync(tokensDir).filter((f) => f.endsWith('.css'))
    : [];
  const tokensTexts = paletteFiles.map((f) => readFileSync(join(tokensDir, f), 'utf8'));
  assert.ok(tokensTexts.length >= 1, `src/tokens/ 至少要有 1 个 palette 文件`);
  for (const c of cat.components) {
    for (const tok of c.tokens || []) {
      const found = tokensTexts.some((t) => t.includes(tok));
      assert.ok(found, `${c.pack}/${c.id}: spec 引用 ${tok}，但 src/tokens/*.css 都不含此变量`);
    }
  }
});

// 4. 每个风格包必须自洽：pack.json strategies 与实际文件一致；palette 轴独立
test('每个风格包的 pack.json 与磁盘文件一致', () => {
  if (!existsSync(stylesDir)) return;
  for (const d of packDirs) {
    const packPath = join(stylesDir, d, 'pack.json');
    if (!existsSync(packPath)) continue;
    const pack = JSON.parse(readFileSync(packPath, 'utf8'));
    for (const s of pack.strategies) {
      assert.ok(existsSync(join(stylesDir, d, `${s}.css`)), `${d}: pack 声明 ${s} 但 ${s}.css 缺失`);
    }
  }
});

// 5. 如果 pack 声明 extends，则只校验本 pack 实际覆盖的 strategy（未覆盖的走继承）
test('extends 链：子包不重复声明继承来的 strategy 文件即可', () => {
  // 这条是个白名单式的便利断言：子包可以「只覆盖一个文件」，而不是
  // 把 10 件 strategy 都复制一遍再覆盖其中之一。
  if (!existsSync(stylesDir)) return;
  for (const d of packDirs) {
    const packPath = join(stylesDir, d, 'pack.json');
    if (!existsSync(packPath)) continue;
    const pack = JSON.parse(readFileSync(packPath, 'utf8'));
    if (!pack.extends) continue;
    // 子包：strategies 数组应当与父包一致（pack.json 不替运行时做合并）
    assert.ok(
      Array.isArray(pack.strategies),
      `${d} 声明 extends 但 strategies 不是数组——运行时会回溯到父包补齐`
    );
  }
});
