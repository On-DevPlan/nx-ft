// 侧边栏的两条「默认收起」设置：三域共享一份。
//
// 「文件夹默认收起」「侧边栏默认收起」是使用习惯（进入页面时的初值策略），
// 不是领域数据——html / svg / color 读写同一个 key，任一域里改，三域同时生效。
// 展开记忆与收起记忆仍按域各存（key 由调用方的 storageKey 拼），树的形状域与域
// 本来就不同；只有这两条偏好不分域。
//
// 单独成文件：sidebar/index.jsx 已贴着 300 行闸门，且这份逻辑要能在 node 里单测
// （localStorage 用 globalThis 上的，测试里自己 stub）。

// 早期的 key 按域各存一份（nx-ft-side-<kind>--default-*），迁移时按这份清单找
const LEGACY_KINDS = ['html', 'svg', 'color'];

const keyOf = (name) => `nx-ft-side--default-${name}`;

// 读一条设置。共享 key 从没写过时做一次性迁移：旧 key「任一为 1」即视为开，
// 搬进共享 key 后删掉旧键——老用户已开的开关不丢。
export function loadDefault(name) {
  try {
    let v = localStorage.getItem(keyOf(name));
    if (v == null) {
      const legacyKey = (kind) => `nx-ft-side-${kind}--default-${name}`;
      v = LEGACY_KINDS.some((k) => localStorage.getItem(legacyKey(k)) === '1') ? '1' : '0';
      localStorage.setItem(keyOf(name), v);
      LEGACY_KINDS.forEach((k) => localStorage.removeItem(legacyKey(k)));
    }
    return v === '1';
  } catch {
    return false; // 隐私模式或存取失败：按默认关
  }
}

// 写一条设置（开 / 关）
export function saveDefault(name, on) {
  try {
    localStorage.setItem(keyOf(name), on ? '1' : '0');
  } catch {
    /* 隐私模式静默 */
  }
}
