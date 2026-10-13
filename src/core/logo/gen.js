// LOGO 生成：纯 JS 的 SVG + PNG 双产出，零依赖。
//
// 承袭自 nx 家族模板 tools/logo-gen（nx-rp 的 Python 版 → 零依赖 JS）。
// 本项目把它下沉到 core 作为单一源，tools/logo-gen 与 logo 模块共用同一实现，
// 不会出现「两处各有一套、样式慢慢漂移」。
//
// ⚠️ 已知局限（选型时请知情）：
//   SVG 用真实字体（font-family 交给浏览器选），质量好、任意尺寸清晰——首选产物。
//   PNG 走内置 5x7 点阵字模，**只适合 1~5 个字符**；再多点阵放大后的块状感会明显。
//   正解是只出 SVG，PNG 作为 favicon 兜底。
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { SCHEMES, DEFAULT_SCHEME } from './schemes.js';
import { GLYPHS, GW, GH, inkColsOf, inkBounds } from './glyphs.js';

// 圆角卡片比例与字号占比。0.22 是 iOS 图标感的圆角，0.72 让字母在 16px
// favicon 下仍可辨认（再大就顶到圆角边缘，再小就糊成一团）。
const RADIUS_RATIO = 0.22;
const GLYPH_RATIO = 0.72;

// 字体回退链：宽厚粗体在小尺寸下辨识度最好。SVG 里由渲染方（浏览器）选。
const FONT_STACK =
  "Verdana, 'DejaVu Sans', 'Segoe UI', Arial, 'Helvetica Neue', 'Microsoft YaHei', sans-serif";

