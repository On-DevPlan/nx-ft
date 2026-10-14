import { jsx, jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useColorStudio } from "../state/useColorStudio";
import { useShortcutPrefs } from "../hooks/useShortcutPrefs";
import { parseUserInput } from "../engine/colorMath";
import { makeId } from "../utils/id";
import { Btn } from "./ui/Btn";
function QuickAddBar() {
  const { setDoc } = useColorStudio();
  const { prefs } = useShortcutPrefs();
  const [text, setText] = useState("");
  const [error, setError] = useState(null);
  const submit = () => {
    if (!text.trim()) return;
    const tokens = text.split(/[\s,;]+/).filter(Boolean);
    const hexes = tokens.map(parseUserInput).filter((h) => !!h);
    if (hexes.length === 0) {
      setError(`\u65E0\u6CD5\u8BC6\u522B: "${text}"`);
      return;
    }
    const ts = Date.now();
    setDoc((d) => {
      const newEntries = hexes.map((hex, i) => ({
        id: makeId(ts + i),
        hex,
        weight: 1,
        locked: false,
        note: "",
        tags: [],
        createdAt: ts,
        updatedAt: ts
      }));
      return {
        ...d,
        colorEntries: [...d.colorEntries, ...newEntries],
        palettes: d.palettes.map((p) => p.id === d.activePaletteId ? { ...p, colorIds: [...p.colorIds, ...newEntries.map((e) => e.id)], updatedAt: ts } : p),
        pickHistory: [
          ...hexes.map((hex) => ({ hex, source: "paste", pickedAt: ts })),
          ...d.pickHistory
        ].slice(0, 12),
        meta: { ...d.meta, updatedAt: ts }
      };
    });
    setText("");
    setError(null);
  };
  return /* @__PURE__ */ jsxs("div", { className: "sl-cs-quickadd", children: [
    /* @__PURE__ */ jsx(
      "input",
      {
        className: "sl-cs-input sl-cs-quickadd__input",
        placeholder: "\u7C98\u8D34 #FF5733 / rgb(255,...) / red(\u7A7A\u683C\u5206\u9694\u591A\u8272)",
        value: text,
        onChange: (e) => setText(e.target.value),
        onKeyDown: (e) => {
          if (e.key === "Enter") submit();
        },
        "aria-label": "\u5FEB\u901F\u6DFB\u52A0\u989C\u8272"
      }
    ),
    /* @__PURE__ */ jsx(Btn, { variant: "primary", icon: "plus", onClick: submit, children: "\u6DFB\u52A0" }),
    error && /* @__PURE__ */ jsx("span", { className: "sl-cs-quickadd__err", children: error }),
    /* @__PURE__ */ jsxs("span", { className: "sl-cs-quickadd__hint", children: [/* @__PURE__ */ jsx("kbd", { children: prefs.shortcuts.addColor.toUpperCase() }), " 添加 \u00B7 ", /* @__PURE__ */ jsx("kbd", { children: prefs.shortcuts.copy.toUpperCase() }), " 复制 \u00B7 ", /* @__PURE__ */ jsx("kbd", { children: prefs.shortcuts.eyedropper.toUpperCase() }), " 取色 \u00B7 ", /* @__PURE__ */ jsx("kbd", { children: prefs.shortcuts.clearHistory.toUpperCase() }), " 清历史"] })
  ] });
}
export {
  QuickAddBar
};
