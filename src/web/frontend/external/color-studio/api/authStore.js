// nx-ft 没有 JWT 概念(后端零鉴权,数据 100% 本地落盘),原来的「未登录」
// 徽标是 ve 那套 KV 鉴权的残留,会误导用户以为有账号系统。
// 改成本地化占位:header 显示「本地 · CLI 与 Web 同源」。
export const LOCAL_AUTH = { jwtAuthState: "local" };

export function getJwtAuthSnapshot() {
  return LOCAL_AUTH;
}
export function subscribeJwtAuth(_cb) {
  return () => {};
}
