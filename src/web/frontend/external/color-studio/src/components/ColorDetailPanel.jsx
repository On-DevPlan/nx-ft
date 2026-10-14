import { jsx, jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { useColorStudio } from "../state/useColorStudio";
import { useSelectedColor } from "../hooks/useSelectedColor";
import { formatHexAs, parseUserInput } from "../engine/colorMath";
import { contrastRatio, wcagGrade } from "../engine/contrast";
import { writeClipboard } from "../utils/clipboard";
import { Btn } from "./ui/Btn";
import { COPY_FORMATS } from "../hooks/useShortcutPrefs";
const FORMAT_LABELS = {
  hex: "HEX",
  rgb: "RGB",
  hsl: "HSL",
  lab: "LAB",
  lch: "LCH",
  oklch: "OKLCH"
};
function ColorDetailPanel({ preferredFormat, onPreferredFormatChange }) {
  const { setDoc } = useColorStudio();
  const { entry } = useSelectedColor();
  const hex = entry?.hex ?? "#000000";
  const value = useMemo(() => formatHexAs(hex, preferredFormat), [hex, preferredFormat]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const commit = (candidate) => {
    const parsed = parseUserInput(candidate);
    if (!parsed || !entry) return;
    setDoc((d) => ({
      ...d,
      colorEntries: d.colorEntries.map(
        (c) => c.id === entry.id ? { ...c, hex: parsed, updatedAt: Date.now() } : c
      ),
      meta: { ...d.meta, updatedAt: Date.now() }
    }));
  };
  const copy = async () => {
    await writeClipboard(value).catch(() => void 0);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const onBlack = wcagGrade(contrastRatio(hex, "#000000"));
  const onWhite = wcagGrade(contrastRatio(hex, "#FFFFFF"));
  return /* @__PURE__ */ jsxs("div", { className: "sl-cs-detail", children: [
    /* @__PURE__ */ jsx("div", { className: "sl-cs-detail__swatch", style: { backgroundColor: hex }, children: /* @__PURE__ */ jsx("span", { className: "sl-cs-detail__hexbig", children: hex }) }),
    /* @__PURE__ */ jsxs("div", { className: "sl-cs-detail__copyrow", children: [
      /* @__PURE__ */ jsx("div", { className: "sl-cs-detail__format", role: "radiogroup", "aria-label": "\u989C\u8272\u683C\u5F0F", children: COPY_FORMATS.map((f) => /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          role: "radio",
          "aria-checked": preferredFormat === f,
          className: `sl-cs-detail__fmtbtn ${preferredFormat === f ? "is-active" : ""}`,
          onClick: () => onPreferredFormatChange(f),
          title: `\u4EE5 ${FORMAT_LABELS[f]} \u663E\u793A\u4E0E\u590D\u5236`,
          children: FORMAT_LABELS[f]
        },
        f
      )) }),
      editing ? /* @__PURE__ */ jsx(
        "input",
        {
          autoFocus: true,
          className: "sl-cs-input sl-cs-detail__edit",
          value: draft,
          onChange: (e) => setDraft(e.target.value),
          onBlur: () => {
            commit(draft);
            setEditing(false);
          },
          onKeyDown: (e) => {
            if (e.key === "Enter") {
              commit(draft);
              setEditing(false);
            }
            if (e.key === "Escape") setEditing(false);
          }
        }
      ) : /* @__PURE__ */ jsx(
        "code",
        {
          className: "sl-cs-detail__value",
          onClick: () => {
            setDraft(value);
            setEditing(true);
          },
          title: "\u70B9\u51FB\u8F93\u5165\u4EFB\u610F\u683C\u5F0F\u6539\u8272",
          children: value
        }
      ),
      /* @__PURE__ */ jsx(Btn, { variant: "primary", icon: "copy", onClick: copy, children: copied ? "\u5DF2\u590D\u5236" : "\u590D\u5236" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "sl-cs-detail__a11y", children: [
      /* @__PURE__ */ jsxs("span", { title: onBlack.hint, children: [
        "\u5BF9\u9ED1: ",
        onBlack.label
      ] }),
      /* @__PURE__ */ jsxs("span", { title: onWhite.hint, children: [
        "\u5BF9\u767D: ",
        onWhite.label
      ] })
    ] })
  ] });
}
export {
  ColorDetailPanel
};
