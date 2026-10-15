// zip 上传端点：面板「导入 zip」把选中的包原样 POST 进来，解包落库后回 JSON 信封。
//
// 为什么单独一条路径、不走 api.js 的 JSON 路由：与 zip-download.js 同一个理由——
// 那套路由的入口只吃 JSON 体（readBody 会 JSON.parse），zip 是二进制，硬塞进去
// 只会两边都别扭。规则同样简单：这条固定路径交给本模块。
//
// 同源约束不变：落库逻辑是 svg import 的同一份核心（set.importZipBuffer），
// CLI `svg import --from x.zip` 与这里的行为差异为零——「面板有按钮、CLI 没命令」
// 依然在结构上不可能发生。
import { importZipBuffer as importSvgZip } from '../core/svg/set.js';
import { importZipBuffer as importAssetZip } from '../core/assets/set.js';
import { sendJson, originAllowed } from './api.js';
import { toErrorPayload, httpStatusOf, badInput } from '../core/errors/index.js';

// 路径按 kind 走：/api/svg/import.zip、/api/html/import.zip。
export const IMPORT_ZIP_RE = /^\/api\/([a-z]+)\/import\.zip$/;

// 两种约定并列（都与 CLI 的 <kind> import 同一份核心函数）：
//   svg  —— 一资源一文件平铺（core/svg/set.js）
//   html —— 一资源一目录三件套（core/assets/set.js）
// 返回结构一致，上层无需区分；未知 kind 直接 404（不猜）。
const IMPORTERS = { svg: importSvgZip, html: importAssetZip };

// 图标包都是几 KB 级的文本文件集合；给到 32MB 已经远超合理规模，
// 真到这个量级该走 CLI 而不是浏览器上传。
const MAX_ZIP_BYTES = 32 * 1024 * 1024;

async function readRawBody(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_ZIP_BYTES) throw badInput(`zip 超过 ${Math.floor(MAX_ZIP_BYTES / 1024 / 1024)}MB 上限`);
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

export async function handleZipUpload(req, res, url, kind) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return;
  }
  // 与 JSON 路由同一道跨站校验（api.js 里的那道只覆盖路由表内的路径）
  if (!originAllowed(req)) {
    sendJson(res, 403, { ok: false, error: '跨站请求被拒绝（面板仅接受本机来源）', code: 'BLOCKED' });
    return;
  }
  const importZipBuffer = IMPORTERS[kind];
  if (!importZipBuffer) {
    sendJson(res, 404, { ok: false, error: `未知资源类型: ${kind}`, code: 'NOT_FOUND' });
    return;
  }
  try {
    const q = url.searchParams;
    const data = importZipBuffer({
      kind,
      group: q.get('group') || '',
      zip: await readRawBody(req),
      style: q.get('style') || 'default',
      tags: (q.get('tags') || '').split(',').filter(Boolean),
      labelFrom: q.get('label-from') || 'title',
      from: '(上传的 zip)',
    });
    sendJson(res, 200, { ok: true, data });
  } catch (err) {
    const p = toErrorPayload(err);
    sendJson(res, httpStatusOf(p.code), { ok: false, error: p.message, code: p.code });
  }
}
