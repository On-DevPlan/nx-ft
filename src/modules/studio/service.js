// studio service：studio 域的所有业务真相源。
//
// 三个核心契约：
//   1. 读 catalog.json：预生成的快照，足够 agent 离线摸底。
//   2. 读 spec / css / jsx：单个组件的深读，agent 改样式时用。
//   3. 渲染 HTML：把 spec + style → 一段可粘贴的 HTML + class 契约。
//      这正是 "uix 失败的那条路" 的反向解法——组件是 class-contract，
//      不需要运行时环境就能拼接出预览 HTML。
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_NAME, STORE_PATH, storePathFromEnv } from '../../core/paths.js';
import { badInput, notFound } from '../../core/errors/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
// files/ → 项目根：ui-kit 的库代码在 src/{styles,tokens,layout,components,manifest}/
// service.js 在 src/modules/studio/，跳三层到项目根
const ROOT = join(HERE, '..', '..', '..');
const LIB = {
  styles: join(ROOT, 'src', 'styles'),
  tokens: join(ROOT, 'src', 'tokens'),
  layout: join(ROOT, 'src', 'layout'),
  // components 归每个 pack 自己拥有：src/styles/<pack>/components/<id>.{jsx,spec.json}
  manifest: join(ROOT, 'src', 'manifest'),
};
const PACKAGE_JSON = join(ROOT, 'package.json');

async function readJson(p) {
  return JSON.parse(await readFile(p, 'utf8'));
}

async function readPackage() {
  return readJson(PACKAGE_JSON);
}

async function readCatalog() {
  const p = join(LIB.manifest, 'catalog.json');
  if (!existsSync(p)) {
    throw notFound('catalog.json 未生成——先跑 `{{name}} studio build`'.replace('{{name}}', APP_NAME));
  }
  return readJson(p);
}

// style 缺省（CLI 不带 --style、HTTP 不带 ?style=）→ catalog 序第一个 pack。
// 默认名不硬编码：pack 集合会演化（paper→4-pack 迁移后，写死的 'paper' 让
// 无参调用全端 404），动态解析让「缺省 = 库里第一个」永远成立。
function firstPack(cat) {
  return Object.keys(cat.styles)[0] || null;
}

// 校验 style 参数：未知 pack 直接报用法错并列出可用项——静默返回空集会让
// agent 以为「库里没有组件」，把环境问题误判成数据问题。
function assertStyle(cat, style) {
  if (style && !cat.styles[style]) {
    throw badInput(`未知风格包: ${style}（可用: ${Object.keys(cat.styles).join(' | ')}）`);
  }
}

// ---- bootstrap ----

export async function bootstrap() {
  const pkg = await readPackage();
  const cat = await readCatalog();
  const { commandTable } = await import('./commands.js');
  return {
    app: { name: APP_NAME, version: pkg.version },
    storePath: storePathFromEnv(),
    storeDefault: STORE_PATH,
    library: {
      components: cat.components.length,
      styles: Object.keys(cat.styles).length,
    },
    commands: await commandTable(),
  };
}

// ---- manifest：整库目录（按 style 过滤嵌入 css） ----

export async function manifest({ style } = {}) {
  const cat = await readCatalog();
  assertStyle(cat, style);
  let components = cat.components;
  let chain = null;
  if (style) {
    // 按 extends 链过滤：输入 terra → 返回「terra 能用的全部组件」
    // = terra 自有的 + 沿 extends 继承的。每个条目保留 pack 字段标明来源，
    // agent 由此知道「这个组件的 spec 出自哪个包、css 将用哪个包」。
    chain = new Set();
    let cur = style;
    while (cur) {
      chain.add(cur);
      cur = cat.styles[cur]?.extends || null;
    }
    components = components.filter((c) => chain.has(c.pack));
  }
  const out = components.map((c) => ({
    id: c.id,
    pack: c.pack,
    category: c.category,
    title: c.title,
    description: c.description,
    classContract: c.classContract,
    classes: c.classes,
    dom: c.dom,
    props: c.props,
    tokens: c.tokens,
    examples: c.examples,
    _source: c._source,
  }));
  return {
    version: cat.version,
    generated: cat.generated,
    style: style || null,
    inheritedVia: style ? [...chain].filter((p) => p !== style) : [],
    components: out,
    styles: cat.styles,
    registry: cat.registry || [],
  };
}

// ---- packs：只列清单 ----

export async function packs() {
  const cat = await readCatalog();
  // ownTokens：该 pack 是否自带 palette（styles/<pack>/tokens.css）。
  // 自带 palette 的 pack 在 component/preview 里优先用自家 tokens，
  // palette 轴（?tokens=）只对没有自带 palette 的 pack 生效。
  const packs = {};
  for (const [name, meta] of Object.entries(cat.styles)) {
    packs[name] = {
      ...meta,
      ownTokens: existsSync(join(LIB.styles, name, 'tokens.css')),
    };
  }
  return { status: 'ok', packs };
}

// ---- pack chain：沿 extends 链向上找文件 ----
//
// 「一种风格 = 一套组件」：每个 pack 自己拥有 components/。pack 可声明
// extends 形成覆盖链——只需放「想要覆盖」的文件，未覆盖的沿链向上回溯。
async function resolveInPackChain(packName, fileName, cat) {
  let cur = packName;
  while (cur) {
    const p = join(LIB.styles, cur, 'components', fileName);
    if (existsSync(p)) return { path: p, pack: cur };
    const meta = cat.styles[cur];
    cur = (meta && meta.extends) || null;
  }
  return null;
}

// ---- component：单件深读 ----

