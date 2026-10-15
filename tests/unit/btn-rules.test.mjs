// 按钮行规矩（src/web/frontend/components/btn/rules.js）的单元测试。
//
// 断言的是**规矩本身**：主按钮唯一、且排在最后一位。手搭 { props: { variant } }
// 这种元素对象就能测，不必起渲染器——判据是纯函数，与 React 渲染无关
// （这也是它不放在 index.jsx 里的原因）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPrimary, primaryIssues } from '../../src/web/frontend/components/btn/rules.js';

const sec = () => ({ props: { variant: 'secondary' } });
const pri = () => ({ props: { variant: 'primary' } });
const txt = () => '导出 zip'; // Children.toArray 会把裸字符串变成文本节点

test('isPrimary 只认 variant === primary', () => {
  assert.equal(isPrimary(pri()), true);
  assert.equal(isPrimary(sec()), false);
  assert.equal(isPrimary({ props: {} }), false);
  assert.equal(isPrimary({ props: { variant: 'danger' } }), false);
  assert.equal(isPrimary(null), false);
  assert.equal(isPrimary(txt()), false);
  // 元素的 key / ref 不在 props 上，但拿它们当对象探针时不该被误判成主按钮
  assert.equal(isPrimary({ key: 'a', props: null }), false);
});

test('合规的行没有问题', () => {
  // 次级按钮 → 次级下拉 → 主按钮
  assert.deepEqual(primaryIssues([sec(), sec(), pri()]), []);
  // 只读工具区（批量结果页那类）本来就没有主操作，缺主按钮不是问题
  assert.deepEqual(primaryIssues([sec(), sec()]), []);
  assert.deepEqual(primaryIssues([]), []);
  // 拿不到数组（还没渲染）时也不报
  assert.deepEqual(primaryIssues(null), []);
});

test('第二个主按钮要报出来', () => {
  const issues = primaryIssues([pri(), sec(), pri()]);
  assert.equal(issues.length, 1);
  assert.match(issues[0], /2 个主按钮/);
  assert.match(issues[0], /第 1、3 位/);
});

test('主按钮不在最后要报出来', () => {
  const issues = primaryIssues([pri(), sec()]);
  assert.equal(issues.length, 1);
  assert.match(issues[0], /没排在最后/);
  // 主按钮后面只跟裸文本，也算没排最后（行尾不是它）
  assert.equal(primaryIssues([pri(), txt()]).length, 1);
});

test('三个主按钮连着排在末尾：位置合规，只报「多个」', () => {
  const issues = primaryIssues([pri(), pri(), pri()]);
  assert.equal(issues.length, 1); // 全在末尾连着，位置合规，只报「多个」
  assert.match(issues[0], /3 个主按钮/);
});
