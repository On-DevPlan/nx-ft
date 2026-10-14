// nx-ft/components/color-studio 顶层 Shell — 从 ve 项目 color-studio 1:1 复刻
// (D:/code/a_js/proj/ve/packages/react-components/src/color-studio/)。
// 数据通过 api/colorStudioStore.js 接到 nx-ft 本地 store;三个跨包依赖
// (createColorStudioStore / JWT auth / Vue 桥 SharedMount) 都在 /api/ 下
// 用 React 等价物替换。
// 完整入口由 src/modules/color/view.jsx 在 #/color/edit/<g>/<n>/full 路由下挂载。

import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import "./index.css";
import "./theme.css";
import { useMemo, useState } from "react";
import { ColorStudioProvider } from "./src/state/ColorStudioProvider";
import { useColorStudio } from "./src/state/useColorStudio";
import { ColorWheel } from "./src/components/ColorWheel";
import { ColorDetailPanel } from "./src/components/ColorDetailPanel";
import { PaletteSidebar } from "./src/components/PaletteSidebar";
import { QuickAddBar } from "./src/components/QuickAddBar";
import { PickerPanel } from "./src/components/PickerPanel";
import { HistoryStrip } from "./src/components/HistoryStrip";
import { ShortcutEditor } from "./src/components/ShortcutEditor";
import { ExportModal } from "./src/components/ExportModal";
import { ImportModal } from "./src/components/ImportModal";
import { CookbookPage } from "./src/components/CookbookPage";
import { ProportionalView } from "./src/components/ProportionalView";
import { FilterPanel } from "./src/components/FilterPanel";
import { BrushCanvas } from "./src/components/BrushCanvas";
import { Btn } from "./src/components/ui/Btn";
import { Icon } from "./src/components/ui/Icon";
import { useKeyboardShortcuts } from "./src/hooks/useKeyboardShortcuts";
import { useShortcutPrefs } from "./src/hooks/useShortcutPrefs";
import { useAutoFillEffect } from "./src/hooks/useHarmony";
import { addEntryToActivePalette } from "./src/utils/paletteActions";
import { mergePalettesIntoDoc } from "./src/engine/importMerge";
import { parseUserInput } from "./src/engine/colorMath";
const MAIN_VIEWS = [
  { value: "wheel", label: "\u8272\u76D8", icon: "palette" },
  { value: "proportional", label: "\u6BD4\u4F8B", icon: "group" },
  { value: "brush", label: "\u7B14\u5237", icon: "brush" }
];
function ColorStudio() {
  return /* @__PURE__ */ jsx(ColorStudioProvider, { children: /* @__PURE__ */ jsx(Shell, {}) });
}

/**
 * 全屏页包装(force fullscreen + 把 group 注入 URL):
 *  - 接受 group / name props,把这个分组作为 doc 容器
 *  - 强制 position: fixed; inset: 0; width: 100vw; height: 100vh
 *  - 通过 history.replaceState 设置 ?group=<g>,ColorStudioStore 从 location.search 读
 *  - 面板 App.jsx 切到 #/color/edit/<g>/<n>/full 时由 ColorView 渲染这个组件
 */
