// 最小 ZIP 写入器：只用 store（不压缩），零依赖。
//
// 为什么自己写而不是装 jszip / archiver：这个项目刻意只依赖 react
// （「装完包就能跑」是产品前提），而导出场景的产物是几十个几 KB 的文本文件，
// store 模式完全够用——压缩省下的那点体积不值得引入一个依赖树。
//
// 格式按 PKZIP APPNOTE：每个文件 = 本地头 + 数据；最后是中央目录 + EOCD。
// 文件名一律按 UTF-8 写（通用位标志 0x0800），中文目录名才不会乱码。
import { Buffer } from 'node:buffer';
import { inflateRawSync } from 'node:zlib';
import { badInput } from './errors/index.js';

let TABLE = null;
function crcTable() {
  if (TABLE) return TABLE;
  TABLE = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    TABLE[i] = c >>> 0;
  }
  return TABLE;
}

export function crc32(buf) {
  const t = crcTable();
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// entries: [{ name: 'ui/buttons/login-btn.svg', data: string | Buffer }]
export function zipStore(entries, { date = new Date() } = {}) {
  const dosTime = ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)) & 0xffff;
  const dosDate = (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff;

  const parts = [];
  const central = [];
  let offset = 0;

  for (const e of entries) {
    const name = Buffer.from(String(e.name).replace(/\\/g, '/'), 'utf8');
    const data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(String(e.data ?? ''), 'utf8');
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // 本地文件头签名
    local.writeUInt16LE(20, 4); // 需要的解压版本
    local.writeUInt16LE(0x0800, 6); // 通用位标志：文件名为 UTF-8
    local.writeUInt16LE(0, 8); // 压缩方法：0 = store
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); // 压缩后大小
    local.writeUInt32LE(data.length, 22); // 原始大小
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // 扩展字段长度
    parts.push(local, name, data);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); // 中央目录头签名
    cd.writeUInt16LE(20, 4); // 生成版本
    cd.writeUInt16LE(20, 6); // 需要的解压版本
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(dosTime, 12);
    cd.writeUInt16LE(dosDate, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt32LE(offset, 42); // 本地头相对偏移
    central.push(cd, name);

    offset += local.length + name.length + data.length;
  }

  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // 中央目录结束记录
  eocd.writeUInt16LE(entries.length, 8); // 本盘条目数
  eocd.writeUInt16LE(entries.length, 10); // 总条目数
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20); // 注释长度

  return Buffer.concat([...parts, centralBuf, eocd]);
}

// ---- 读取（导入 zip 用） ----
//
// 与写入端对称的最小读取器。除了我们自己写的 store，还认 deflate——
// 用户从设计稿/别处拿来的包几乎都是资源管理器压的（deflate），认不得就白做了。
// 解压借 node:zlib 的 inflateRaw，依旧零新依赖。
//
// 不支持 zip64（本工具的库规模到不了 4GB / 65535 条目，遇到了就如实报错）。
// 文件名一律按 UTF-8 解：我们写的包一定带 0x0800 标志；外来包若不是 UTF-8
// （如资源管理器用本地代码页压的中文文件名），名字可能乱码——此时由上层
// 用「资源名派生 + 查重」兜住，不去猜代码页。
export function unzipStore(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);

  // EOCD 固定 22 字节，注释最长 65535：从尾部往前扫签名
  let eocd = -1;
  const floor = Math.max(0, b.length - 22 - 0xffff);
  for (let i = b.length - 22; i >= floor; i--) {
    if (b.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw badInput('不是有效的 zip（找不到中央目录结束记录）');

  const count = b.readUInt16LE(eocd + 10);
  let p = b.readUInt32LE(eocd + 16);
  if (count === 0xffff || p === 0xffffffff) throw badInput('zip64 包不受支持（条目过多或超过 4GB）');

  const out = [];
  for (let i = 0; i < count; i++) {
    if (p + 46 > b.length || b.readUInt32LE(p) !== 0x02014b50) throw badInput('zip 中央目录损坏');
    const method = b.readUInt16LE(p + 10);
    const crc = b.readUInt32LE(p + 16);
    const compSize = b.readUInt32LE(p + 20);
    const nameLen = b.readUInt16LE(p + 28);
    const extraLen = b.readUInt16LE(p + 30);
    const commentLen = b.readUInt16LE(p + 32);
    const localOff = b.readUInt32LE(p + 42);
    const name = b.slice(p + 46, p + 46 + nameLen).toString('utf8');
    p += 46 + nameLen + extraLen + commentLen;

    // 目录条目没有数据体，跳过
    if (name.endsWith('/')) continue;

    // 数据定位必须按**本地头自己**的名字/扩展字段长度跳——个别写包器
    // 在中央目录与本地头里给的扩展字段不一致，混用会切错数据起点。
    if (localOff + 30 > b.length || b.readUInt32LE(localOff) !== 0x04034b50) {
      throw badInput(`zip 条目损坏: ${name}`);
    }
    const lNameLen = b.readUInt16LE(localOff + 26);
    const lExtraLen = b.readUInt16LE(localOff + 28);
    const start = localOff + 30 + lNameLen + lExtraLen;
    const raw = b.slice(start, start + compSize);

    let data;
    if (method === 0) data = raw; // store
    else if (method === 8) data = inflateRawSync(raw); // deflate
    else throw badInput(`不支持的压缩方法 ${method}（条目 ${name}）`);
    if (crc32(data) !== crc) throw badInput(`zip 条目校验失败（CRC 不符）: ${name}`);
    out.push({ name, data });
  }
  return out;
}
