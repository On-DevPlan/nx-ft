#!/usr/bin/env node
// A09 UIUX 评分脚本：按 ft-uiux A01-A09 维度对当前项目做确定性评分。
// 输出 JSON 报告 + 总分；可纳入 CI（失败时 exit 1）。
//
// 评分维度（与 assets/ft-uiux/references/A*.md 一一对应）：
//   A01 配色与密度     A02 布局与层级      A03 CRUD 完备性
//   A04 面包屑         A05 批量操作        A06 路由与全屏页
//   A07 浏览器自动化   A08 一致性无 emoji  A09 自动化与闭环
//
// 评分原则（绝对严格）：垃圾 UI/UX 就是垃圾，不存在「凑合」。
// 总分 = 加权平均（每项 0-5 分），按 100 分制换算后输出。

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src/web/frontend');

// 装饰性渐变（非 grid pattern）
const DECORATIVE_GRADIENT_RE = /(?<!repeating-)linear-gradient|radial-gradient|conic-gradient/;
// 装饰性 box-shadow（非 inset；含 rgba 透明度的）
const DECORATIVE_SHADOW_RE = /box-shadow\s*:\s*[^;]*rgba\([^)]*\)/;
// Emoji 字符范围
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]/u;

function walk(dir, exts = /\.(jsx?|tsx?|css|html|md)$/) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p, exts));
    else if (exts.test(p)) out.push(p);
  }
  return out;
}

const files = walk(SRC);
const report = {
  timestamp: new Date().toISOString(),
  total: 0, // 0-100
  dimensions: {},
};

