// SVG 颜色面板纯函数层（svg/color-utils.js）的单元测试：
// 解析与规范化 / 格式互转 / 和声派生 / 对比度 / 最近使用色。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalHex,
  contrastInfo,
  formatAs,
  harmonyColors,
  hexToHsl,
  hexToRgb,
  hslInputToHex,
  hslToHex,
  normalizeHex,
  pushRecent,
  rgbInputToHex,
  rgbToHex,
} from '../../src/web/frontend/components/svg/color-utils.js';

test('normalizeHex：认得 #rgb / #rgba / #rrggbb / #rrggbbaa / 无 # / 0x，认不得给 null', () => {
  assert.equal(normalizeHex('#abc'), '#AABBCC');
  assert.equal(normalizeHex('#abcd'), '#AABBCCDD');
  assert.equal(normalizeHex('#2b3445'), '#2B3445');
  assert.equal(normalizeHex('2b3445'), '#2B3445');
  assert.equal(normalizeHex('0xABC'), '#AABBCC');
  assert.equal(normalizeHex('#2b3445ff'), '#2B3445FF');
  assert.equal(normalizeHex('#zzz'), null);
  assert.equal(normalizeHex('#12345'), null, '5 位不是合法长度');
  assert.equal(normalizeHex(''), null);
  assert.equal(normalizeHex(null), null);
});

test('canonicalHex：统一大写；alpha = FF 视为不透明，塌回 6 位', () => {
  assert.equal(canonicalHex('#2b3445'), '#2B3445');
  assert.equal(canonicalHex('#2b3445ff'), '#2B3445', '不透明就不带第 8 位');
  assert.equal(canonicalHex('#2b344580'), '#2B344580', '半透明保留第 8 位');
  assert.equal(canonicalHex('#abc'), '#AABBCC');
  assert.equal(canonicalHex('nope'), null);
});

test('hexToRgb / rgbToHex：互转闭环；越界分量被夹回 0-255', () => {
  assert.deepEqual(hexToRgb('#FF8000'), { r: 255, g: 128, b: 0, a: 1 });
  assert.ok(Math.abs(hexToRgb('#FF000080').a - 0.502) < 0.001, '8 位末两字节 = 透明度');
  assert.equal(hexToRgb('#zzz'), null);
  assert.equal(rgbToHex({ r: 255, g: 128, b: 0 }), '#FF8000');
  assert.equal(rgbToHex({ r: 300, g: -5, b: 0 }), '#FF0000');
  assert.equal(rgbToHex({ r: 0, g: 0, b: 0, a: 0.5 }), '#00000080');
});

test('hexToHsl / hslToHex：互转闭环（红绿蓝三原色卡死）', () => {
  assert.deepEqual(hexToHsl('#FF0000'), { h: 0, s: 1, l: 0.5, a: 1 });
  assert.deepEqual(hexToHsl('#00FF00'), { h: 120, s: 1, l: 0.5, a: 1 });
  assert.deepEqual(hexToHsl('#0000FF'), { h: 240, s: 1, l: 0.5, a: 1 });
  assert.equal(hslToHex({ h: 120, s: 1, l: 0.5 }), '#00FF00');
  assert.equal(hslToHex({ h: 0, s: 1, l: 0.5 }), '#FF0000');
});

test('formatAs：三种口径；带透明度时给 rgba / hsla', () => {
  assert.equal(formatAs('#ff0000', 'hex'), '#FF0000');
  assert.equal(formatAs('#FF0000', 'rgb'), 'rgb(255, 0, 0)');
  assert.equal(formatAs('#FF0000', 'hsl'), 'hsl(0, 100%, 50%)');
  assert.equal(formatAs('#FF000080', 'rgb'), 'rgba(255, 0, 0, 0.502)');
  assert.equal(formatAs('#FF000080', 'hsl'), 'hsla(0, 100%, 50%, 0.502)');
  assert.equal(formatAs('nope', 'rgb'), '');
});

test('rgbInputToHex / hslInputToHex：数值输入的入口（HSL 用 0-100 百分比）', () => {
  assert.equal(rgbInputToHex(255, 0, 0, 1), '#FF0000');
  assert.equal(rgbInputToHex(255, 0, 0, 0.5), '#FF000080');
  assert.equal(hslInputToHex(120, 100, 50, 1), '#00FF00');
});

test('harmonyColors：色相偏移派生；单色走明度不走色相', () => {
  assert.deepEqual(harmonyColors('#FF0000', 'complementary'), ['#00FFFF']);
  assert.deepEqual(harmonyColors('#FF0000', 'triadic'), ['#00FF00', '#0000FF']);
  assert.deepEqual(harmonyColors('#FF0000', 'split'), ['#00FF80', '#0080FF']);
  assert.deepEqual(harmonyColors('#FF0000', 'analogous'), ['#FF0080', '#FF8000']);
  assert.deepEqual(harmonyColors('#FF0000', 'monochrome'), ['#FF7070', '#8F0000']);
  assert.deepEqual(harmonyColors('nope', 'triadic'), []);
  assert.deepEqual(harmonyColors('#FF0000', 'not-a-type'), []);
});

test('contrastInfo：深色压白字、浅色压墨字；对比度值给出', () => {
  assert.deepEqual(contrastInfo('#000000'), { onWhite: 21, onBlack: 1, ink: '#ffffff' });
  assert.deepEqual(contrastInfo('#FFFFFF'), { onWhite: 1, onBlack: 21, ink: '#14161a' });
  assert.equal(contrastInfo('nope'), null);
});

test('pushRecent：新的排最前、同色去重、认不出就原样返回', () => {
  assert.deepEqual(pushRecent(['#111111', '#222222'], '#333333'), ['#333333', '#111111', '#222222']);
  assert.deepEqual(pushRecent(['#111111', '#222222'], '#111111'), ['#111111', '#222222']);
  assert.deepEqual(pushRecent(['#111111'], '#111111ff'), ['#111111'], '同色不同写法算同一个');
  assert.deepEqual(pushRecent(['#111111'], 'nope'), ['#111111']);
  assert.deepEqual(pushRecent(null, '#111111'), ['#111111']);
  assert.equal(pushRecent([], '#111111', 0).length, 0, 'max 生效');
});
