import { jsx, jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { useColorStudio } from "../state/useColorStudio";
import { ColorChip } from "./ColorChip";
import { Icon } from "./ui/Icon";
import { Btn } from "./ui/Btn";
import { makeId } from "../utils/id";
import { resolveNewColorHex } from "../engine/colorMath";
import { addColorEntryAndSelect } from "../engine/wheelCommit";
import { useSelectedColor } from "../hooks/useSelectedColor";
function nowTs() {
  return Date.now();
}
function PaletteSidebar() {
  const { doc, setDoc } = useColorStudio();
  const { effectiveId, select } = useSelectedColor();
  const [newPaletteName, setNewPaletteName] = useState("");
  const [createMode, setCreateMode] = useState(null);
  const [newColorHex, setNewColorHex] = useState("");
  const activePalette = doc.palettes.find((p) => p.id === doc.activePaletteId);
  const activeEntries = useMemo(() => {
    if (!activePalette) return [];
    return activePalette.colorIds.map((cid) => doc.colorEntries.find((c) => c.id === cid)).filter((c) => !!c);
  }, [activePalette, doc.colorEntries]);
  const addPalette = () => {
    if (!newPaletteName.trim()) return;
    const id = makeId();
    setDoc((d) => ({
      ...d,
      palettes: [
        ...d.palettes,
        { id, name: newPaletteName.trim(), colorIds: [], harmony: null, sortBy: "manual", createdAt: nowTs(), updatedAt: nowTs() }
      ],
      meta: { ...d.meta, updatedAt: nowTs() }
    }));
    setNewPaletteName("");
  };
  const setActive = (id) => {
    setDoc((d) => ({
      ...d,
      activePaletteId: id,
      // 切板后选中态失效,回退新板首色
      viewState: { ...d.viewState, selectedColorId: null },
      meta: { ...d.meta, updatedAt: nowTs() }
    }));
  };
  const createWhite = () => {
    setDoc((d) => addColorEntryAndSelect(d, "#FFFFFF", "wheel"));
    setCreateMode(null);
  };
  const createFromInput = () => {
    const hex = resolveNewColorHex(newColorHex);
    setDoc((d) => addColorEntryAndSelect(d, hex, "wheel"));
    setNewColorHex("");
    setCreateMode(null);
  };
  const removeColor = (entryId) => {
    setDoc((d) => ({
      ...d,
      colorEntries: d.colorEntries.filter((c) => c.id !== entryId),
      palettes: d.palettes.map((p) => ({ ...p, colorIds: p.colorIds.filter((id) => id !== entryId), updatedAt: nowTs() })),
      viewState: d.viewState.selectedColorId === entryId ? { ...d.viewState, selectedColorId: null } : d.viewState,
      meta: { ...d.meta, updatedAt: nowTs() }
    }));
  };
  const toggleLock = (entryId) => {
    setDoc((d) => ({
      ...d,
      colorEntries: d.colorEntries.map(
        (c) => c.id === entryId ? { ...c, locked: !c.locked, updatedAt: nowTs() } : c
      ),
      meta: { ...d.meta, updatedAt: nowTs() }
    }));
  };
  const moveColor = (entryId, dir) => {
    setDoc((d) => ({
      ...d,
      palettes: d.palettes.map((p) => {
        if (p.id !== d.activePaletteId) return p;
        const idx = p.colorIds.indexOf(entryId);
        if (idx < 0) return p;
        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= p.colorIds.length) return p;
        const next = [...p.colorIds];
        const tmp = next[idx];
        const swap = next[newIdx];
        next[idx] = swap;
        next[newIdx] = tmp;
        return { ...p, colorIds: next, updatedAt: nowTs() };
      }),
      meta: { ...d.meta, updatedAt: nowTs() }
    }));
  };
  return /* @__PURE__ */ jsxs("div", { className: "sl-cs-palettes", children: [
    /* @__PURE__ */ jsx("h3", { children: "\u8C03\u8272\u677F" }),
    /* @__PURE__ */ jsx("ul", { className: "sl-cs-palettes__list", children: doc.palettes.map((p) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        className: `sl-cs-palettes__name ${p.id === doc.activePaletteId ? "is-active" : ""}`,
        onClick: () => setActive(p.id),
        children: p.name
      }
    ) }, p.id)) }),
    /* @__PURE__ */ jsxs("div", { className: "sl-cs-palettes__add", children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          className: "sl-cs-input",
          placeholder: "\u65B0\u677F\u540D\u79F0",
          value: newPaletteName,
          onChange: (e) => setNewPaletteName(e.target.value),
          onKeyDown: (e) => {
            if (e.key === "Enter") addPalette();
          }
        }
      ),
      /* @__PURE__ */ jsx(Btn, { variant: "secondary", size: "sm", iconOnly: true, icon: "plus", onClick: addPalette, "aria-label": "\u65B0\u589E\u8C03\u8272\u677F" })
    ] }),
    /* @__PURE__ */ jsx("h4", { children: "\u5F53\u524D\u677F\u8272" }),
    /* @__PURE__ */ jsxs("div", { className: "sl-cs-palettes__create", children: [
      /* @__PURE__ */ jsx(Btn, { variant: "primary", size: "sm", icon: "plus", onClick: createWhite, title: "\u65B0\u5EFA\u4E00\u4E2A\u767D\u8272\u8272\u5361(\u7A7A\u677F\u767D\u8272\u753B\u5E03 \u2192 \u9996\u8272)", children: "\u65B0\u5EFA\u989C\u8272" }),
      /* @__PURE__ */ jsx(
        Btn,
        {
          variant: "secondary",
          size: "sm",
          icon: "palette",
          onClick: () => setCreateMode(createMode === "input" ? null : "input"),
          title: "\u8F93\u5165 hex/rgb/\u540D\u5B57\u521B\u5EFA\u989C\u8272",
          children: "\u8F93\u5165\u521B\u5EFA"
        }
      )
    ] }),
    createMode === "input" && /* @__PURE__ */ jsxs("div", { className: "sl-cs-palettes__add-color", children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          autoFocus: true,
          className: "sl-cs-input",
          placeholder: "#FF5733 \u6216 red(\u7559\u7A7A \u2192 \u767D\u8272)",
          value: newColorHex,
          onChange: (e) => setNewColorHex(e.target.value),
          onKeyDown: (e) => {
            if (e.key === "Enter") createFromInput();
            if (e.key === "Escape") setCreateMode(null);
          }
        }
      ),
      /* @__PURE__ */ jsx(Btn, { variant: "primary", size: "sm", icon: "plus", onClick: createFromInput, children: "\u521B\u5EFA" })
    ] }),
    /* @__PURE__ */ jsx("ul", { className: "sl-cs-palettes__colors", children: activeEntries.map((e, i) => /* @__PURE__ */ jsxs("li", { className: "sl-cs-palettes__color", children: [
      /* @__PURE__ */ jsx(
        ColorChip,
        {
          entry: e,
          active: e.id === effectiveId,
          onClick: select,
          onRemove: removeColor,
          onToggleLock: toggleLock
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "sl-cs-chip__act",
          onClick: () => moveColor(e.id, -1),
          disabled: i === 0,
          "aria-label": "\u4E0A\u79FB",
          title: "\u4E0A\u79FB",
          children: /* @__PURE__ */ jsx(Icon, { name: "chevronUp", size: 12 })
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "sl-cs-chip__act",
          onClick: () => moveColor(e.id, 1),
          disabled: i === activeEntries.length - 1,
          "aria-label": "\u4E0B\u79FB",
          title: "\u4E0B\u79FB",
          children: /* @__PURE__ */ jsx(Icon, { name: "chevronDown", size: 12 })
        }
      )
    ] }, e.id)) })
  ] });
}
export {
  PaletteSidebar
};
