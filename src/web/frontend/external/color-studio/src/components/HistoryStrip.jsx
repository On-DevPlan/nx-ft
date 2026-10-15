import { jsx, jsxs } from "react/jsx-runtime";
import { useColorStudio } from "../state/useColorStudio";
import { addEntryToActivePalette } from "../utils/paletteActions";
function HistoryStrip() {
  const { doc, setDoc } = useColorStudio();
  const recent = doc.pickHistory.slice(0, 12);
  const reAdd = (hex) => {
    setDoc((d) => addEntryToActivePalette(d, hex, "shortcut"));
  };
  return /* @__PURE__ */ jsxs("div", { className: "sl-cs-history", children: [
    /* @__PURE__ */ jsx("h4", { children: "\u6700\u8FD1" }),
    /* @__PURE__ */ jsxs("div", { className: "sl-cs-history__strip", children: [
      recent.length === 0 && /* @__PURE__ */ jsx("span", { className: "sl-cs-history__empty", children: "(\u7A7A)" }),
      recent.map((h, i) => /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "sl-cs-history__chip",
          style: { backgroundColor: h.hex },
          onClick: () => reAdd(h.hex),
          "aria-label": `\u5386\u53F2\u8272 ${h.hex}`,
          title: `${h.hex} (${h.source})`
        },
        `${h.pickedAt}-${i}`
      ))
    ] })
  ] });
}
export {
  HistoryStrip
};
