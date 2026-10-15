// API 客户端：全部面板操作走 /api，与 CLI 共享同一份 action 声明。
//
// 响应包约定 { ok: true, data } / { ok: false, error, code }。
// 失败时抛 Error 并带上 .code —— 调用方可据此区分「业务冲突」与「参数错误」，
// 而不是像改造前那样只能对错误文案做字符串匹配。
const DEFAULT_TIMEOUT_MS = 30000;

// 响应信封的统一解析：api / apiUpload 共用，失败都抛带 .code 的 Error。
async function parseEnvelope(res) {
  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error(`HTTP ${res.status}`);
  }
  if (!json.ok) {
    const err = new Error(json.error || '请求失败');
    err.code = json.code;
    err.details = json.details;
    throw err;
  }
  return json.data;
}

export async function api(path, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs || DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(path, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'content-type': 'application/json' } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: ctrl.signal,
    });
    return await parseEnvelope(res);
  } catch (e) {
    // AbortError 的原生文案是「The operation was aborted」，对用户没有意义
    if (e && e.name === 'AbortError') throw new Error('请求超时（本地服务无响应）');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// 二进制上传：zip 等原样 POST（不走 JSON 序列化），响应仍是同一份 {ok,data} 信封。
// query 里的业务参数（分组 / 风格）走 URL，body 交给文件本身。
export async function apiUpload(path, blob, opts = {}) {
  const qs = opts.query ? '?' + new URLSearchParams(opts.query).toString() : '';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs || DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(path + qs, {
      method: 'POST',
      headers: { 'content-type': 'application/zip' },
      body: blob,
      signal: ctrl.signal,
    });
    return await parseEnvelope(res);
  } catch (e) {
    if (e && e.name === 'AbortError') throw new Error('上传超时（本地服务无响应）');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
