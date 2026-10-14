import { jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./ui/Icon";
import { Btn } from "./ui/Btn";
import { shortcutActionLabel } from "../hooks/useShortcutPrefs";
import { DEFAULT_SHORTCUTS } from "../../api/createShortcutPrefsStore";
const ACTIONS = ["eyedropper", "addColor", "copy", "clearHistory"];
function ShortcutEditor({ prefs, ready, setKey, resetAll }) {
  const [capturing, setCapturing] = useState(null);
  const [conflictMsg, setConflictMsg] = useState(null);
  const captureRef = useRef(null);
  useEffect(() => {
    if (!capturing) return;
    function onKey(e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setCapturing(null);
        return;
      }
      if (/^[a-zA-Z]$/.test(e.key)) {
        const err = setKey(capturing, e.key);
        if (err) setConflictMsg(`"${e.key.toLowerCase()}" \u5DF2\u88AB\u300C${err}\u300D\u5360\u7528`);
        else setConflictMsg(null);
      }
      setCapturing(null);
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [capturing, setKey]);
  return /* @__PURE__ */ jsxs("div", { className: "sl-cs-kbds", ref: captureRef, children: [
    /* @__PURE__ */ jsxs("div", { className: "sl-cs-kbds__head", children: [
      /* @__PURE__ */ jsxs("h4", { children: [
        /* @__PURE__ */ jsx(Icon, { name: "keyboard", size: 14 }),
        " \u5FEB\u6377\u952E"
      ] }),
      /* @__PURE__ */ jsx(Btn, { variant: "ghost", size: "sm", icon: "sync", onClick: resetAll, title: "\u6062\u590D\u9ED8\u8BA4\u952E\u4F4D", children: "\u91CD\u7F6E" })
    ] }),
    /* @__PURE__ */ jsx("ul", { children: ACTIONS.map((action) => {
      const key = prefs.shortcuts[action];
      const isDefault = key === DEFAULT_SHORTCUTS[action];
      return /* @__PURE__ */ jsxs("li", { children: [
        /* @__PURE__ */ jsx("span", { className: "sl-cs-kbds__label", children: shortcutActionLabel(action) }),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            className: `sl-cs-kbds__keybtn ${capturing === action ? "is-capturing" : ""}`,
            onClick: () => {
              setCapturing(action);
              setConflictMsg(null);
            },
            "aria-label": `\u4FEE\u6539 ${shortcutActionLabel(action)} \u952E\u4F4D`,
            title: "\u70B9\u51FB\u540E\u6309\u65B0\u952E",
            children: capturing === action ? "\u6309\u65B0\u952E\u2026" : key.toUpperCase()
          }
        ),
        !isDefault && /* @__PURE__ */ jsx("span", { className: "sl-cs-kbds__custom", title: "\u81EA\u5B9A\u4E49", children: "\xB7" })
      ] }, action);
    }) }),
    !ready && /* @__PURE__ */ jsx("p", { className: "sl-cs-kbds__loading", children: "\u952E\u4F4D\u52A0\u8F7D\u4E2D\u2026" }),
    conflictMsg && /* @__PURE__ */ jsx("p", { className: "sl-cs-kbds__conflict", children: conflictMsg })
  ] });
}
export {
  ShortcutEditor
};
