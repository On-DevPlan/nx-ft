import { jsx, jsxs } from "react/jsx-runtime";
import { useMemo } from "react";
import { useColorStudio } from "../state/useColorStudio";
import { filterStackToCss } from "../engine/filterCss";
import { applyFilterStackToHex } from "../engine/filterColor";
import { addEntryToActivePalette } from "../utils/paletteActions";
import { makeId } from "../utils/id";
import { Btn } from "./ui/Btn";
import { Icon } from "./ui/Icon";
const FILTER_META = [
  { type: "brightness", label: "\u4EAE\u5EA6", min: 0, max: 300, step: 5, def: 120 },
  { type: "contrast", label: "\u5BF9\u6BD4\u5EA6", min: 0, max: 300, step: 5, def: 120 },
  { type: "saturate", label: "\u9971\u548C\u5EA6", min: 0, max: 300, step: 5, def: 150 },
  { type: "hueRotate", label: "\u8272\u76F8\u65CB\u8F6C", min: 0, max: 360, step: 5, def: 30 },
  { type: "grayscale", label: "\u7070\u5EA6", min: 0, max: 100, step: 5, def: 50 },
  { type: "sepia", label: "\u68D5\u8910", min: 0, max: 100, step: 5, def: 40 },
  { type: "invert", label: "\u53CD\u76F8", min: 0, max: 100, step: 5, def: 100 }
];
function FilterPanel() {
  const { doc, setDoc } = useColorStudio();
  const stack = doc.filterStack;
  const css = filterStackToCss(stack);
  const hasActive = stack.some((f) => f.enabled);
  const palette = doc.palettes.find((p) => p.id === doc.activePaletteId);
  const entries = useMemo(() => {
    if (!palette) return [];
    return palette.colorIds.map((cid) => doc.colorEntries.find((c) => c.id === cid)).filter((c) => !!c);
  }, [palette, doc.colorEntries]);
  const baked = useMemo(
    () => entries.map((e) => ({ entry: e, hex: applyFilterStackToHex(e.hex, stack) })),
    [entries, stack]
  );
  const addFilter = (type) => {
    const meta = FILTER_META.find((m) => m.type === type);
    if (!meta) return;
    setDoc((d) => ({
      ...d,
      filterStack: [...d.filterStack, { id: makeId(), type, value: meta.def, enabled: true }],
      meta: { ...d.meta, updatedAt: Date.now() }
    }));
  };
  const updateFilter = (id, patch) => {
    setDoc((d) => ({
      ...d,
      filterStack: d.filterStack.map((f) => f.id === id ? { ...f, ...patch } : f),
      meta: { ...d.meta, updatedAt: Date.now() }
    }));
  };
  const removeFilter = (id) => {
    setDoc((d) => ({
      ...d,
      filterStack: d.filterStack.filter((f) => f.id !== id),
      meta: { ...d.meta, updatedAt: Date.now() }
    }));
  };
  const bakeOne = (hex) => {
    setDoc((d) => addEntryToActivePalette(d, hex, "filter"));
  };
  const bakeAll = () => {
    const changed = baked.filter((b) => b.hex !== b.entry.hex);
    if (changed.length === 0) return;
    setDoc((d) => {
      let next = d;
      for (const b of changed) {
        next = addEntryToActivePalette(next, b.hex, "filter");
      }
      return next;
    });
  };
  return /* @__PURE__ */ jsxs("div", { className: "sl-cs-filters", children: [
    /* @__PURE__ */ jsx("div", { className: "sl-cs-filters__head", children: /* @__PURE__ */ jsxs("h4", { children: [
      /* @__PURE__ */ jsx(Icon, { name: "filter", size: 13 }),
      " \u6EE4\u955C(\u975E\u7834\u574F\u6027)"
    ] }) }),
    /* @__PURE__ */ jsx("div", { className: "sl-cs-filters__preview", style: { filter: css }, children: (() => {
      const p = doc.palettes.find((x) => x.id === doc.activePaletteId);
      const colors = (p?.colorIds ?? []).map((cid) => doc.colorEntries.find((c) => c.id === cid)?.hex ?? "#000000").slice(0, 8);
      return colors.map((hex, i) => /* @__PURE__ */ jsx("span", { style: { backgroundColor: hex } }, `${hex}-${i}`));
    })() }),
    /* @__PURE__ */ jsx("ul", { className: "sl-cs-filters__list", children: stack.map((f) => {
      const meta = FILTER_META.find((m) => m.type === f.type);
      if (!meta) return null;
      return /* @__PURE__ */ jsxs("li", { className: `sl-cs-filters__row ${f.enabled ? "" : "is-disabled"}`, children: [
        /* @__PURE__ */ jsx("label", { className: "sl-cs-filters__toggle", children: /* @__PURE__ */ jsx(
          "input",
          {
            type: "checkbox",
            checked: f.enabled,
            onChange: (e) => updateFilter(f.id, { enabled: e.target.checked }),
            "aria-label": `\u542F\u7528 ${meta.label}`
          }
        ) }),
        /* @__PURE__ */ jsx("span", { className: "sl-cs-filters__label", children: meta.label }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "range",
            min: meta.min,
            max: meta.max,
            step: meta.step,
            value: f.value,
            onChange: (e) => updateFilter(f.id, { value: Number(e.target.value) }),
            "aria-label": `${meta.label} \u6570\u503C`
          }
        ),
        /* @__PURE__ */ jsx("span", { className: "sl-cs-filters__value", children: f.value }),
        /* @__PURE__ */ jsx(Btn, { variant: "ghost", size: "sm", iconOnly: true, icon: "close", onClick: () => removeFilter(f.id), "aria-label": `\u5220\u9664 ${meta.label}` })
      ] }, f.id);
    }) }),
    /* @__PURE__ */ jsx("div", { className: "sl-cs-filters__add", children: FILTER_META.filter((m) => !stack.some((f) => f.type === m.type)).map((m) => /* @__PURE__ */ jsx(Btn, { variant: "secondary", size: "sm", icon: "plus", onClick: () => addFilter(m.type), children: m.label }, m.type)) }),
    /* @__PURE__ */ jsxs("div", { className: "sl-cs-filters__group", children: [
      /* @__PURE__ */ jsxs("div", { className: "sl-cs-filters__grouphead", children: [
        /* @__PURE__ */ jsx(Icon, { name: "palette", size: 12 }),
        /* @__PURE__ */ jsx("span", { children: palette?.name ?? "\u5F53\u524D\u5206\u7EC4" }),
        /* @__PURE__ */ jsxs("span", { className: "sl-cs-filters__groupcount", children: [
          baked.length,
          " \u8272"
        ] }),
        /* @__PURE__ */ jsx(
          Btn,
          {
            variant: "primary",
            size: "sm",
            icon: "plus",
            disabled: !hasActive || baked.every((b) => b.hex === b.entry.hex),
            onClick: bakeAll,
            title: "\u628A\u6574\u7EC4\u70D8\u7119\u7ED3\u679C\u6279\u91CF\u6DFB\u52A0\u4E3A\u65B0\u989C\u8272(\u4E0E\u539F\u8272\u76F8\u540C\u7684\u8DF3\u8FC7)",
            children: "\u5168\u90E8\u6DFB\u52A0"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("ul", { className: "sl-cs-filters__grouplist", children: [
        baked.length === 0 && /* @__PURE__ */ jsx("li", { className: "sl-cs-filters__groupempty", children: "\u5F53\u524D\u8C03\u8272\u677F\u6CA1\u6709\u989C\u8272" }),
        baked.map(({ entry, hex }) => {
          const changed = hex !== entry.hex;
          return /* @__PURE__ */ jsxs("li", { className: "sl-cs-filters__grouprow", children: [
            /* @__PURE__ */ jsx(
              "span",
              {
                className: "sl-cs-filters__bakechip",
                style: { backgroundColor: hex },
                title: `\u6EE4\u955C\u540E:${hex}`
              }
            ),
            /* @__PURE__ */ jsxs("span", { className: "sl-cs-filters__arrow", title: "\u6EE4\u955C\u524D \u2192 \u6EE4\u955C\u540E", children: [
              /* @__PURE__ */ jsx("code", { className: "sl-cs-filters__from", children: entry.hex }),
              /* @__PURE__ */ jsx(Icon, { name: "redo", size: 10 }),
              /* @__PURE__ */ jsx("code", { className: `sl-cs-filters__to ${changed ? "is-changed" : ""}`, children: hex })
            ] }),
            /* @__PURE__ */ jsx(
              Btn,
              {
                variant: "secondary",
                size: "sm",
                iconOnly: true,
                icon: "plus",
                disabled: !hasActive,
                onClick: () => bakeOne(hex),
                "aria-label": `\u6DFB\u52A0 ${hex} \u4E3A\u65B0\u989C\u8272`,
                title: "\u6DFB\u52A0\u4E3A\u65B0\u989C\u8272"
              }
            )
          ] }, entry.id);
        })
      ] })
    ] }),
    stack.length > 0 && /* @__PURE__ */ jsx("p", { className: "sl-cs-filters__css", title: css, children: /* @__PURE__ */ jsxs("code", { children: [
      "filter: ",
      css
    ] }) })
  ] });
}
export {
  FilterPanel
};
