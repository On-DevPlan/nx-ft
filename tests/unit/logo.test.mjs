// LOGO 生成模块单元测试：方案表、SVG/PNG/ICO 二进制结构、全套落盘、冲突保护。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SCHEMES, listSchemes, normalizeHex, resolveScheme } from '../../src/core/logo/schemes.js';
import { generateAll, logoPng, logoSvg } from '../../src/core/logo/gen.js';
import * as gallery from '../../src/core/logo/gallery.js';

test('撞色方案：14 套、色值合法、含家族原表与新增配色', () => {
  const list = listSchemes();
  assert.equal(list.length, 14);
  for (const s of list) {
    assert.match(s.bg, /^#[0-9A-F]{6}$/, s.key + ' bg');
    assert.match(s.fg, /^#[0-9A-F]{6}$/, s.key + ' fg');
  }
  for (const key of ['mars', 'klein', 'hermes', 'prussian', 'ink', 'ash', 'lemon', 'coral']) {
    assert.ok(SCHEMES[key], '缺方案 ' + key);
  }
});

test('resolveScheme：默认 / 未知拒绝 / 自定义色归一化覆盖', () => {
  assert.equal(resolveScheme().key, 'mars');
  assert.equal(resolveScheme('ink').bg, '#14161A');
  assert.throws(() => resolveScheme('nope'), /方案不存在/);
  const custom = resolveScheme('ink', { bg: 'ff0000', fg: '#00ff00' });
  assert.equal(custom.bg, '#FF0000');
  assert.equal(custom.fg, '#00FF00');
  assert.match(custom.name, /自定义/);
  assert.throws(() => normalizeHex('xyz'), /十六进制/);
});

test('SVG：尺寸/圆角比/方案色/字母都在', () => {
  const svg = logoSvg('ab', 'klein');
  assert.match(svg, /<svg[^>]*width="512"/);
  assert.ok(svg.includes('#002EA6'));
  assert.ok(svg.includes('#FFE76F'));
  assert.ok(svg.includes('>ab</text>'));
  assert.ok(svg.includes('rx="113"')); // 512 * 0.22
  const square = logoSvg('ab', resolveScheme('mars', { bg: '#111111', fg: '#EEEEEE' }), {
    size: 256,
    rounded: false,
  });
  assert.ok(square.includes('#111111'));
  assert.ok(square.includes('rx="0"'));
});

test('PNG：签名 / 尺寸头 / 背景开关产生不同数据', () => {
  const png = logoPng('xy', 'ink', { size: 32 });
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(png.readUInt32BE(16), 32); // IHDR width
  assert.equal(png.readUInt32BE(20), 32); // IHDR height
  const withBg = logoPng('xy', 'ink', { size: 32, bg: true });
  const noBg = logoPng('xy', 'ink', { size: 32, bg: false });
  assert.notDeepEqual([...withBg.subarray(0, 40)], [...noBg.subarray(0, 40)]);
});

test('generateAll：产出 8 件、ico 容器头正确', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nx-ft-logo-'));
  const { files, note } = generateAll(dir, 'nx', 'mars');
  assert.equal(files.length, 8);
  for (const f of files) assert.ok(existsSync(join(dir, f)), '缺文件 ' + f);
  const ico = readFileSync(join(dir, 'favicon.ico'));
  assert.equal(ico.readUInt16LE(2), 1); // type = icon
  assert.equal(ico.readUInt16LE(4), 3); // 3 张图
  assert.match(note, /马尔斯绿/);
});

test('gallery.generate：画廊路径 + 历史登记；--out 补旧项目与冲突保护', () => {
  const data = mkdtempSync(join(tmpdir(), 'nx-ft-logo-data-'));
  process.env.NX_FT_DATA = data;

  const r1 = gallery.generate({ letters: 'nx', scheme: 'ink' });
  assert.equal(r1.status, 'ok');
  assert.ok(r1.dir.startsWith(data), '画廊产物应在数据目录内');
  assert.equal(r1.files.length, 8);

  const h = gallery.listHistory();
  assert.equal(h.records.length, 1);
  assert.equal(h.records[0].letters, 'nx');

  // 补旧项目：指定目录直写
  const old = mkdtempSync(join(tmpdir(), 'nx-ft-oldproj-'));
  const r2 = gallery.generate({ letters: 'ab', out: old });
  assert.equal(r2.status, 'ok');
  // 再写一次 → 有同名文件，先 conflict（不是错误，是让调用方决策）
  const r3 = gallery.generate({ letters: 'ab', out: old });
  assert.equal(r3.status, 'conflict');
  assert.ok(r3.existing.includes('logo.svg'));
  // force 放行
  const r4 = gallery.generate({ letters: 'ab', out: old, force: true });
  assert.equal(r4.status, 'ok');
  assert.equal(gallery.listHistory().records.length, 3);
});

test('非法输入：字母 1~5 / 尺寸 16~2048 / 未知方案', () => {
  const data = mkdtempSync(join(tmpdir(), 'nx-ft-logo-bad-'));
  process.env.NX_FT_DATA = data;
  assert.throws(() => gallery.generate({ letters: 'abcdef' }), /1~5 位/);
  assert.throws(() => gallery.generate({ letters: 'a b' }), /1~5 位/);
  assert.throws(() => gallery.generate({ letters: '' }), /1~5 位/);
  assert.throws(() => gallery.generate({ letters: 'ab', size: 8 }), /16~2048/);
  assert.throws(() => gallery.generate({ letters: 'ab', scheme: 'zzz' }), /方案不存在/);
});
