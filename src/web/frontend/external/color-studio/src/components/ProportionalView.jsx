import { jsx, jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { useColorStudio } from "../state/useColorStudio";
import { normalizeWeights, donutSlicePath } from "../engine/proportional";
import { Icon } from "./ui/Icon";
const DONUT_SIZE = 220;
const DONUT_RO = 100;
const DONUT_RI = 55;
function ProportionalView() {
  const { doc, setDoc } = useColorStudio();
  const [mode, setMode] = useState("bar");
  const palette = doc.palettes.find((p) => p.id === doc.activePaletteId);
  const entries = useMemo(() => {
    if (!palette) return [];
    return palette.colorIds.map((cid) => doc.colorEntries.find((c) => c.id === cid)).filter((c) => !!c);
  }, [palette, doc.colorEntries]);
  const slices = useMemo(() => normalizeWeights(entries), [entries]);
  const setWeight = (entryId, weight) => {
    setDoc((d) => ({
      ...d,
      colorEntries: d.colorEntries.map(
        (c) => c.id === entryId ? { ...c, weight: Math.max(0, Math.min(100, weight)), updatedAt: Date.now() } : c
      ),
      meta: { ...d.meta, updatedAt: Date.now() }
    }));
  };
  const startBarDrag = (index, e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const container = e.currentTarget.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const move = (ev) => {
      const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      const leftW = ratio * 100;
      const rightW = 100 - leftW;
      const left = slices[index - 1];
      const right = slices[index];
      if (!left || !right) return;
      const rightTotal = slices.slice(index).reduce((s, sl) => s + sl.entry.weight, 0);
      const newLeft = rightTotal > 0 ? leftW / rightW * rightTotal : leftW;
      setWeight(left.entry.id, Math.round(newLeft * 100) / 100);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  if (entries.length === 0) {
    return /* @__PURE__ */ jsx("div", { className: "sl-cs-prop sl-cs-prop--empty", children: "\u5F53\u524D\u8C03\u8272\u677F\u6CA1\u6709\u989C\u8272" });
  }
  return /* @__PURE__ */ jsxs("div", { className: "sl-cs-prop", children: [
    /* @__PURE__ */ jsx("div", { className: "sl-cs-prop__toolbar", children: ["bar", "donut", "area"].map((m) => /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        className: `sl-cs-btn sl-cs-btn--sm sl-cs-btn--ghost ${mode === m ? "is-active" : ""}`,
        onClick: () => setMode(m),
        children: m === "bar" ? "\u6761\u5F62" : m === "donut" ? "\u73AF\u5F62" : "\u9762\u79EF"
      },
      m
    )) }),
    mode === "bar" && /* @__PURE__ */ jsx("div", { className: "sl-cs-prop__bar", children: /* @__PURE__ */ jsx("div", { className: "sl-cs-prop__bartrack", children: slices.map((s, i) => /* @__PURE__ */ jsxs(
      "div",
      {
        className: "sl-cs-prop__barwrap",
        style: { flexGrow: Math.max(1e-4, s.entry.weight) },
        children: [
          i > 0 && /* @__PURE__ */ jsx(
            "div",
            {
              className: "sl-cs-prop__divider",
              onPointerDown: (e) => startBarDrag(i, e),
              role: "separator",
              "aria-label": `\u8C03\u6574 ${s.entry.hex} \u5360\u6BD4`
            }
          ),
          /* @__PURE__ */ jsx(
            "div",
            {
              className: "sl-cs-prop__barseg",
              style: { backgroundColor: s.entry.hex },
              title: `${s.entry.hex} ${s.pct}%`,
              children: s.pct >= 12 && /* @__PURE__ */ jsxs("span", { children: [
                s.pct,
                "%"
              ] })
            }
          )
        ]
      },
      s.entry.id
    )) }) }),
    mode === "donut" && /* @__PURE__ */ jsx(
      "svg",
      {
        className: "sl-cs-prop__donut",
        width: DONUT_SIZE,
        height: DONUT_SIZE,
        viewBox: `0 0 ${DONUT_SIZE} ${DONUT_SIZE}`,
        children: (() => {
          let acc = 0;
          return slices.map((s) => {
            const start = acc;
            acc += s.pct;
            return /* @__PURE__ */ jsx(
              "path",
              {
                d: donutSlicePath(DONUT_SIZE / 2, DONUT_SIZE / 2, DONUT_RO, DONUT_RI, start, acc),
                fill: s.entry.hex,
                stroke: "var(--sl-color-surface, #fff)",
                strokeWidth: 1,
                children: /* @__PURE__ */ jsx("title", { children: `${s.entry.hex} ${s.pct}%` })
              },
              s.entry.id
            );
          });
        })()
      }
    ),
    mode === "area" && /* @__PURE__ */ jsx("div", { className: "sl-cs-prop__area", children: slices.map((s) => /* @__PURE__ */ jsxs(
      "div",
      {
        className: "sl-cs-prop__areablock",
        style: {
          backgroundColor: s.entry.hex,
          flexGrow: Math.max(1e-4, s.entry.weight * s.entry.weight)
        },
        title: `${s.entry.hex} ${s.pct}%`,
        children: [
          /* @__PURE__ */ jsx("span", { children: s.entry.hex }),
          /* @__PURE__ */ jsxs("span", { children: [
            s.pct,
            "%"
          ] })
        ]
      },
      s.entry.id
    )) }),
    /* @__PURE__ */ jsx("ul", { className: "sl-cs-prop__list", children: slices.map((s) => /* @__PURE__ */ jsxs("li", { className: "sl-cs-prop__row", children: [
      /* @__PURE__ */ jsx("span", { className: "sl-cs-prop__dot", style: { backgroundColor: s.entry.hex } }),
      /* @__PURE__ */ jsx("code", { children: s.entry.hex }),
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "range",
          className: "sl-cs-prop__slider",
          min: 0,
          max: 20,
          step: 0.5,
          value: s.entry.weight,
          onChange: (e) => setWeight(s.entry.id, Number(e.target.value)),
          "aria-label": `${s.entry.hex} \u6743\u91CD`
        }
      ),
      /* @__PURE__ */ jsx("code", { className: "sl-cs-prop__wval", children: s.entry.weight }),
      /* @__PURE__ */ jsxs("span", { className: "sl-cs-prop__pct", children: [
        s.pct,
        "%"
      ] })
    ] }, s.entry.id)) }),
    /* @__PURE__ */ jsxs("p", { className: "sl-cs-prop__hint", children: [
      /* @__PURE__ */ jsx(Icon, { name: "palette", size: 11 }),
      " \u62D6\u6BCF\u884C\u6ED1\u6746\u8C03\u6743\u91CD;\u6761\u5F62\u89C6\u56FE\u91CC\u4E5F\u53EF\u4EE5\u76F4\u63A5\u62D6\u767D\u8272\u5206\u5272\u7EBF"
    ] })
  ] });
}
export {
  ProportionalView
};
