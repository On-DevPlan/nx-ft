// src/core/color/id.js
//
// 简单的 id 生成器。色卡 id 在 nx-ft 范围内只需保证 (groupPath, name) 作用域内唯一。
// 用时间戳 + 4 位随机足以避免同一毫秒内冲突；不需要全局唯一。

export function makeId(seed) {
  const t = (typeof seed === 'number' ? seed : Date.now()).toString(36);
  const r = Math.floor(Math.random() * 0xffff).toString(36).padStart(3, '0');
  return `c-${t}-${r}`;
}
