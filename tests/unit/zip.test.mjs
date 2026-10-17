// zip 读写器与「zip 来源导入」的行为契约。
//
// 盯三件事：
//   1. 读得回自己写的包（store），也读得回别处压的包（deflate）——后者是常态，
//      用户从设计稿/资源管理器拿到的包不会是我们的 store 格式
//   2. 坏包 / 坏条目**如实报错**，不静默少导几个文件（多文件操作最怕静默）
//   3. zip 来源与目录来源走同一核心：zip-slip 路径与非 .svg 被滤掉，
//      --dry-run 不落库，重复导入是跳过而不是覆盖
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import { crc32, unzipStore, zipStore } from '../../src/core/zip.js';
import { exportZip as exportSvgZip, importDir, importZipBuffer } from '../../src/core/svg/set.js';
import * as assetSet from '../../src/core/assets/set.js';
import { EXPORT_ZIP_RE, handleZipDownload } from '../../src/runtime/zip-download.js';
import { IMPORT_ZIP_RE, handleZipUpload } from '../../src/runtime/zip-upload.js';
import * as st from '../../src/core/assets/storage.js';
import { sandbox } from './sandbox.mjs';

const PLUS = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>加号</title><path d="M12 5v14M5 12h14"/></svg>';
const MINUS = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>减号</title><path d="M5 12h14"/></svg>';

// 手搓一个全 deflate 的 zip：模拟「别处打包来的压缩包」
// （资源管理器右键压缩、CI 产物都是 deflate，不是我们的 store）。
function zipWithDeflate(entries) {
  const dosTime = 0x4000; // 任意合法时间即可
  const dosDate = 0x5000;
  const parts = [];
  const central = [];
  let offset = 0;

  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8');
    const raw = Buffer.from(e.data, 'utf8');
    const comp = deflateRawSync(raw);
    const crc = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8); // 8 = deflate
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, name, comp);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt16LE(dosTime, 12);
    cd.writeUInt16LE(dosDate, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(comp.length, 20);
    cd.writeUInt32LE(raw.length, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, name);

    offset += local.length + name.length + comp.length;
  }

  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, centralBuf, eocd]);
}

test('zip：store 往返一致（含中文目录名与嵌套路径）', () => {
  const entries = [
    { name: 'ui/按钮/plus.svg', data: PLUS },
    { name: 'ui/按钮/empty.svg', data: '' },
    { name: 'readme.md', data: '# 图标包\n中文正文' },
  ];
  const out = unzipStore(zipStore(entries));
  assert.deepEqual(
    out.map((e) => e.name),
    ['ui/按钮/plus.svg', 'ui/按钮/empty.svg', 'readme.md']
  );
  assert.equal(out[0].data.toString('utf8'), PLUS);
  assert.equal(out[1].data.length, 0, '空文件也要在');
  assert.equal(out[2].data.toString('utf8'), '# 图标包\n中文正文');
});

test('zip：deflate 条目（别处压的包）照样读得回', () => {
  const out = unzipStore(zipWithDeflate([{ name: 'pkg/plus.svg', data: PLUS }]));
  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'pkg/plus.svg');
  assert.equal(out[0].data.toString('utf8'), PLUS);
});

test('zip：非 zip 内容与损坏数据都如实报错', () => {
  assert.throws(() => unzipStore(Buffer.from('这明显不是 zip')), /不是有效的 zip/);

  // 数据段改一个字节：CRC 必须拦住，不能把坏内容当好的导进去
  const zip = zipStore([{ name: 'a.svg', data: PLUS }]);
  const at = zip.indexOf(Buffer.from(PLUS));
  assert.ok(at > 0, '测试自身要能定位到数据段');
  zip[at] = 0x41;
  assert.throws(() => unzipStore(zip), /CRC/);
});

