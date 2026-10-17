// 工具栏编排的排序内核：把「把某一项放到某个位置」这个意图落到 layout 数组上。
//
// 纯函数、不碰 DOM——面板负责判定鼠标落在哪一行（前还是后），这里只负责算新次序。
// layout 数组次序 = 工具栏渲染次序，`zone` 决定它落撑杆前还是后，于是
// 「段内排序」「跨区挪位」「菜单项搬上工具栏」是同一件事：把一项挪到一个位次。
// 落点统一表达成 { anchorId, after }（插到锚点之前 / 之后），anchorId 为空 = 该区末位。
import { effZoneOf, isLocked, isMenuItemId } from './toolbar-modules.js';

// 某区末位的位次：该区最后一个非锁定项之后；该区没人就是数组头。
function endOfZone(list, zone) {
  let at = 0;
  list.forEach((x, i) => {
    if (!isLocked(x.id) && effZoneOf(x) === zone) at = i + 1;
  });
  return at;
}

// 挪一项：{ id, anchorId?, after?, zone?, quick? }
//   id        被挪的项（锁定项原样返回——主按钮不动）
//   anchorId  锚点；缺省 = 目标区末位。锚点就是自己 = 落回原位，次序不变
//   after     插到锚点之后（默认之前）
//   zone      目标区（跨区拖拽时一并改写；不传则沿用原区）
//   quick     一并改写快捷显示（菜单项拖上工具栏时开、拖回菜单时关）
export function moveModule(layout, { id, anchorId = null, after = false, zone = null, quick }) {
  const at0 = layout.findIndex((x) => x.id === id);
  if (at0 < 0 || isLocked(id)) return layout;
  const item = { ...layout[at0] };
  if (zone) item.zone = zone;
  if (quick !== undefined) item.quick = quick;
  const rest = layout.filter((_, i) => i !== at0);
  let at;
  if (anchorId === id) at = at0;
  else if (anchorId) {
    const ai = rest.findIndex((x) => x.id === anchorId);
    at = ai < 0 ? endOfZone(rest, effZoneOf(item)) : ai + (after ? 1 : 0);
  } else at = endOfZone(rest, effZoneOf(item));
  // 锁定项恒在末位：任何落点都不越过它（面板与栏渲染两处都靠这条兜底）
  const floor = rest.findIndex((x) => isLocked(x.id));
  if (floor >= 0 && at > floor) at = floor;
  const next = rest.slice();
  next.splice(at, 0, item);
  return next;
}

// 开关类改写（显隐 / 快捷显示）——位置不变，只翻一个字段
export function setFlag(layout, id, patch) {
  return layout.map((x) => (x.id === id ? { ...x, ...patch } : x));
}

// 是不是「还没上工具栏的菜单项」：松手时要顺手开 quick（一步就是「拖上去」）
export const isMenuOnly = (item) => !!(item && isMenuItemId(item.id) && !item.quick);
