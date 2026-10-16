// 二进制下载端点：把「批量导出」直接变成浏览器里的一次下载。
//
// 为什么单独一条路径、不走 api.js 的 JSON 路由：那个路由的所有出口都是 sendJson
// （{ok, data} 信封），而 zip 是二进制、要带 Content-Disposition。硬塞进 JSON 层
// 只会两边都别扭——这里显式分流，规则也简单：/api/<kind>/export.zip 交给这个模块。
import { exportZip as exportSvgZip } from '../core/svg/set.js';
import { exportZip as exportAssetZip } from '../core/assets/set.js';

// 路径按 kind 走：/api/svg/export.zip、/api/html/export.zip
export const EXPORT_ZIP_RE = /^\/api\/([a-z]+)\/export\.zip$/;

// 与上传端同一张分派表：svg 平铺单文件 / html 一资源一目录三件套。
// 两者返回同构（filename / buffer / count / skipped），这里无需区分。
const EXPORTERS = { svg: exportSvgZip, html: exportAssetZip };

export async function handleZipDownload(req, res, url, kind) {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return;
  }
  const exportZip = EXPORTERS[kind];
  if (!exportZip) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`未知资源类型: ${kind}`);
    return;
  }
  try {
    const group = url.searchParams.get('group') || '';
    const style = url.searchParams.get('style') || '';
    // pick 模式：选区导出（目录递归 + 任意深度子文件），URL 编码的 JSON
    const pickRaw = url.searchParams.get('pick');
    let pick;
    if (pickRaw) {
      try { pick = JSON.parse(decodeURIComponent(pickRaw)); }
      catch { res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' }); res.end('pick 参数 JSON 解析失败'); return; }
      if (!Array.isArray(pick)) {
        res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' }); res.end('pick 必须是数组'); return;
      }
    }
    const out = exportZip({ kind, group, style, pick });
    // 文件名里的中文要按 RFC 5987 编码，否则部分浏览器会得到乱码文件名
    const ascii = out.filename.replace(/[^\x20-\x7e]/g, '_');
    res.writeHead(200, {
      'content-type': 'application/zip',
      'content-length': out.buffer.length,
      'content-disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(out.filename)}`,
      'cache-control': 'no-store',
      'x-export-count': String(out.count),
    });
    res.end(out.buffer);
  } catch (err) {
    // 失败时回人类可读的纯文本（下载场景没有 JSON 解析方）
    const code = err && err.code === 'NOT_FOUND' ? 404 : err && err.code === 'BAD_INPUT' ? 400 : 500;
    res.writeHead(code, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(String((err && err.message) || err));
  }
}