test('importZipBuffer：只收 .svg，滤掉目录条目 / 非 svg / .. 路径', () => {
  sandbox();
  const zip = zipStore([
    { name: 'pkg/', data: '' },
    { name: 'pkg/readme.txt', data: '不是图标' },
    { name: '../escape.svg', data: PLUS },
    { name: 'pkg/ok.svg', data: PLUS },
  ]);
  const r = importZipBuffer({ kind: 'svg', group: 'z/pkg', zip, labelFrom: 'filename' });
  assert.equal(r.total, 1, '只有 pkg/ok.svg 该被收下');
  assert.equal(r.imported[0].name, 'ok');

  // 一个 .svg 都没有：报错而不是「导入 0 个」
  assert.throws(
    () => importZipBuffer({ kind: 'svg', group: 'z/none', zip: zipStore([{ name: 'a.txt', data: 'x' }]) }),
    /没有可导入的 \.svg/
  );
  // 分组非法：入口就拦
  assert.throws(() => importZipBuffer({ kind: 'svg', group: '', zip }), /分组路径不能为空/);
});

test('zip 与目录两条来源共用同一套查重：同名派生直接拦截', () => {
  sandbox();
  const zip = zipStore([
    { name: 'a/icon.svg', data: PLUS },
    { name: 'b/icon.svg', data: MINUS },
  ]);
  assert.throws(
    () => importZipBuffer({ kind: 'svg', group: 'z/dup', zip, labelFrom: 'filename' }),
    /会派生同名资源/
  );
});

test('importDir --from x.zip：dry-run 不落库，重复导入是跳过', () => {
  sandbox();
  const dir = mkdtempSync(join(tmpdir(), 'nx-ft-zip-'));
  const zipPath = join(dir, 'icons.zip');
  writeFileSync(zipPath, zipStore([{ name: 'outline/plus.svg', data: PLUS }, { name: 'outline/minus.svg', data: MINUS }]));

  const dry = importDir({ kind: 'svg', group: 'zip/icons', from: zipPath, labelFrom: 'title', dryRun: true });
  assert.equal(dry.dryRun, true);
  assert.equal(dry.total, 2);
  assert.deepEqual(dry.plan.map((p) => p.name).sort(), ['minus', 'plus']);
  assert.equal(st.loadGroup('svg', 'zip/icons'), null, 'dry-run 不该建分组、不该落库');

  const r = importDir({ kind: 'svg', group: 'zip/icons', from: zipPath, labelFrom: 'title' });
  assert.equal(r.imported.length, 2);
  assert.equal(r.groupCreated, true);
  // 注意排序按 UTF-16 码位：减(U+51CF) < 加(U+52A0)
  assert.deepEqual(r.imported.map((i) => i.label).sort(), ['减号', '加号'], '展示名取 <title>');
  assert.equal(r.imported[0].bytes > 0, true);

  const again = importDir({ kind: 'svg', group: 'zip/icons', from: zipPath, labelFrom: 'title' });
  assert.equal(again.imported.length, 0);
  assert.equal(again.skipped.length, 2, '重复导入是跳过，不是静默覆盖');

  assert.throws(() => importDir({ kind: 'svg', group: 'zip/icons', from: join(dir, 'nope.zip') }), /不存在或不可读/);
});

test('svg pick 导出：dir 项递归子目录（group 模式只导出该组本身）', () => {
  sandbox();
  // 父目录一个资源，子目录一个资源
  importZipBuffer({ kind: 'svg', group: 'pick/parent', zip: zipStore([{ name: 'plus.svg', data: PLUS }]), labelFrom: 'filename' });
  importZipBuffer({ kind: 'svg', group: 'pick/parent/child', zip: zipStore([{ name: 'minus.svg', data: MINUS }]), labelFrom: 'filename' });

  // group 模式：只导出父组本身，不含子目录
  const g = exportSvgZip({ kind: 'svg', group: 'pick/parent' });
  assert.equal(g.count, 1);
  assert.deepEqual(unzipStore(g.buffer).map((e) => e.name), ['pick/parent/plus.svg']);

  // pick 模式（右键目录"导出整个文件夹"）：递归含子目录
  const p = exportSvgZip({ kind: 'svg', pick: [{ type: 'dir', path: 'pick/parent' }] });
  assert.equal(p.count, 2);
  assert.deepEqual(
    unzipStore(p.buffer).map((e) => e.name).sort(),
    ['pick/parent/child/minus.svg', 'pick/parent/plus.svg']
  );
  assert.match(p.filename, /svg-pick-2/);

  // asset 单列：只取该资源
  const one = exportSvgZip({ kind: 'svg', pick: [{ type: 'asset', key: 'pick/parent/child/minus' }] });
  assert.equal(one.count, 1);
  assert.deepEqual(unzipStore(one.buffer).map((e) => e.name), ['pick/parent/child/minus.svg']);

  // 空选区 / 非法项：如实报错
  assert.throws(() => exportSvgZip({ kind: 'svg', pick: [] }), /pick 不能为空/);
  assert.throws(() => exportSvgZip({ kind: 'svg', pick: [{ type: 'bad' }] }), /必须是 dir 或 asset/);
});

