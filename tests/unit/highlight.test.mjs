// 语法着色扫描器（src/web/frontend/components/asset/highlight/）的单元测试。
//
// 断言的是**不变量**：把返回的段按序拼回去必须逐字等于入参。
// 这条是叠加层能成立的前提——<pre> 是照着同一份文本画的，丢一个字符或吞一个换行，
// 就会与下面的 textarea 整体串行（且错位向下累积，前几行看不出来）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../../src/web/frontend/components/asset/highlight/index.js';

const LANGS = ['html', 'svg', 'css', 'js'];

const CORPUS = [
  '',
  'a',
  '\n',
  '\n\n\n',
  '   ',
  '\t\n\t',
  // HTML / SVG
  '<div class="a">hi</div>',
  '<!doctype html>\n<html><body>x</body></html>',
  '<img src=x width=48 />',
  '<!-- 注释里带 <tag> 与 "引号" -->',
  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>',
  '<input value="a=b=c">',
  "<a href='x' disabled>",
  '<div', // 未闭合的标签（用户正在打字的中间态）
  '</div>',
  // 内联 style / script 走子扫描器
  '<style>\n.phone { color: #6c63ff; }\n</style>',
  '<script>\nconst a = 1; // 注释\n</script>',
  '<style>body{color:red}', // 未闭合的 <style>：剩余全文当 CSS，也不能丢字符
  '<script src="x.js"></script>',
  // CSS
  '.a { color: #fff; }',
  'a:hover::before { content: "};"; }', // 字符串里带 '}' —— 不能把花括号当结构
  '@media (max-width: 900px) { .b { margin: 0 auto; } }',
  '.x { background: url(a"b.png); }',
  '/* 未闭合注释',
  '.n { width: calc(100% - 20px); transition: left .4s cubic-bezier(.65,0,.35,1); }',
  'p { --custom: -webkit-transform; }',
  // JS
  'const a = 1;',
  'function f(x) { return x + 1; }',
  'let s = "a\\"b"; let t = `x${1}y`;',
  '// 行注释\nconst a = 1;',
  '/* 块注释 */',
  'if (a === b) { c(); }',
  'const r = /ab+c/g;', // 正则不做上下文判定，但绝不能丢字符
  'a?.b ?? c;',
  "'未闭合的字符串",
  'const n = 0xFF; const m = 1e-3;',
];

test('着色：任何输入都不丢字符（拼回去 === 原文）', () => {
  for (const lang of LANGS) {
    for (const src of CORPUS) {
      const got = tokenize(src, lang)
        .map((t) => t.text)
        .join('');
      assert.equal(got, src, `lang=${lang} 丢字符，源码=${JSON.stringify(src)}`);
    }
  }
});

test('着色：空输入返回空段', () => {
  for (const lang of LANGS) assert.deepEqual(tokenize('', lang), []);
  assert.deepEqual(tokenize(null, 'js'), []);
  assert.deepEqual(tokenize(undefined, 'css'), []);
});

test('着色：未知语言整段原样返回（不猜、不丢）', () => {
  const src = 'whatever ~~~';
  assert.deepEqual(tokenize(src, 'brainfuck'), [{ type: '', text: src }]);
});

test('着色：内联 <style> 的内容按 CSS 上色（不是一整块纯文本）', () => {
  const toks = tokenize('<style>\n.phone { color: #6c63ff; }\n</style>', 'html');
  const types = new Set(toks.map((t) => t.type));
  assert.ok(types.has('prop'), '内联样式里的属性名应被识别');
  assert.ok(types.has('num'), '十六进制色值应被识别');
  assert.ok(
    toks.some((t) => t.type === 'tag' && t.text.toLowerCase() === 'style'),
    '<style> 标签本身仍是标签'
  );
});

test('着色：CSS 字符串里的花括号不改变结构判定', () => {
  const toks = tokenize('a::before { content: "};"; }', 'css');
  const strTok = toks.find((t) => t.type === 'str');
  assert.equal(strTok?.text, '"};"');
});

test('着色：JS 关键字与函数名被区分开', () => {
  const toks = tokenize('function f() {}', 'js');
  assert.ok(toks.some((t) => t.type === 'key' && t.text === 'function'));
  assert.ok(toks.some((t) => t.type === 'fn' && t.text === 'f'));
});
