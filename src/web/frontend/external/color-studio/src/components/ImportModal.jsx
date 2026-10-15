import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useRef, useState } from "react";
import { parseColorImportToml } from "../engine/importParser";
import { COLOR_IMPORT_FORMAT_PROMPT } from "../prompts/colorImportPrompt";
import { Icon } from "./ui/Icon";
import { Btn } from "./ui/Btn";
import { useToast } from "../../../../components/ui.jsx";
/* SharedMount removed: nx-ft 没有跨框架桥 */
import FileDropZone from "../../components/FileDropZone";
import { useEscClose } from "../hooks/useEscClose";
function ImportModal({ open, onImport, onClose, activePalette }) {
  const toast = useToast();
  const [mode, setMode] = useState("paste");
  const [text, setText] = useState("");
  const [parseResult, setParseResult] = useState(null);
  const [parsed, setParsed] = useState(false);
  const [resultSummary, setResultSummary] = useState(null);
  const [showFormat, setShowFormat] = useState(false);
  const [copied, setCopied] = useState(false);
  const [incrementalCopied, setIncrementalCopied] = useState(false);
  const copyTimerRef = useRef(null);
  // useEscClose 必须在早退之前调用（同 ExportModal：Shell 无条件挂载，hook 在
  // return 之后会在开→关切换时报 React #310）。
  useEscClose(open, onClose);
  if (!open) return null;
  async function handleCopyFormat() {
    await copyText(COLOR_IMPORT_FORMAT_PROMPT, setCopied);
  }
  function buildIncrementalPrompt(paletteName, colors) {
    const lines = [];
    lines.push(`\u4F60\u662F\u4E00\u4E2A\u914D\u8272\u6269\u5C55\u52A9\u624B\u3002\u5F53\u524D\u8C03\u8272\u677F\u300C${paletteName}\u300D\u5DF2\u7ECF\u6709\u4EE5\u4E0B\u989C\u8272,\u8BF7\u4F60\u6309\u7167\u4E0B\u9762\u7ED9\u51FA\u7684 TOML \u683C\u5F0F\u89C4\u8303,\u57FA\u4E8E\u300C${paletteName}\u300D\u7684\u8BED\u4E49,\u6269\u5C55\u51FA\u66F4\u591A\u914D\u8272(\u66F4\u591A\u989C\u8272\u3001\u66F4\u5168\u7684\u573A\u666F\u8986\u76D6,\u5E76\u7ED9\u51FA\u5408\u7406\u7684 weight \u5360\u6BD4)\u3002`);
    lines.push("");
    lines.push("# === \u5DF2\u6709\u989C\u8272(\u8BF7\u4E25\u683C\u907F\u5F00\u8FD9\u4E9B hex,\u4E0D\u8981\u8F93\u51FA\u76F8\u540C\u6216\u51B2\u7A81\u7684\u6761\u76EE) ===");
    if (colors.length === 0) {
      lines.push("# (\u5F53\u524D\u8C03\u8272\u677F\u4E3A\u7A7A,\u53EF\u4EE5\u81EA\u7531\u6269\u5C55)");
    } else {
      for (const c of colors) {
        const note = c.note || "(\u65E0\u5907\u6CE8)";
        const tags = c.tags.length > 0 ? `,tags=${JSON.stringify(c.tags)}` : "";
        lines.push(`# - hex="${c.hex}"  weight=${c.weight}  note="${note}"${tags}`);
      }
    }
    lines.push("");
    lines.push("# === \u8F93\u51FA\u8981\u6C42 ===");
    lines.push("# - \u4E25\u683C\u6309\u4E0B\u9762\u7ED9\u51FA\u7684 TOML \u683C\u5F0F\u89C4\u8303\u8F93\u51FA");
    lines.push("# - \u4E0D\u8981\u91CD\u590D\u4E0A\u8FF0\u300C\u5DF2\u6709\u989C\u8272\u300D\u5217\u8868\u4E2D\u7684\u4EFB\u4F55 hex");
    lines.push('# - \u8F93\u51FA [[palettes]] \u65F6 name \u5FC5\u987B\u4E3A "' + paletteName + '"');
    lines.push("# - \u53EA\u8F93\u51FA TOML \u6587\u672C,\u4E0D\u8981 markdown \u4EE3\u7801\u5757\u5305\u88F9,\u4E0D\u8981\u5199\u524D\u8A00/\u89E3\u91CA");
    lines.push("");
    lines.push("# === TOML \u683C\u5F0F\u89C4\u8303(\u539F\u6837\u9075\u5FAA) ===");
    lines.push("");
    lines.push(COLOR_IMPORT_FORMAT_PROMPT);
    return lines.join("\n");
  }
  async function handleCopyIncremental() {
    if (!activePalette) return;
    const prompt = buildIncrementalPrompt(activePalette.palette.name, activePalette.colors);
    await copyText(prompt, setIncrementalCopied);
  }
  async function copyText(text2, setState) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text2);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text2;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setState(true);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setState(false), 1800);
    } catch {
      toast("\u590D\u5236\u5931\u8D25,\u8BF7\u624B\u52A8\u9009\u62E9\u6587\u672C");
    }
  }
  function handleCleanup() {
    if (copyTimerRef.current) {
      window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
  }
  function handleConfirm() {
    if (!parseResult) return;
    const stats = onImport(parseResult);
    setResultSummary(stats);
  }
  function handleFile(picked) {
    const file = picked[0];
    if (!file) return;
    if (file.size > 1e6) {
      toast("\u6587\u4EF6\u8FC7\u5927,\u8BF7\u63A7\u5236\u5728 1MB \u4EE5\u5185");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result;
      setText(content);
      const result = parseColorImportToml(content);
      setParseResult(result);
      setParsed(true);
    };
    reader.onerror = () => toast("\u65E0\u6CD5\u8BFB\u53D6\u6587\u4EF6");
    reader.readAsText(file);
  }
  function handleTextChange(val) {
    setText(val);
    setResultSummary(null);
    if (!val.trim()) {
      setParseResult(null);
      setParsed(false);
      return;
    }
    const result = parseColorImportToml(val);
    setParseResult(result);
    setParsed(true);
  }
  const totalPalettes = parseResult?.palettes.length ?? 0;
  const totalColors = parseResult?.palettes.reduce((n, p) => n + p.colors.length, 0) ?? 0;
  const hasErrors = parseResult && parseResult.errors.length > 0;
  const isValid = parseResult && totalPalettes > 0 && totalColors > 0;
  return /* @__PURE__ */ jsx("div", { className: "sl-cs-modal__backdrop", onClick: () => {
    handleCleanup();
    onClose();
  }, role: "presentation", children: /* @__PURE__ */ jsxs("div", { className: "sl-cs-modal sl-cs-import", onClick: (e) => e.stopPropagation(), role: "dialog", "aria-modal": "true", "aria-label": "\u5BFC\u5165\u989C\u8272", children: [
    /* @__PURE__ */ jsxs("header", { className: "sl-cs-modal__head", children: [
      /* @__PURE__ */ jsxs("h3", { children: [
        /* @__PURE__ */ jsx(Icon, { name: "upload", size: 15 }),
        " \u5BFC\u5165\u989C\u8272"
      ] }),
      /* @__PURE__ */ jsx(Btn, { variant: "ghost", size: "sm", iconOnly: true, icon: "close", onClick: () => {
        handleCleanup();
        onClose();
      }, "aria-label": "\u5173\u95ED" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "sl-cs-modal__tabs", role: "tablist", children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          role: "tab",
          "aria-selected": mode === "paste",
          className: `sl-cs-modal__tab ${mode === "paste" ? "is-active" : ""}`,
          onClick: () => {
            setMode("paste");
            setResultSummary(null);
          },
          children: "\u7C98\u8D34\u6587\u672C"
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          role: "tab",
          "aria-selected": mode === "file",
          className: `sl-cs-modal__tab ${mode === "file" ? "is-active" : ""}`,
          onClick: () => {
            setMode("file");
            setResultSummary(null);
          },
          children: "\u9009\u62E9\u6587\u4EF6"
        }
      )
    ] }),
    mode === "paste" ? /* @__PURE__ */ jsx(
      "textarea",
      {
        className: "sl-cs-modal__preview sl-cs-import__textarea",
        rows: 10,
        placeholder: `\u7C98\u8D34 TOML \u5185\u5BB9...

\u793A\u4F8B:
[[palettes]]
name = "\u54C1\u724C\u4E3B\u8272"

[[palettes.colors]]
hex = "#3B82F6"
weight = 60
note = "\u4E3B\u54C1\u724C\u84DD"`,
        value: text,
        onChange: (e) => handleTextChange(e.target.value),
        spellCheck: false,
        "aria-label": "TOML \u5185\u5BB9"
      }
    ) : /* @__PURE__ */ jsxs("div", { className: "sl-cs-import__file-zone", children: [
      /* @__PURE__ */ jsx(
        FileDropZone, {
          variant: "zone",
            accept: ".toml,.txt",
            onSelect: handleFile
        }
      ),
      text && /* @__PURE__ */ jsxs("p", { className: "sl-cs-import__file-name", children: [
        "\u5DF2\u52A0\u8F7D ",
        text.length,
        " \u5B57\u8282"
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "sl-cs-import__preview", children: [
      parsed && !text.trim() && /* @__PURE__ */ jsx("span", { children: "\u672A\u8F93\u5165\u5185\u5BB9" }),
      parsed && text.trim() && parseResult && /* @__PURE__ */ jsxs("span", { children: [
        "\u89E3\u6790\u7ED3\u679C: ",
        totalPalettes,
        " \u4E2A\u8C03\u8272\u677F, ",
        totalColors,
        " \u4E2A\u989C\u8272",
        hasErrors && /* @__PURE__ */ jsxs("span", { className: "sl-cs-import__preview-warn", children: [
          ", ",
          parseResult.errors.length,
          " \u4E2A\u8B66\u544A"
        ] })
      ] })
    ] }),
    hasErrors && /* @__PURE__ */ jsxs("div", { className: "sl-cs-import__errors", children: [
      parseResult.errors.slice(0, 10).map((err, i) => /* @__PURE__ */ jsx("div", { className: "sl-cs-import__error-item", children: err }, i)),
      parseResult.errors.length > 10 && /* @__PURE__ */ jsxs("div", { className: "sl-cs-import__error-item", children: [
        "\u2026 \u8FD8\u6709 ",
        parseResult.errors.length - 10,
        " \u6761"
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "sl-cs-import__format", children: [
      /* @__PURE__ */ jsxs("div", { className: "sl-cs-import__format-head", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            className: "sl-cs-import__format-toggle",
            onClick: () => setShowFormat(!showFormat),
            children: showFormat ? "\u6536\u8D77\u683C\u5F0F\u8BF4\u660E" : "\u67E5\u770B\u683C\u5F0F\u8BF4\u660E"
          }
        ),
        /* @__PURE__ */ jsx(
          Btn,
          {
            size: "sm",
            icon: "copy",
            className: `sl-cs-import__format-copy ${incrementalCopied ? "is-copied" : ""}`,
            onClick: handleCopyIncremental,
            disabled: !activePalette,
            title: activePalette ? `\u628A\u5F53\u524D\u8C03\u8272\u677F\u300C${activePalette.palette.name}\u300D\u7684\u6269\u5C55\u63D0\u793A\u8BCD(\u542B\u5DF2\u6709 hex \u6E05\u5355)\u590D\u5236\u5230\u526A\u8D34\u677F` : "\u8BF7\u5148\u5728\u5DE6\u4FA7\u9009\u4E2D\u4E00\u4E2A\u8C03\u8272\u677F",
            children: incrementalCopied ? "\u5DF2\u590D\u5236" : "AI \u589E\u91CF\u63D0\u793A\u8BCD"
          }
        ),
        /* @__PURE__ */ jsx(
          Btn,
          {
            size: "sm",
            icon: "copy",
            className: `sl-cs-import__format-copy ${copied ? "is-copied" : ""}`,
            onClick: handleCopyFormat,
            title: "\u590D\u5236\u683C\u5F0F\u8BF4\u660E\u5230\u526A\u8D34\u677F",
            children: copied ? "\u5DF2\u590D\u5236" : "\u590D\u5236\u683C\u5F0F\u63D0\u793A\u8BCD"
          }
        )
      ] }),
      showFormat && /* @__PURE__ */ jsx("div", { className: "sl-cs-import__format-body", children: /* @__PURE__ */ jsx("pre", { children: COLOR_IMPORT_FORMAT_PROMPT }) })
    ] }),
    resultSummary && /* @__PURE__ */ jsxs("div", { className: "sl-cs-import__result", children: [
      "\u5BFC\u5165\u5B8C\u6210: \u65B0\u589E ",
      resultSummary.palettesAdded,
      " \u4E2A\u8C03\u8272\u677F, \u8FFD\u52A0 ",
      resultSummary.palettesAppended,
      " \u4E2A\u73B0\u6709\u8C03\u8272\u677F, \u5408\u8BA1 ",
      resultSummary.colorsAdded,
      " \u4E2A\u989C\u8272",
      resultSummary.colorsSkipped > 0 && /* @__PURE__ */ jsxs("span", { className: "sl-cs-import__result-warn", children: [
        ", \u8DF3\u8FC7 ",
        resultSummary.colorsSkipped,
        " \u4E2A\u91CD\u590D\u989C\u8272"
      ] })
    ] }),
    /* @__PURE__ */ jsx("footer", { className: "sl-cs-modal__foot", children: !resultSummary ? /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(Btn, { variant: "ghost", onClick: () => {
        handleCleanup();
        onClose();
      }, children: "\u53D6\u6D88" }),
      /* @__PURE__ */ jsx(Btn, { variant: "primary", disabled: !isValid, onClick: handleConfirm, children: "\u786E\u8BA4\u5BFC\u5165" })
    ] }) : /* @__PURE__ */ jsx(Btn, { variant: "primary", onClick: () => {
      handleCleanup();
      onClose();
    }, children: "\u5173\u95ED" }) })
  ] }) });
}
export {
  ImportModal
};
