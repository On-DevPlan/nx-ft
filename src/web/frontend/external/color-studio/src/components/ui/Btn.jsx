import { jsx, jsxs } from "react/jsx-runtime";
import { Icon } from "./Icon";
function Btn({
  variant = "secondary",
  size = "md",
  icon,
  iconOnly = false,
  children,
  className,
  type = "button",
  ...rest
}) {
  const cls = [
    "sl-cs-btn",
    `sl-cs-btn--${variant}`,
    `sl-cs-btn--${size}`,
    iconOnly ? "sl-cs-btn--icon-only" : "",
    className ?? ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ jsxs("button", { type, className: cls, ...rest, children: [
    icon && /* @__PURE__ */ jsx(Icon, { name: icon, size: size === "sm" ? 13 : 15 }),
    !iconOnly && children
  ] });
}
export {
  Btn
};