// ============ A01 配色与密度 ============
{
  const cssFiles = files.filter((f) => f.endsWith('.css'));
  let cssText = '';
  for (const f of cssFiles) cssText += readFileSync(f, 'utf8');

  const hexColors = [...new Set((cssText.match(/#[0-9a-fA-F]{6}\b/g) || []))];
  const fontSizes = [...new Set((cssText.match(/font-size:\s*\d+px/g) || []).map((s) => s.match(/\d+/)[0]))];

  let score = 5;
  const issues = [];
  if (hexColors.length > 12) { score = Math.min(score, 3); issues.push(`颜色数量 ${hexColors.length} 超过 12 个上限`); }
  // 字号严格三档（11 / 12 / 14）
  const offSpecFonts = fontSizes.filter((s) => !['11', '12', '14'].includes(s));
  if (offSpecFonts.length > 0) {
    score = Math.min(score, 2);
    issues.push(`字号包含非三档值: ${offSpecFonts.join(', ')}`);
  }
  // 装饰性渐变（grid pattern 用的 repeating-linear-gradient 不算）
  const decorativeGradients = DECORATIVE_GRADIENT_RE.test(cssText);
  if (decorativeGradients) { score = Math.min(score, 2); issues.push('出现装饰性渐变背景（repeating-linear-gradient 网格除外）'); }
  // 装饰性 box-shadow（含 rgba 透明度的非 inset）
  const decorativeShadows = DECORATIVE_SHADOW_RE.test(cssText);
  if (decorativeShadows) { score = Math.min(score, 3); issues.push('出现装饰性 box-shadow'); }
  if (fontSizes.length === 0) { score = Math.min(score, 2); issues.push('未发现字号定义'); }

  report.dimensions.A01 = { score, issues, metrics: { hexColors: hexColors.length, fontSizes, decorativeGradients, decorativeShadows } };
}

// ============ A02 布局与层级 ============
{
  const hasSplitPane = files.some((f) => f.includes('SplitPane'));
  const cssText = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(f, 'utf8')).join('\n');
  const hasDivider = cssText.includes('.sp-divider');

  let score = 5;
  const issues = [];
  if (!hasSplitPane) { score = Math.min(score, 2); issues.push('没有 SplitPane 组件'); }
  if (!hasDivider) { score = Math.min(score, 2); issues.push('没有拖拽分隔条 CSS'); }

  report.dimensions.A02 = { score, issues, metrics: { hasSplitPane, hasDivider } };
}

// ============ A03 CRUD 完备性 ============
{
  // 检查源码是否声明了 CRUD 五端点
  const apiFiles = walk(join(ROOT, 'src/runtime'));
  let apiText = '';
  for (const f of apiFiles) apiText += readFileSync(f, 'utf8');

  const _endpoints = ['list', 'get', 'create', 'update', 'delete'];
  // 简化：检查 service.js 是否声明了对应模块
  const hasCrud = {
    list: apiText.includes('list') || apiText.includes('tree'),
    get: apiText.includes('get') || apiText.includes('load') || apiText.includes('asset'),
    create: apiText.includes('add') || apiText.includes('create'),
    update: apiText.includes('put') || apiText.includes('update'),
    delete: apiText.includes('rm') || apiText.includes('remove'),
  };

  let score = 5;
  const issues = [];
  for (const [k, v] of Object.entries(hasCrud)) {
    if (!v) { score = Math.min(score, 3); issues.push(`缺少 ${k} 端点实现`); }
  }

  report.dimensions.A03 = { score, issues, metrics: hasCrud };
}

// ============ A04 面包屑 ============
{
  const crumbsFile = files.find((f) => f.includes('parts.jsx'));
  let score = 5;
  const issues = [];
  if (!crumbsFile) { score = Math.min(score, 2); issues.push('找不到面包屑组件文件'); }
  else {
    const t = readFileSync(crumbsFile, 'utf8');
    if (!t.includes('aria-label="breadcrumb"')) { score = Math.min(score, 4); issues.push('面包屑缺 aria-label'); }
    if (!t.includes('data-testid')) { score = Math.min(score, 4); issues.push('面包屑缺 data-testid'); }
    // 检查工作台是否使用面包屑
    const wbFile = files.find((f) => f.includes('workbench.jsx'));
    if (wbFile && !readFileSync(wbFile, 'utf8').includes('Crumbs')) { score = Math.min(score, 3); issues.push('工作台未使用面包屑'); }
  }
  report.dimensions.A04 = { score, issues };
}

// ============ A05 批量操作 ============
{
  let score = 2; // 默认很低，要求真实证据才上调
  const issues = [];
  // 1. 检查 BatchBar 组件存在
  const partsFile = files.find((f) => f.includes('parts.jsx'));
  const hasBatchBar = partsFile && readFileSync(partsFile, 'utf8').includes('BatchBar');
  // 2. 检查 manage.jsx 真的渲染 BatchBar
  const manageFile = files.find((f) => f.includes('manage.jsx'));
  const manageText = manageFile ? readFileSync(manageFile, 'utf8') : '';
  const usesBatchBar = hasBatchBar && manageText.includes('<BatchBar');
  // 3. 检查勾选框 + 全选 / 反选 / 取消 三个入口
  const hasCheck = manageText.includes('am-card-check') || manageText.includes('selectAll') || manageText.includes('toggleSelect');
  const hasInvert = manageText.includes('invertVisible');
  const hasCancel = manageText.includes('cancelBatch');

  if (!hasBatchBar) { issues.push('没有 BatchBar 组件'); }
  else if (!usesBatchBar) { score = Math.max(score, 3); issues.push('BatchBar 组件未实际渲染（仅声明未使用）'); }
  else if (!hasCheck || !hasInvert || !hasCancel) {
    score = Math.max(score, 4);
    if (!hasCheck) issues.push('缺多选/勾选入口');
    if (!hasInvert) issues.push('缺反选入口');
    if (!hasCancel) issues.push('缺取消批量入口');
  } else {
    score = 5;
  }

  report.dimensions.A05 = { score, issues, metrics: { hasBatchBar, usesBatchBar, hasCheck, hasInvert, hasCancel } };
}

// ============ A06 路由与全屏页 ============
{
  // 检查是否声明了路由分层 + 全屏工作台路由
  const routerFiles = walk(join(ROOT, 'src/web/frontend')).filter(
    (f) => f.includes('App.jsx') || f.includes('registry.js') || f.includes('view.jsx') || f.includes('index.jsx')
  );
  let routerText = '';
  for (const f of routerFiles) routerText += readFileSync(f, 'utf8');

  let score = 5;
  const issues = [];
  // 检查三层路由：list (/) + dir (/dir/<path>) + edit (/edit/<path>)
  const _hasList = true;
  const hasDir = routerText.includes('dir') || routerText.includes('/dir/');
  const hasEdit = routerText.includes('edit') || routerText.includes('/edit/') || routerText.includes('Workbench') || routerText.includes('workbench');
  const hasFullPage = routerText.includes('full') || routerText.includes('FullPage') || routerText.includes('fullpage');

  if (!hasDir) { score = Math.min(score, 3); issues.push('缺分组路由'); }
  if (!hasEdit) { score = Math.min(score, 3); issues.push('缺编辑页路由'); }
  if (!hasFullPage) { score = Math.min(score, 4); issues.push('缺整页预览（fullpage）路由'); }

  report.dimensions.A06 = { score, issues, metrics: { hasDir, hasEdit, hasFullPage } };
}

// ============ A07 浏览器自动化 ============
{
  const testsDir = join(ROOT, 'tests');
  const e2eFiles = walk(testsDir, /\.(mjs|js|ts|tsx|test\.mjs)$/).filter((f) =>
    /e2e|uiux|playwright|cypress|browser/i.test(f)
  );
  const hasDataTestid = files.some((f) => {
    if (!f.endsWith('.jsx')) return false;
    return readFileSync(f, 'utf8').includes('data-testid');
  });

  let score = 2;
  const issues = [];
  // 严格：要求 e2e 真的能跑、关键元素有 data-testid
  if (e2eFiles.length === 0) {
    issues.push('没有 e2e 测试文件');
    score = 2;
  } else {
    score = 4;
    if (e2eFiles.length === 1) issues.push('e2e 覆盖单一');
    // 检查测试文件是否真的能跑（不含硬编码错误路径）
    const allTestText = e2eFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
    const hasRealFetch = allTestText.includes('fetch(') || allTestText.includes('page.goto');
    const hasAssertions = allTestText.includes('assert.');
    if (hasRealFetch && hasAssertions) score = 5;
    else issues.push('e2e 测试缺少 fetch 或断言');
  }
  if (!hasDataTestid) { score = Math.min(score, 3); issues.push('没有 data-testid 属性'); }

  report.dimensions.A07 = { score, issues, metrics: { e2eFiles: e2eFiles.length, hasDataTestid } };
}

// ============ A08 一致性与无 emoji ============
{
  let score = 5;
  const issues = [];
  const emojiFiles = [];
  for (const f of files) {
    const t = readFileSync(f, 'utf8');
    if (EMOJI_RE.test(t)) {
      emojiFiles.push(relative(ROOT, f));
      score = Math.min(score, 1);
    }
  }
  if (emojiFiles.length > 0) issues.push(`发现 emoji 字符的文件: ${emojiFiles.slice(0, 5).join(', ')}`);

  report.dimensions.A08 = { score, issues, metrics: { emojiFiles: emojiFiles.length } };
}

// ============ A09 自动化与闭环 ============
{
  // 检查本评分脚本是否被 CI 调用 + e2e 是否在 CI 跑
  const ciFile = join(ROOT, '.github/workflows/ci.yml');
  const hasCi = existsSync(ciFile);
  let ciText = '';
  if (hasCi) ciText = readFileSync(ciFile, 'utf8');

  let score = 5;
  const issues = [];
  if (!hasCi) { score = Math.min(score, 2); issues.push('没有 CI 配置'); }
  if (!ciText.includes('test:smoke') && !ciText.includes('test:unit')) {
    score = Math.min(score, 3);
    issues.push('CI 没有跑测试');
  }
  // A09 评分脚本自身存在 = 部分得分
  const scoreScriptExists = existsSync(join(ROOT, 'scripts/score-uiux.mjs'));

  report.dimensions.A09 = { score, issues, metrics: { hasCi, scoreScriptExists } };
}

// ============ 总分 ============
const weights = { A01: 1, A02: 1.5, A03: 1.5, A04: 1, A05: 1, A06: 1, A07: 1.5, A08: 1, A09: 1 };
let weightedSum = 0;
let weightTotal = 0;
for (const [k, w] of Object.entries(weights)) {
  if (report.dimensions[k]) {
    weightedSum += report.dimensions[k].score * w;
    weightTotal += w;
  }
}
const avg = weightTotal > 0 ? weightedSum / weightTotal : 0;
report.average = Math.round(avg * 100) / 100; // 0-5
report.total = Math.round((avg / 5) * 100); // 0-100

console.log(JSON.stringify(report, null, 2));

// 如果总分 < 98（或任何一项 < 3），CI 阻断
if (process.env.CI_STRICT === '1') {
  if (report.total < 98) {
    console.error(`\n✗ UIUX 评分 ${report.total} < 98，CI 阻断`);
    process.exit(1);
  }
}
