import { jsx, jsxs } from "react/jsx-runtime";
import { Icon } from "./ui/Icon";
function ColorChip({ entry, onRemove, onToggleLock, onClick, active, isAnchor }) {
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: `sl-cs-chip ${active ? "is-active" : ""}`,
      onClick: () => onClick?.(entry.id),
      role: "button",
      tabIndex: 0,
      onKeyDown: (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(entry.id);
        }
      },
      title: `\u9009\u4E2D ${entry.hex}(\u8272\u76D8\u8DDF\u968F)`,
      children: [
        /* @__PURE__ */ jsx(
          "span",
          {
            className: "sl-cs-chip__swatch",
            style: { backgroundColor: entry.hex },
            "aria-hidden": "true",
            children: entry.derivedFrom && /* @__PURE__ */ jsx("span", { className: "sl-cs-chip__derived", "aria-hidden": "true" })
          }
        ),
        isAnchor && /* @__PURE__ */ jsx(
          "span",
          {
            className: "sl-cs-chip__anchor",
            title: "\u951A\u8272\uFF1A\u6D3E\u751F\u8272\u7684\u57FA\u51C6\u8272(\u8DDF\u968F\u5F53\u524D\u9009\u4E2D\u7684\u8272\u5361)",
            children: "\u951A"
          }
        ),
        /* @__PURE__ */ jsx("code", { className: "sl-cs-chip__hex", children: entry.hex }),
        /* @__PURE__ */ jsxs("div", { className: "sl-cs-chip__actions", onClick: (e) => e.stopPropagation(), children: [
          onToggleLock && /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: "sl-cs-chip__act",
              onClick: () => onToggleLock(entry.id),
              "aria-label": entry.locked ? "\u89E3\u9501" : "\u9501\u5B9A",
              title: entry.locked ? "\u89E3\u9501" : "\u9501\u5B9A",
              children: /* @__PURE__ */ jsx(Icon, { name: entry.locked ? "lock" : "lockOpen", size: 12 })
            }
          ),
          onRemove && /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: "sl-cs-chip__act",
              onClick: () => onRemove(entry.id),
              "aria-label": "\u5220\u9664",
              title: "\u5220\u9664",
              children: /* @__PURE__ */ jsx(Icon, { name: "close", size: 12 })
            }
          )
        ] })
      ]
    }
  );
}
export {
  ColorChip
};
