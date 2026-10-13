// SVG 图标规范：解析 / 审计 / 归一化。
//
// 这三件事是整个「图标集」功能的地基——看板角标、`svg spec check` 的每一行、
// `svg spec fix` 写的每一个字节都出自它们。所以这里盯的是**行为契约**，不是实现细节：
//   1. 什么算「写死颜色」/「线宽不一致」（含子图元）
//   2. 换 viewBox 时必须等比缩放内容（漏了会放大 33%，且是静默的）
//   3. 长宽比不一致时**拒绝**迁移（强行等比会把图形压扁）
//   4. 幂等：修完再修，改动为零
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ICON_SPEC,
  auditSvg,
  collectColors,
  collectStrokeWidths,
  normalizeSvg,
  parseViewBox,
  parseSvg,
} from '../../src/core/svg/spec.js';

const GOOD = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><title>加号</title><path d="M12 5v14M5 12h14"/></svg>`;

// 三处违规叠在一起：32pt 网格、写死颜色、线宽 2.4，外加写死宽高
const BAD = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="#2B3445" stroke-width="2.4"><path d="M16 5l3.4 6.9 7.6 1.1-5.5 5.4 1.3 7.6L16 22.4 9.2 26l1.3-7.6L5 13l7.6-1.1z"/></svg>`;

const codes = (issues) => issues.map((i) => i.code);

test('parseSvg：合规图标的结构信息', () => {
  const m = parseSvg(GOOD);
  assert.equal(m.ok, true);
  assert.equal(m.viewBox, ICON_SPEC.viewBox);
  assert.equal(m.hasSize, false, '合规骨架不该有写死的 width/height');
  assert.equal(m.stats.elements, 1, '应数出 1 个图元');
  assert.deepEqual(m.colors, [], 'currentColor 不算写死颜色');
  assert.deepEqual(m.strokeWidths, ['1.8']);
});

test('parseSvg：没有 <svg> 根元素时给出明确错误而不是抛异常', () => {
  const m = parseSvg('<div>不是图标</div>');
  assert.equal(m.ok, false);
  assert.match(m.error, /svg/);
  assert.equal(m.root, null);
});

test('auditSvg：合规图标零问题', () => {
  const r = auditSvg(GOOD);
  assert.equal(r.ok, true);
  assert.deepEqual(r.issues, []);
});

test('auditSvg：逐条报出违规（viewBox / 写死尺寸 / 颜色 / 线宽）', () => {
  const r = auditSvg(BAD);
  const c = codes(r.issues);
  for (const want of ['viewbox', 'fixed-size', 'hardcoded-color', 'stroke-width']) {
    assert.ok(c.includes(want), `应报出 ${want}，实际: ${c.join(', ')}`);
  }
  // 每条都要带「怎么改」，否则面板上那一行只能干瞪眼
  for (const i of r.issues) {
    assert.ok(i.message, '问题应有 message');
    assert.ok(i.hint, `${i.code} 缺少 hint`);
    assert.ok(i.level === 'warn' || i.level === 'error');
  }
});

test('auditSvg：空壳 <svg> 是阻断级错误（自动修不了）', () => {
  const r = auditSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"></svg>');
  assert.equal(r.ok, false);
  assert.ok(codes(r.issues).includes('empty'));
});

test('auditSvg：profile=color 不管线性图标的 fill/stroke', () => {
  // 一张插画不该被强行改成描边风格
  const plain = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>';
  const line = codes(auditSvg(plain, { profile: 'line' }).issues);
  assert.deepEqual(line.filter((x) => x === 'fill' || x === 'stroke').length, 2);
  const color = codes(auditSvg(plain, { profile: 'color' }).issues);
  assert.deepEqual(color.filter((x) => x === 'fill' || x === 'stroke'), []);
});

test('collectColors：跳过 none / currentColor / url() / var()，抓到属性值与内联 CSS', () => {
  const src = [
    'stroke="currentColor"',
    'fill="none"',
    'fill="url(#grad)"',
    'stroke="#5B7CFA"',
    'stroke-width="var(--w)"',
    '<style>.a{fill:#333;stroke:currentColor}</style>',
  ].join(' ');
  // `#5B7CFA` 这条是回归锁：取值模式早先不含引号分支，
  // 于是最常见的属性写法从来没被报成 hardcoded-color，而 fix 照改不误。
  assert.deepEqual(collectColors(src).sort(), ['#333', '#5B7CFA']);
});