export function toRGB(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// 方案可以是 key 字符串（工具链旧调用方），也可以是 resolveScheme 的产物
function themeOf(scheme) {
  if (scheme && typeof scheme === 'object' && scheme.bg) return scheme;
  return SCHEMES[scheme] || SCHEMES[DEFAULT_SCHEME];
}

function escapeXml(s) {
  return String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
}

/**
 * 生成 SVG 源码。矢量、无依赖、任意尺寸都清晰——**首选产物**。
 */
export function logoSvg(letters, scheme = DEFAULT_SCHEME, { size = 512, rounded = true } = {}) {
  const s = themeOf(scheme);
  const r = rounded ? Math.round(size * RADIUS_RATIO) : 0;
  const text = escapeXml(letters);

  // 字号按字母数收敛：字越多越小，保证包围盒落在 GLYPH_RATIO 之内
  const fontSize = Math.round((size * GLYPH_RATIO) / Math.max(1, letters.length) / 0.62);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${text}">
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="${s.bg}"/>
  <text x="50%" y="50%" fill="${s.fg}" font-family="${FONT_STACK}"
        font-size="${fontSize}" font-weight="bold" text-anchor="middle"
        dominant-baseline="central">${text}</text>
</svg>
`;
}

// ---- PNG 编码（零依赖手写：zlib 用内置 deflateSync，CRC32 自己算） ----

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// 把 RGBA 像素数组编成 PNG
function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // 每行前置一个 filter 字节（0 = None）
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// 在画布上以给定前景色填充一个点阵字符（每个点展开成 px×px 的方块）。
// 圆角不做——PNG 用于 favicon，方角在 16px 下不可辨，不值得多写一套抗锯齿。
function blitGlyph(px, width, height, glyph, ox, oy, scale, color) {
  const rows = GLYPHS[glyph] || GLYPHS.o;
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      if (rows[gy][gx] !== '1') continue;
      const x0 = ox + gx * scale;
      const y0 = oy + gy * scale;
      for (let y = y0; y < y0 + scale; y++) {
        if (y < 0 || y >= height) continue;
        for (let x = x0; x < x0 + scale; x++) {
          if (x < 0 || x >= width) continue;
          const i = (y * width + x) * 4;
          px[i] = color[0];
          px[i + 1] = color[1];
          px[i + 2] = color[2];
          px[i + 3] = 255;
        }
      }
    }
  }
}

/**
 * 生成圆角/方形卡片的 RGBA 缓冲并编成 PNG。
 */
export function logoPng(letters, scheme = DEFAULT_SCHEME, { size = 512, bg = true } = {}) {
  const s = themeOf(scheme);
  const px = new Uint8Array(size * size * 4);

  if (bg) {
    const c = toRGB(s.bg);
    for (let i = 0; i < size * size * 4; i += 4) {
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
      px[i + 3] = 255;
    }
  }

  const fg = toRGB(s.fg);
  const chars = [...String(letters)].slice(0, 5);
  if (!chars.length) return encodePng(size, size, px);

  // 字号按**墨迹宽度**算，不是按「字母数 × 字模宽」：
  // 'i' 只占 1 列、'm' 占 5 列，按定宽算会让窄字母组成的词明显偏小。
  const GAP_COLS = 1;
  let inkCols = 0;
  const cols = chars.map((ch) => {
    const c = inkColsOf(ch);
    inkCols += c.width;
    return c;
  });
  inkCols += GAP_COLS * Math.max(0, chars.length - 1);

  const scale = Math.max(1, Math.floor((size * GLYPH_RATIO) / inkCols));
  const wordW = inkCols * scale;

  // 垂直居中按墨迹包围盒算：小写只占 x-height，按 em 框居中会明显偏下。
  const bounds = inkBounds(chars);
  const inkRows = bounds.maxRow - bounds.minRow + 1;

  const ox = Math.round((size - wordW) / 2);
  const oy = Math.round((size - inkRows * scale) / 2) - bounds.minRow * scale;

  let x = ox;
  chars.forEach((ch, i) => {
    // 从墨迹左缘起画，去掉字模左侧空白列，否则每个字母左边都多一段空
    blitGlyph(px, size, size, ch, x - cols[i].left * scale, oy, scale, fg);
    x += (cols[i].width + GAP_COLS) * scale;
  });

  return encodePng(size, size, px);
}

// ICO 容器：6 字节头 + 每张图 16 字节目录项 + 数据（Vista 起允许直接嵌 PNG）
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const dirs = [];
  let offset = 6 + images.length * 16;
  for (const img of images) {
    const d = Buffer.alloc(16);
    d[0] = img.size >= 256 ? 0 : img.size; // 宽（256 记 0）
    d[1] = img.size >= 256 ? 0 : img.size; // 高
    d[2] = 0;
    d[3] = 0;
    d.writeUInt16LE(1, 4);
    d.writeUInt16LE(32, 6);
    d.writeUInt32LE(img.png.length, 8);
    d.writeUInt32LE(offset, 12);
    offset += img.png.length;
    dirs.push(d);
  }

  return Buffer.concat([header, ...dirs, ...images.map((i) => i.png)]);
}

/**
 * 一次产出全套 10 件（svg ×2 / png ×2 / favicon png ×3 / ico ×1 …）。
 *
 * @param {string} outDir   目标目录（旧项目的 public、或画廊目录）
 * @param {string} letters  字母（1~5 字符）
 * @param {string|object} scheme  方案 key 或 resolveScheme 的产物
 * @param {{size?: number}} [opts]
 * @returns {{note: string, files: string[]}}
 */
export function generateAll(outDir, letters, scheme = DEFAULT_SCHEME, { size = 512 } = {}) {
  mkdirSync(outDir, { recursive: true });
  const s = themeOf(scheme);
  const files = [];

  // 矢量主 logo：任意尺寸清晰，面板 header 用它
  writeFileSync(join(outDir, 'logo.svg'), logoSvg(letters, s, { size, rounded: false }), 'utf8');
  writeFileSync(join(outDir, 'logo-rounded.svg'), logoSvg(letters, s, { size, rounded: true }), 'utf8');
  files.push('logo.svg', 'logo-rounded.svg');

  // 位图：apple-touch-icon 与不支持 SVG favicon 的老浏览器
  writeFileSync(join(outDir, 'logo.png'), logoPng(letters, s, { size, bg: false }));
  writeFileSync(join(outDir, 'logo-rounded.png'), logoPng(letters, s, { size }));
  files.push('logo.png', 'logo-rounded.png');

  for (const px of [16, 32, 48]) {
    writeFileSync(join(outDir, `favicon-${px}.png`), logoPng(letters, s, { size: px }));
    files.push(`favicon-${px}.png`);
  }

  writeFileSync(join(outDir, 'favicon.ico'), buildIco([
    { size: 16, png: logoPng(letters, s, { size: 16 }) },
    { size: 32, png: logoPng(letters, s, { size: 32 }) },
    { size: 48, png: logoPng(letters, s, { size: 48 }) },
  ]));
  files.push('favicon.ico');

  return {
    note: `logo 已生成（${letters} · ${s.name} ${s.bg}/${s.fg}）`,
    files,
  };
}