export async function component({ id, style, withJsx = false, tokens: tokensAxis = 'light' } = {}) {
  if (!id) throw badInput('缺少组件 id');
  const cat = await readCatalog();
  assertStyle(cat, style);
  const pack = style || firstPack(cat);
  if (!pack) throw notFound('库里没有任何风格包——先在 src/styles/ 下建 pack');
  const resolved = await resolveInPackChain(pack, `${id}.spec.json`, cat);
  if (!resolved) throw notFound(`组件不存在: ${id}（pack: ${pack}）`);
  const spec = await readJson(resolved.path);

  const css = {};
  for (const cls of spec.classes || []) {
    const head = cls.split(/\s|\./)[0];
    const file = join(LIB.styles, pack, `${head}.css`);
    if (existsSync(file)) {
      css[head] = await readFile(file, 'utf8');
    }
  }
  // tokens 来源：pack 自带 palette（styles/<pack>/tokens.css）优先；
  // 没有自带的 pack 才走 palette 轴（src/tokens/<axis>.css）。
  // 同一 pack × 不同 palette = 不同外观的正交性，对无自带 palette 的 pack 依然成立。
  const packTokensPath = join(LIB.styles, pack, 'tokens.css');
  const tokensSource = existsSync(packTokensPath) ? 'pack' : 'axis';
  const tokensPath = tokensSource === 'pack'
    ? packTokensPath
    : join(LIB.tokens, `${tokensAxis}.css`);
  const tokens = existsSync(tokensPath) ? await readFile(tokensPath, 'utf8') : '';

  let jsx = null;
  if (withJsx) {
    const jsxResolved = await resolveInPackChain(pack, `${id}.jsx`, cat);
    if (jsxResolved) jsx = await readFile(jsxResolved.path, 'utf8');
  }

  return {
    id,
    style: pack,
    tokensAxis,
    tokensSource,
    spec,
    css,
    tokens,
    jsx,
    sourcePack: resolved.pack,
  };
}

// ---- preview：渲染组件 HTML（class 契约直接落地） ----
//
// 设计要点：组件是 class-contract 而不是 React 组件——这意味着我们
// 不需要 jsdom 也不需要 React renderer 就能拼出 HTML 片段。
// 样例拿首条 examples[0]，把它包到 <style> + 该 strategy css 里。
export async function preview({ id, style, tokens: tokensAxis = 'light' } = {}) {
  if (!id) throw badInput('缺少组件 id');
  const c = await component({ id, style, tokensAxis });
  const pack = c.style; // component 已解析缺省 pack
  const ex = c.spec.examples && c.spec.examples[0];
  if (!ex) throw notFound(`组件 ${id} 没有 examples`);

  // 把该 strategy css 与 palette tokens 拼到 inline <style>，
  // 让片段自包含、跨域可粘贴
  const cssText = Object.values(c.css).join('\n\n');
  const tokensBlock = c.tokens;

  return {
    id,
    style: pack,
    tokensAxis,
    html: ex.html,
    css: cssText,
    tokens: tokensBlock,
    document: `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${id} · ${pack}/${tokensAxis}</title>
<style>
${tokensBlock}
${cssText}
</style>
</head>
<body style="padding: 24px; background: var(--bg, var(--paper)); color: var(--ink);">
${ex.html}
</body>
</html>`,
  };
}

// ---- build：重建 catalog ----

export async function build() {
  const { buildCatalog } = await import('../../manifest/build.mjs');
  const r = await buildCatalog();
  return { ...r, path: join(LIB.manifest, 'catalog.json') };
}

// ---- doctor：一致性自检 ----
//
// 与 tests/unit/manifest-consistency.test.mjs 共用同一组断言：
// spec 里列出的 classes / tokens 必须能在 css 与 tokens.css 里找到。
// CLI 与测试两端都对，这是 family 「truth 源唯一」的纪律。
//
// tokens 检查走 palette 轴（src/tokens/<axis>.css），与 pack 正交——
// 任何一个 palette 文件里定义了 spec 引用的变量即可。
//
// 每个组件自检走自己 pack 的 strategy css（沿 extends 链回溯）——
// 基座 pack 改了 spec 会体现在所有继承它的派生 pack 的 doctor 输出里。
export async function doctor() {
  const issues = [];
  const cat = await readCatalog();

  // 收集所有 palette 文件的文本
  const tokensTexts = [];
  for (const palette of ['light', 'dark', 'warm', 'mono']) {
    const f = join(LIB.tokens, `${palette}.css`);
    if (existsSync(f)) tokensTexts.push(await readFile(f, 'utf8'));
  }

  for (const c of cat.components) {
    // spec 列出的 class 必须有 strategy css 对得上（pack 自己的 strategy，
    // 找不到时沿 extends 链向上回溯）
    for (const cls of c.classes || []) {
      const head = cls.split(/\s|\./)[0];
      if (!(cat.styles[c.pack]?.strategies || []).includes(head)) {
        // 不是约定的 strategy 名（可能是 .card-body 这种派生类）——不报错
        continue;
      }
      const cssPath = join(LIB.styles, c.pack, `${head}.css`);
      if (!existsSync(cssPath)) {
        issues.push(`${c.pack}/${c.id}: spec 引用 .${head}，但 src/styles/${c.pack}/${head}.css 不存在`);
      }
    }
    // spec 列出的 token 必须出现在任一 palette 文件里
    for (const tok of c.tokens || []) {
      const found = tokensTexts.some((t) => t.includes(tok));
      if (!found) {
        issues.push(`${c.pack}/${c.id}: spec 引用 ${tok}，但 src/tokens/<axis>.css 都不含此变量`);
      }
    }
  }

  return { status: issues.length ? 'warn' : 'ok', components: cat.components.length, styles: Object.keys(cat.styles).length, issues };
}
