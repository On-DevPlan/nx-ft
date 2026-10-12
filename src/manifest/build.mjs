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
const REGISTRY_DIR = join(HERE, '..', '..', 'registry');
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

// registry/<platform>/<id>/{spec.json, theme.json} —— 多平台组件注册表。
// 组件级隔离：一目录一组件，目录间零引用；theme 是 nx tokens 词汇的设计变量，
// 面板用它驱动 archetype 渲染（不依赖任何平台工具链、不生成图片）。
//
// theme 两级：registry/<platform>/theme.json 是平台默认（同一平台共享一套
// tokens 词汇），组件级 theme.json 按键覆盖——只有平台内真有差异时才需要组件级。
async function loadRegistry() {
  if (!existsSync(REGISTRY_DIR)) return [];
  const out = [];
  for (const p of await fsp.readdir(REGISTRY_DIR, { withFileTypes: true })) {
    if (!p.isDirectory()) continue;
    const platDir = join(REGISTRY_DIR, p.name);
    const platThemePath = join(platDir, 'theme.json');
    const platTheme = existsSync(platThemePath) ? (await readJson(platThemePath)).vars || {} : {};
    for (const c of await fsp.readdir(platDir, { withFileTypes: true })) {
      if (!c.isDirectory()) continue;
      const specPath = join(platDir, c.name, 'spec.json');
      if (!existsSync(specPath)) continue;
      const spec = await readJson(specPath);
      const themePath = join(platDir, c.name, 'theme.json');
      const ownTheme = existsSync(themePath) ? (await readJson(themePath)).vars || {} : {};
      out.push({
        id: spec.id || c.name,
        platform: spec.platform || p.name,
        archetype: spec.archetype || 'btn',
        title: spec.title || c.name,
        category: spec.category || 'misc',
        description: spec.description || '',
        props: spec.props || {},
        repo: spec.repo || null,
        code: spec.code || null,
        preview: spec.preview || null,
        theme: { ...platTheme, ...ownTheme },
      });
    }
  }
  out.sort((a, b) => a.platform.localeCompare(b.platform) || a.id.localeCompare(b.id));
  return out;
}

export async function buildCatalog() {
  const components = await loadComponents();
  const styles = await loadStyles();
  const registry = await loadRegistry();
  const catalog = {
    $schema: 'ui-kit/catalog.schema.json',
    version: '0.1.0',
    generated: new Date().toISOString(),
    components,
    styles,
    registry,
  };
  await fsp.writeFile(OUT_PATH, JSON.stringify(catalog, null, 2), 'utf8');
  return {
    components: components.length,
    styles: Object.keys(styles).length,
    registry: registry.length,
  };
}

const isMain = process.argv[1] && process.argv[1].endsWith('build.mjs');
if (isMain) {
  buildCatalog()
    .then((r) =>
      console.log(
        `catalog 已写入: ${OUT_PATH}（${r.components} 个组件 / ${r.styles} 个风格包 / registry ${r.registry} 件）`
      )
    )
    .catch((e) => {
      console.error(e.stack || String(e));
      process.exit(1);
    });
}
