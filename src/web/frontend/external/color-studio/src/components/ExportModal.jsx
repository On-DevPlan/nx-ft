import { jsx, jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { Icon } from "./ui/Icon";
import { Btn } from "./ui/Btn";
import { useColorStudio } from "../state/useColorStudio";
import { EXPORT_FORMATS, exportDoc } from "../engine/exporters";
import { writeClipboard } from "../utils/clipboard";
import { useEscClose } from "../hooks/useEscClose";
function ExportModal({ open, onClose }) {
  const { doc } = useColorStudio();
  const [format, setFormat] = useState("css-vars");
  const [copied, setCopied] = useState(false);
  const content = useMemo(() => exportDoc(doc, format), [doc, format]);
  const meta = EXPORT_FORMATS.find((f) => f.value === format);
  // useEscClose 必须在早退之前调用：本组件被 Shell 无条件挂载（open=false 也渲染），
  // hook 放在 return 之后会在开→关切换时报 React #310（hooks 数量前后不一致）。
  useEscClose(open, onClose);
  if (!open) return null;
  const copy = async () => {
    await writeClipboard(content).catch(() => void 0);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const download = () => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `color-studio.${meta?.ext ?? "txt"}`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: "sl-cs-modal__backdrop",
      onClick: (e) => {
        if (e.target === e.currentTarget) onClose();
      },
      role: "presentation",
      children: /* @__PURE__ */ jsxs("div", { className: "sl-cs-modal", role: "dialog", "aria-modal": "true", "aria-label": "\u5BFC\u51FA\u989C\u8272", children: [
        /* @__PURE__ */ jsxs("header", { className: "sl-cs-modal__head", children: [
          /* @__PURE__ */ jsxs("h3", { children: [
            /* @__PURE__ */ jsx(Icon, { name: "download", size: 15 }),
            " \u5BFC\u51FA"
          ] }),
          /* @__PURE__ */ jsx(Btn, { variant: "ghost", size: "sm", iconOnly: true, icon: "close", onClick: onClose, "aria-label": "\u5173\u95ED" })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "sl-cs-modal__tabs", role: "tablist", children: EXPORT_FORMATS.map((f) => /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            role: "tab",
            "aria-selected": format === f.value,
            className: `sl-cs-modal__tab ${format === f.value ? "is-active" : ""}`,
            onClick: () => setFormat(f.value),
            children: f.label
          },
          f.value
        )) }),
        /* @__PURE__ */ jsx(
          "textarea",
          {
            className: "sl-cs-modal__preview",
            value: content,
            readOnly: true,
            "aria-label": "\u5BFC\u51FA\u5185\u5BB9\u9884\u89C8"
          }
        ),
        /* @__PURE__ */ jsxs("footer", { className: "sl-cs-modal__foot", children: [
          /* @__PURE__ */ jsx(Btn, { variant: "secondary", icon: "copy", onClick: copy, children: copied ? "\u5DF2\u590D\u5236" : "\u590D\u5236\u5230\u526A\u8D34\u677F" }),
          /* @__PURE__ */ jsxs(Btn, { variant: "primary", icon: "download", onClick: download, children: [
            "\u4E0B\u8F7D .",
            meta?.ext
          ] })
        ] })
      ] })
    }
  );
}
export {
  ExportModal
};
