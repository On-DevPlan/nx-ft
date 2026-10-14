import { jsx } from "react/jsx-runtime";
const PATHS = {
  // 吸管:斜杆 + 上部滴管囊
  eyedropper: "M11 7 7 11 3.5 14.5a2.1 2.1 0 0 0 3 3L10 14l4-4M13 5l6 6M17 3l4 4-3 3-4-4 3-3Z",
  // 锁体 + 弧形锁梁(闭合)
  lock: "M6 11h12v9a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-9ZM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11",
  // 锁体 + 开口锁梁(右侧翘起)
  lockOpen: "M6 11h12v9a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-9ZM8.5 11V7.5a3.5 3.5 0 0 1 6.8-1.2",
  // 垃圾桶
  trash: "M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6.5 7l1 13h9l1-13M10 11v5M14 11v5",
  plus: "M12 5v14M5 12h14",
  copy: "M9 9h10v10a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1V9ZM5 15V5a1 1 0 0 1 1-1h10",
  download: "M12 4v10m0 0-4-4m4 4 4-4M4 19h16",
  upload: "M12 14V4m0 0-4 4m4-4 4 4M4 19h16",
  undo: "M8 5 4 9l4 4M4 9h10a6 6 0 0 1 0 12h-3",
  redo: "M16 5l4 4-4 4M20 9H10a6 6 0 0 0 0 12h3",
  // 画笔:笔杆 + 笔头三角
  brush: "M18.5 3.5 20.5 5.5 11 15l-2-2 9.5-9.5ZM9 13l2 2-1.5 4.5L4 21l1.5-5.5L9 13Z",
  filter: "M4 5h16l-6 7v6l-4 2v-8L4 5Z",
  // 两层叠矩形(分组)
  group: "M8 3h11a1 1 0 0 1 1 1v11M5 7h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z",
  // 简化为四色方格
  palette: "M4 4h7v7H4V4ZM13 4h7v7h-7V4ZM4 13h7v7H4v-7ZM13 13h7v7h-7v-7Z",
  chevronUp: "M6 14l6-6 6 6",
  chevronDown: "M6 10l6 6 6-6",
  close: "M6 6l12 12M18 6 6 18",
  // 键盘:外框 + 两排键点
  keyboard: "M3 7h18v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7ZM7 11h.01M11 11h.01M15 11h.01M8 14h8",
  // 双向循环箭头
  sync: "M4 12a8 8 0 0 1 13.6-5.7L20 8M20 4v4h-4M20 12a8 8 0 0 1-13.6 5.7L4 16M4 20v-4h4",
  // 向左箭头(返回)
  "arrow-left": "M19 12H5M12 5l-7 7 7 7",
  // 向右箭头
  "arrow-right": "M5 12h14M12 5l7 7-7 7",
  // 书:左页 + 右页
  book: "M4 5a2 1 0 0 1 2-1h5v15H6a2 1 0 0 1-2-1V5ZM14 4h5a2 1 0 0 1 2 1v13a2 1 0 0 1-2 1h-5V4Z"
};
function Icon({ name, size = 16, className, ...rest }) {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.8,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      className: className ? `sl-cs-icon ${className}` : "sl-cs-icon",
      "aria-hidden": rest["aria-hidden"] ?? true,
      focusable: "false",
      children: /* @__PURE__ */ jsx("path", { d: PATHS[name] })
    }
  );
}
export {
  Icon
};