test('auditSvg：子图元上的写死颜色也要报（根元素看着合规的那种）', () => {
  const src =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path fill="#5B7CFA" d="M4 12h16"/></svg>';
  assert.ok(codes(auditSvg(src).issues).includes('hardcoded-color'));
});

test('线宽：var(--x) 是刻意的主题变量，不算不规范（否则永远修不掉）', () => {
  const src =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="var(--sw)" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16"/></svg>';
  assert.deepEqual(collectStrokeWidths(src), [], 'var() 不该被当成线宽字面量');
  assert.deepEqual(auditSvg(src).issues, [], '审计与归一化必须一致：不能报一个修不掉的项');
});

test('collectStrokeWidths：子图元上的线宽也要抓到（根元素看着合规最难查）', () => {
  const src = '<svg stroke-width="1.8"><circle cx="12" cy="12" r="6" stroke-width="2.4"/></svg>';
  assert.deepEqual(collectStrokeWidths(src).sort(), ['1.8', '2.4']);
  // 这条必须报出来，否则「一组图标里有一个明显更粗」会一直查不出来
  assert.ok(codes(auditSvg(src).issues).includes('stroke-width'));
});

test('审计与归一化对称：check 报出来的每一项，fix 都得能处理掉', () => {
  // 反例集：属性式写死颜色（引号）、子图元线宽、内联 CSS、写死宽高、非方形 viewBox、
  // 以及 var() 引用（不能报，也不能改）
  const samples = [
    BAD,
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path stroke="#333" d="M4 12h16"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><style>.a{stroke:#333}</style><path class="a" d="M4 12h16"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="var(--f)" stroke="var(--s)" stroke-width="var(--sw)" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16"/></svg>',
  ];
  for (const src of samples) {
    const fixed = normalizeSvg(src);
    assert.deepEqual(auditSvg(fixed.code).issues, [], 'fix 之后必须零问题：\n' + fixed.code);
  }
});

test('审计与归一化对称（反向）：fix 不该动审计没报过的东西', () => {
  // 用了 CSS 变量的图标：审计不报，归一化也必须一个字节都不改
  const src =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="var(--f)" stroke="var(--s)" stroke-width="var(--sw)" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16"/></svg>';
  assert.deepEqual(auditSvg(src).issues, []);
  assert.deepEqual(normalizeSvg(src).changed, [], '没报出来的东西不该被悄悄改掉');
});

test('normalizeSvg：换 viewBox 必须等比缩放内容，否则图标会放大 33%', () => {
  const r = normalizeSvg(BAD);
  assert.equal(r.ok, true);
  assert.match(r.code, /viewBox="0 0 24 24"/);
  assert.match(r.code, /<g transform="scale\(0\.75\)">/, '内容应被包进 ×0.75 的变换');
  assert.doesNotMatch(r.code, /viewBox="0 0 32 32"/);
  // 原来写死的 #2B3445 应被换成 currentColor
  assert.doesNotMatch(r.code, /#2B3445/i);
  assert.match(r.code, /stroke="currentColor"/);
});

test('normalizeSvg：长宽比不一致时拒绝迁移 viewBox（强行等比会把图形压扁）', () => {
  const wide = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8h28"/></svg>';
  const r = normalizeSvg(wide);
  assert.match(r.code, /viewBox="0 0 32 16"/, '应保留原 viewBox');
  assert.ok(
    r.changed.some((c) => /长宽比/.test(c)),
    '应说明为什么没换，实际改动: ' + r.changed.join(' / ')
  );
});

test('normalizeSvg：幂等——修完再修，改动为零', () => {
  const once = normalizeSvg(BAD);
  const twice = normalizeSvg(once.code);
  assert.equal(twice.ok, true);
  assert.deepEqual(twice.changed, [], '第二次不应产生任何改动');
  assert.equal(twice.code, once.code, '也不应改写内容');
});

test('normalizeSvg 的产物必然通过审计（round-trip）', () => {
  for (const src of [GOOD, BAD]) {
    const fixed = normalizeSvg(src);
    assert.equal(fixed.ok, true);
    assert.deepEqual(auditSvg(fixed.code).issues, [], '归一化后的源码应零问题');
  }
});

test('parseViewBox：解析与拒绝', () => {
  assert.deepEqual(parseViewBox('0 0 24 24'), { x: 0, y: 0, w: 24, h: 24 });
  assert.deepEqual(parseViewBox('1 2 30 40'), { x: 1, y: 2, w: 30, h: 40 });
  assert.equal(parseViewBox(''), null);
  assert.equal(parseViewBox('0 0 24'), null);
  assert.equal(parseViewBox(undefined), null);
});
