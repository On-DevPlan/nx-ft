// 按钮行的规矩判据：同一行动作里，主按钮**有且只有一个**，且排在最后一位。
//
// 判据单独放一个纯文件（不 import React）有两个理由：
//   1. 规矩要能被单测直接断言（tests/unit/btn-rules.test.mjs 手搭 { props: … }
//      即可，不必为了测一行规则去起一个渲染器）；
//   2. 这条规矩本身是**页面级**的设计约束（主按钮 = 全页唯一的实心色块），组件
//      只能在自己这一行里兜底。判据与渲染分开，将来要做页面级检查可直接复用。
//
// React 元素就是普通对象（key / ref 在 19 里是独立字段，不在 props 上），
// 所以这里不引 React 也能认出来。

export function isPrimary(node) {
  return !!(node && typeof node === 'object' && node.props && node.props.variant === 'primary');
}

// nodes 传 Children.toArray(children) 的结果（已展平数组与 Fragment、已滤掉
// null / 布尔）。返回人类可读的问题清单；空数组 = 这一行合规。
//
// 只报「多个」与「不在最后」两种：**没有**主按钮不算问题——一个只读的工具区
// （比如批量结果页）本来就没有主操作，硬凑一个反而是错的。
export function primaryIssues(nodes) {
  const list = Array.isArray(nodes) ? nodes : [];
  const at = [];
  list.forEach((node, i) => {
    if (isPrimary(node)) at.push(i);
  });

  const issues = [];
  if (at.length > 1) {
    issues.push(
      `这一行有 ${at.length} 个主按钮（第 ${at.map((i) => i + 1).join('、')} 位），一个页面只允许一个`
    );
  }
  if (at.length > 0 && at[at.length - 1] !== list.length - 1) {
    issues.push('主按钮没排在最后：工具区顺序是「次级按钮 → 次级下拉 → 主按钮」');
  }
  return issues;
}
