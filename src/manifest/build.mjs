// 走 styles/<pack>/components/*.spec.json + styles/<pack>/，汇成 catalog.json。
//
// 单一真相源：每个 pack 自己拥有自己的 components/ 与 strategy css。
// 「一种风格 = 一套组件 + 一套 css」是 ui-kit 的核心契约。
//
// 多包聚合：catalog.components[] 里每个条目带 pack 字段，agent 一次拿齐
// 整库（含全部 pack 的组件），按需用 ?style= 过滤。
import fsp from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const STYLES_DIR = join(HERE, '..', 'styles');
const OUT_PATH = join(HERE, 'catalog.json');

async function readJson(p) {
  return JSON.parse(await fsp.readFile(p, 'utf8'));
}

async function loadStyles() {
  const entries = await fsp.readdir(STYLES_DIR, { withFileTypes: true });
  const styles = {};
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const packPath = join(STYLES_DIR, e.name, 'pack.json');
    if (!existsSync(packPath)) continue;
    const pack = await readJson(packPath);
    styles[e.name] = {
      name: e.name,
      label: pack.label || e.name,
      extends: pack.extends || null,
      strategies: pack.strategies || [],
    };
  }
  return styles;
}

async function loadComponents() {
  const styles = await loadStyles();
  const components = [];
  // 遍历每个 pack 的 components/，构建（pack, componentId, spec）三元组
  for (const packName of Object.keys(styles)) {
    const compDir = join(STYLES_DIR, packName, 'components');
    if (!existsSync(compDir)) continue;
    const files = await fsp.readdir(compDir, { withFileTypes: true });
    for (const f of files) {
      if (!f.isFile() || !f.name.endsWith('.spec.json')) continue;
      const spec = await readJson(join(compDir, f.name));
      components.push({
        ...spec,
        pack: packName,
        _source: `${packName}/components/${f.name}`,
      });
    }
  }
  // 排序：pack 相同按分类，按 id；不同 pack 间按 pack 名（agent 看稳定顺序）
  components.sort(
    (a, b) =>
      a.pack.localeCompare(b.pack) ||
      (a.category || '').localeCompare(b.category || '') ||
      a.id.localeCompare(b.id)
  );
  return components;
}

export async function buildCatalog() {
  const components = await loadComponents();
  const styles = await loadStyles();
  const catalog = {
    $schema: 'ui-kit/catalog.schema.json',
    version: '0.1.0',
    generated: new Date().toISOString(),
    components,
    styles,
  };
  await fsp.writeFile(OUT_PATH, JSON.stringify(catalog, null, 2), 'utf8');
  return { components: components.length, styles: Object.keys(styles).length };
}

const isMain = process.argv[1] && process.argv[1].endsWith('build.mjs');
if (isMain) {
  buildCatalog()
    .then((r) => console.log(`catalog 已写入: ${OUT_PATH}（${r.components} 个组件 / ${r.styles} 个风格包）`))
    .catch((e) => {
      console.error(e.stack || String(e));
      process.exit(1);
    });
}
