// 二进制下载端点：把「批量导出」直接变成浏览器里的一次下载。
//
// 为什么单独一条路径、不走 api.js 的 JSON 路由：那个路由的所有出口都是 sendJson
// （{ok, data} 信封），而 zip 是二进制、要带 Content-Disposition。硬塞进 JSON 层
// 只会两边都别扭——这里显式分流，规则也简单：路径以 .zip 结尾就交给这个模块。
import { exportZip } from '../core/svg/set.js';

export const ZIP_PATH = '/api/svg/export.zip';

export async function handleZipDownload(req, res, url) {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return;
  }
  try {
    const group = url.searchParams.get('group') || '';
    const style = url.searchParams.get('style') || '';
    const out = exportZip({ kind: 'svg', group, style });
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