function ColorStudioFullscreen({ group = "demo", name = null }) {
  if (typeof window !== "undefined") {
    // 保留 hash 里已有的查询参数(view/modal/palette),只合并 group
    const hash = window.location.hash;
    const hashParts = hash.split("?");
    const hashPath = hashParts[0];
    const existingQs = hashParts[1] || "";
    const sp = new URLSearchParams(existingQs);
    sp.set("group", group);
    const newHash = hashPath + "?" + sp.toString();
    if (window.location.hash !== newHash) {
      window.history.replaceState({}, "", window.location.pathname + window.location.search + newHash);
    }
  }
  return /* @__PURE__ */ jsx("div", {
    style: {
      position: "fixed",
      inset: 0,
      width: "100vw",
      height: "100vh",
      zIndex: 100,
      background: "var(--sl-color-surface, #fff)",
      overflow: "hidden",
    },
    children: /* @__PURE__ */ jsx(ColorStudio, {}),
  });
}
function Shell() {
  const { doc, setDoc, status, authState } = useColorStudio();
  const { prefs, ready, setKey, setCopyFormat, resetAll } = useShortcutPrefs();
  const [exportOpen, setExportOpen] = useState(() => {
    const sp = new URLSearchParams((typeof location !== "undefined" && location.hash.split("?")[1]) || location.search);
    return sp.get("modal") === "export";
  });
  const [importOpen, setImportOpen] = useState(() => {
    const sp = new URLSearchParams((typeof location !== "undefined" && location.hash.split("?")[1]) || location.search);
    return sp.get("modal") === "import";
  });
  const [cookbookOpen, setCookbookOpen] = useState(() => {
    const sp = new URLSearchParams((typeof location !== "undefined" && location.hash.split("?")[1]) || location.search);
    return sp.get("modal") === "cookbook";
  });
  useKeyboardShortcuts({ shortcuts: prefs.shortcuts, copyFormat: prefs.preferredCopyFormat });
  useAutoFillEffect();
  const mainView = doc.viewState.mainView ?? "wheel";
  const setMainView = (view) => {
    setDoc((d) => ({
      ...d,
      viewState: { ...d.viewState, mainView: view },
      meta: { ...d.meta, updatedAt: Date.now() }
    }));
  };
  const addPickedColor = (hex) => {
    if (!parseUserInput(hex)) return;
    setDoc((d) => addEntryToActivePalette(d, hex, "eyedropper"));
  };
  const handleImport = (result) => {
    const merged = mergePalettesIntoDoc(doc, result);
    setDoc(merged.doc);
    return merged.stats;
  };
  const activePaletteForImport = useMemo(() => {
    const p = doc.palettes.find((p2) => p2.id === doc.activePaletteId);
    if (!p) return null;
    const colors = p.colorIds.map((cid) => doc.colorEntries.find((c) => c.id === cid)).filter((c) => !!c);
    return { palette: p, colors };
  }, [doc]);
  return /* @__PURE__ */ jsxs("div", { className: "sl-cs", children: [
    /* @__PURE__ */ jsxs("header", { className: "sl-cs__header", children: [
      /* @__PURE__ */ jsx(Btn, {
        variant: "ghost", size: "sm", icon: "arrow-left",
        title: "返回工作台(去掉 URL 末段 /full)",
        onClick: () => {
          // 把 #/color/edit/<g>/<n>/full 去掉末段 full,回到工作台
          const h = location.hash;
          const back = h.replace(/\/full(\?.*)?$/, "$1");
          if (back !== h) location.hash = back;
        },
        children: "返回工作台",
      }),
      /* @__PURE__ */ jsx("h2", { children: "Color Studio" }),
      /* @__PURE__ */ jsx("span", { className: `sl-cs__status sl-cs__status--${status}`, children: status === "saving" ? "\u4FDD\u5B58\u4E2D..." : status === "synced" ? "\u5DF2\u540C\u6B65" : status === "loading" ? "\u52A0\u8F7D\u4E2D" : status === "error" ? "\u51FA\u9519" : status === "idle" ? "\u7A7A\u95F2" : status }),
      /* @__PURE__ */ jsx("span", { className: "sl-cs__auth", title: "\u6570\u636E\u5B58\u4E8E\u672C\u5730 ~/.nx-ft/assets/groups/color/,CLI \u4E0E Web \u9762\u677F\u5171\u4EAB", children: "\u672C\u5730\u5B58\u50A8" }),
      /* @__PURE__ */ jsxs("div", { className: "sl-cs__header-actions", children: [
        /* @__PURE__ */ jsx(Btn, { variant: "secondary", size: "sm", icon: "book", onClick: () => setCookbookOpen(true), children: "\u6848\u4F8B" }),
        /* @__PURE__ */ jsx(Btn, { variant: "secondary", size: "sm", icon: "upload", onClick: () => setImportOpen(true), children: "\u5BFC\u5165" }),
        /* @__PURE__ */ jsx(Btn, { variant: "secondary", size: "sm", icon: "download", onClick: () => setExportOpen(true), children: "\u5BFC\u51FA" })
      ] })
    ] }),
    /* @__PURE__ */ jsx("aside", { className: "sl-cs__left", children: /* @__PURE__ */ jsx(PaletteSidebar, {}) }),
    /* @__PURE__ */ jsxs("main", { className: "sl-cs__main", children: [
      /* @__PURE__ */ jsx("nav", { className: "sl-cs__viewnav", role: "tablist", "aria-label": "\u5DE5\u4F5C\u533A\u89C6\u56FE", children: MAIN_VIEWS.map((v) => /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          role: "tab",
          "aria-selected": mainView === v.value,
          className: `sl-cs-btn sl-cs-btn--sm sl-cs-btn--ghost ${mainView === v.value ? "is-active" : ""}`,
          onClick: () => setMainView(v.value),
          children: [
            /* @__PURE__ */ jsx(Icon, { name: v.icon, size: 13 }),
            " ",
            v.label
          ]
        },
        v.value
      )) }),
      mainView === "wheel" && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("section", { className: "sl-cs__wheel", children: /* @__PURE__ */ jsx(ColorWheel, {}) }),
        /* @__PURE__ */ jsx("section", { className: "sl-cs__detail", children: /* @__PURE__ */ jsx(
          ColorDetailPanel,
          {
            preferredFormat: prefs.preferredCopyFormat,
            onPreferredFormatChange: setCopyFormat
          }
        ) }),
        /* @__PURE__ */ jsx("section", { className: "sl-cs__history", children: /* @__PURE__ */ jsx(HistoryStrip, {}) })
      ] }),
      mainView === "proportional" && /* @__PURE__ */ jsx("section", { className: "sl-cs__propwrap", children: /* @__PURE__ */ jsx(ProportionalView, {}) }),
      mainView === "brush" && /* @__PURE__ */ jsx("section", { className: "sl-cs__brushwrap", children: /* @__PURE__ */ jsx(BrushCanvas, { onPickColor: addPickedColor }) })
    ] }),
    /* @__PURE__ */ jsxs("aside", { className: "sl-cs__right", children: [
      /* @__PURE__ */ jsx(PickerPanel, {}),
      /* @__PURE__ */ jsx(FilterPanel, {}),
      /* @__PURE__ */ jsx(ShortcutEditor, { prefs, ready, setKey, resetAll })
    ] }),
    /* @__PURE__ */ jsx("footer", { className: "sl-cs__bottom", children: /* @__PURE__ */ jsx(QuickAddBar, {}) }),
    /* @__PURE__ */ jsx(ExportModal, { open: exportOpen, onClose: () => setExportOpen(false) }),
    /* @__PURE__ */ jsx(
      ImportModal,
      {
        open: importOpen,
        onClose: () => setImportOpen(false),
        onImport: handleImport,
        activePalette: activePaletteForImport
      }
    ),
    /* @__PURE__ */ jsx(CookbookPage, { open: cookbookOpen, onClose: () => setCookbookOpen(false) })
  ] });
}
export {
  ColorStudio as default,
  ColorStudioFullscreen,
};