// ---- html 域：一资源一目录三件套（core/assets/set.js） ----
// 与上面 svg 那组对应：同一套规矩（查重、dry-run、跳过不覆盖、条目过滤），
// 换的只是「约定」——平铺单文件 vs 一资源一目录。

const HTML_MAIN = '<!doctype html><html><head><title>会员卡片</title></head><body><div class="vip">Hi</div></body></html>';
const CSS_MAIN = '.vip { color: #333; }';
const JS_MAIN = 'console.log("vip");';

const TRIPLE = (dir) => [
  { name: dir + '/', data: '' },
  { name: dir + '/index.html', data: HTML_MAIN },
  { name: dir + '/style.css', data: CSS_MAIN },
  { name: dir + '/script.js', data: JS_MAIN },
];

test('html 三件套：zip 导入按目录成资源，三个槽位各就各位', () => {
  sandbox();
  const zip = zipStore([...TRIPLE('卡片模板/会员卡片'), { name: 'readme.md', data: '不是资源' }]);
  const r = assetSet.importZipBuffer({ kind: 'html', group: 'cards', zip, labelFrom: 'title' });
  assert.equal(r.total, 1);
  assert.equal(r.imported[0].name, '会员卡片');
  assert.deepEqual(r.imported[0].slots.sort(), ['css', 'html', 'js']);
  assert.equal(r.imported[0].label, '会员卡片', '展示名取 <title>');

  const code = st.readCodeFiles('html', 'cards', '会员卡片', 'default', ['html', 'css', 'js']);
  assert.equal(code.html, HTML_MAIN);
  assert.equal(code.css, CSS_MAIN);
  assert.equal(code.js, JS_MAIN);
});

test('html 三件套：缺件也能导；整包没有资源目录则如实报错', () => {
  sandbox();
  const partial = assetSet.importZipBuffer({
    kind: 'html',
    group: 'cards',
    zip: zipStore([{ name: 'x/只有样式/style.css', data: CSS_MAIN }]),
    labelFrom: 'filename',
  });
  assert.deepEqual(partial.imported[0].slots, ['css'], '只有一件也成资源（导出端也只写非空槽位，往返才守恒）');

  assert.throws(
    () =>
      assetSet.importZipBuffer({
        kind: 'html',
        group: 'cards',
        zip: zipStore([{ name: 'a.html', data: HTML_MAIN }, { name: 'pkg/readme.md', data: 'x' }]),
      }),
    /没有可导入的资源目录/
  );
});

test('html 三件套：同名目录（不同上级）在写入前拦截', () => {
  sandbox();
  const zip = zipStore([...TRIPLE('a/dup'), ...TRIPLE('b/dup')]);
  assert.throws(() => assetSet.importZipBuffer({ kind: 'html', group: 'z/dup', zip }), /会派生同名资源/);
});

test('html 三件套：导出目录 / zip 与导入往返恒等，dry-run 不落库', () => {
  sandbox();
  assetSet.importZipBuffer({ kind: 'html', group: 'cards', zip: zipStore(TRIPLE('会员卡片')), labelFrom: 'title' });

  const out = mkdtempSync(join(tmpdir(), 'nx-ft-html-out-'));
  const ex = assetSet.exportDir({ kind: 'html', group: 'cards', to: out });
  assert.equal(ex.exported.length, 1);
  assert.ok(existsSync(join(out, 'cards', '会员卡片', 'index.html')));
  assert.ok(existsSync(join(out, 'cards', '会员卡片', 'style.css')));
  assert.ok(existsSync(join(out, 'cards', '会员卡片', 'script.js')));

  // 导出的目录再导进另一个分组：三件套内容逐字节一致
  const dry = assetSet.importDir({ kind: 'html', group: 'cards2', from: join(out, 'cards'), dryRun: true });
  assert.equal(dry.dryRun, true);
  assert.equal(st.loadGroup('html', 'cards2'), null, 'dry-run 不该建分组');

  const back = assetSet.importDir({ kind: 'html', group: 'cards2', from: join(out, 'cards'), labelFrom: 'filename' });
  assert.equal(back.imported.length, 1);
  const code = st.readCodeFiles('html', 'cards2', '会员卡片', 'default', ['html', 'css', 'js']);
  assert.equal(code.html, HTML_MAIN);
  assert.equal(code.css, CSS_MAIN);
  assert.equal(code.js, JS_MAIN);

  // zip 出口同源：同一批资源，导入照旧成立
  const z = assetSet.exportZip({ kind: 'html', group: 'cards' });
  assert.equal(z.count, 1);
  const again = assetSet.importZipBuffer({ kind: 'html', group: 'cards3', zip: z.buffer, labelFrom: 'filename' });
  assert.equal(again.imported.length, 1);
  assert.equal(again.imported[0].slots.sort().join(','), 'css,html,js');

  // 重复导入是跳过而不是覆盖
  const dup = assetSet.importZipBuffer({ kind: 'html', group: 'cards3', zip: z.buffer, labelFrom: 'filename' });
  assert.equal(dup.imported.length, 0);
  assert.equal(dup.skipped.length, 1);
});

// color 域的 zip 往返见 zip-color.test.mjs（单 data 槽，按域拆分以控行数）。

// ---- HTTP 分派：/api/<kind>/{import,export}.zip ----
// 假 req/res 直调 handler：这层钉的是「kind 从路径来、走对那份约定」，
// 不依赖起服务（dev 服务在跑时才谈得上浏览器实测）。

function fakeReq(buf, method = 'POST') {
  return {
    method,
    headers: {},
    async *[Symbol.asyncIterator]() {
      if (buf && buf.length) yield buf;
    },
  };
}

function fakeRes() {
  return {
    code: 0,
    headers: {},
    body: null,
    writeHead(code, headers) {
      this.code = code;
      this.headers = headers || {};
    },
    end(b) {
      this.body = Buffer.isBuffer(b) ? b : Buffer.from(String(b ?? ''), 'utf8');
    },
  };
}

test('HTTP 分派：/api/<kind>/{import,export}.zip 按路径里的 kind 走对约定', async () => {
  sandbox();

  // 路径表：两种 kind 都命中；不是「以 .zip 结尾就吞」
  assert.equal(IMPORT_ZIP_RE.exec('/api/html/import.zip')[1], 'html');
  assert.equal(IMPORT_ZIP_RE.exec('/api/svg/import.zip')[1], 'svg');
  assert.equal(IMPORT_ZIP_RE.exec('/api/html/import.zip.bak'), null);
  assert.equal(EXPORT_ZIP_RE.exec('/api/html/export.zip')[1], 'html');

  // 上传：kind 由路径决定（不信请求体里的任何东西），落到三件套核心
  const zip = zipStore(TRIPLE('会员卡片'));
  const up = fakeRes();
  await handleZipUpload(fakeReq(zip), up, new URL('http://127.0.0.1/api/html/import.zip?group=http-io'), 'html');
  assert.equal(up.code, 200);
  const data = JSON.parse(up.body.toString('utf8')).data;
  assert.equal(data.imported.length, 1);
  assert.equal(st.readCodeFiles('html', 'http-io', '会员卡片', 'default', ['html']).html, HTML_MAIN);

  // 未知 kind：404，且不读体、不落库
  const bad = fakeRes();
  await handleZipUpload(fakeReq(zip), bad, new URL('http://127.0.0.1/api/md/import.zip'), 'md');
  assert.equal(bad.code, 404);

  // 下载：同一个 kind，回 zip 二进制 + 下载头（面板 fetch 后从 header 取文件名）
  const down = fakeRes();
  await handleZipDownload(fakeReq(null, 'GET'), down, new URL('http://127.0.0.1/api/html/export.zip?group=http-io'), 'html');
  assert.equal(down.code, 200);
  assert.match(down.headers['content-disposition'], /attachment/);
  assert.equal(
    unzipStore(down.body).map((e) => e.name).sort().join(','),
    'http-io/会员卡片/index.html,http-io/会员卡片/script.js,http-io/会员卡片/style.css'
  );
});
