import { jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useColorStudio } from "../state/useColorStudio";
import { useSelectedColor } from "../hooks/useSelectedColor";
import { fromHex, toHex, parseUserInput } from "../engine/colorMath";
import { pickWheelCommitMode, commitWheelColor } from "../engine/wheelCommit";
import { applyAutoFill } from "../engine/autoFill";
import { HarmonyOverlay } from "./HarmonyOverlay";
const SIZE = 300;
const CENTER = SIZE / 2;
const RADIUS = CENTER - 4;
const HARMONY_OPTIONS = [
  { value: null, label: "\u65E0" },
  { value: "triadic", label: "\u4E09\u89D2" },
  { value: "analogous", label: "\u7C7B\u4F3C" },
  { value: "split-complementary", label: "\u5206\u88C2\u4E92\u8865" },
  { value: "monochromatic", label: "\u5355\u8272" }
];
function hexToHsv(hex) {
  const { rgb } = fromHex(hex);
  const r = rgb.r, g = rgb.g, b = rgb.b;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = (g - b) / d % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}
function hsvToHex(h, s, v) {
  const c = v * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs(hp % 2 - 1));
  let r = 0, g = 0, b = 0;
  if (hp >= 0 && hp < 1) {
    r = c;
    g = x;
  } else if (hp < 2) {
    r = x;
    g = c;
  } else if (hp < 3) {
    g = c;
    b = x;
  } else if (hp < 4) {
    g = x;
    b = c;
  } else if (hp < 5) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const m = v - c;
  return toHex({ mode: "rgb", r: r + m, g: g + m, b: b + m });
}
function paintWheel(ctx, v) {
  const img = ctx.createImageData(SIZE, SIZE);
  const data = img.data;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = x - CENTER;
      const dy = y - CENTER;
      const r = Math.sqrt(dx * dx + dy * dy);
      const idx = (y * SIZE + x) * 4;
      if (r > RADIUS) {
        data[idx + 3] = 0;
        continue;
      }
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      const h = (angle + 360) % 360;
      const s = Math.min(r / RADIUS, 1);
      const c = v * s;
      const hp = h / 60;
      const xx = c * (1 - Math.abs(hp % 2 - 1));
      let rr = 0, gg = 0, bb = 0;
      if (hp >= 0 && hp < 1) {
        rr = c;
        gg = xx;
      } else if (hp < 2) {
        rr = xx;
        gg = c;
      } else if (hp < 3) {
        gg = c;
        bb = xx;
      } else if (hp < 4) {
        gg = xx;
        bb = c;
      } else if (hp < 5) {
        rr = xx;
        bb = c;
      } else {
        rr = c;
        bb = xx;
      }
      const m = v - c;
      data[idx] = Math.round((rr + m) * 255);
      data[idx + 1] = Math.round((gg + m) * 255);
      data[idx + 2] = Math.round((bb + m) * 255);
      data[idx + 3] = r > RADIUS - 2 ? Math.round(255 * (RADIUS - r) / 2) : 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}
function ColorWheel() {
  const { doc, setDoc } = useColorStudio();
  const { entry: selected, effectiveId } = useSelectedColor();
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const draggingRef = useRef(false);
  const [cursor, setCursor] = useState(null);
  const [textHex, setTextHex] = useState("");
  const commitMode = useMemo(
    () => pickWheelCommitMode(doc, effectiveId),
    [doc, effectiveId]
  );
  const isEmpty = commitMode.mode === "empty";
  const anchorHex = selected?.hex ?? "#000000";
  const v = doc.viewState.brightness / 100;
  const commitText = useCallback(() => {
    const parsed = parseUserInput(textHex);
    if (!parsed) {
      setTextHex("");
      return;
    }
    setDoc((d) => {
      const mode = pickWheelCommitMode(d, d.viewState.selectedColorId);
      return commitWheelColor(d, mode.anchorColorId, parsed);
    });
    setTextHex("");
  }, [textHex, setDoc]);
  const hsv = useMemo(() => hexToHsv(anchorHex), [anchorHex]);
  const indicator = cursor ?? { h: hsv.h, s: hsv.s };
  const commitHex = useCallback((h, s, vv) => {
    const hex = hsvToHex(h, s, vv);
    const now = Date.now();
    setDoc((d) => {
      const mode = pickWheelCommitMode(d, d.viewState.selectedColorId);
      return commitWheelColor(d, mode.anchorColorId, hex, now);
    });
  }, [setDoc]);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    paintWheel(ctx, v);
  }, [v]);
  const handlePointer = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * SIZE - CENTER;
    const y = (e.clientY - rect.top) / rect.height * SIZE - CENTER;
    const r = Math.sqrt(x * x + y * y);
    const s = Math.min(r / RADIUS, 1);
    const h = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    setCursor({ h, s });
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      commitHex(h, s, v);
      rafRef.current = null;
    });
  }, [commitHex, v]);
  const onPointerDown = (e) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    handlePointer(e);
  };
  const onPointerMove = (e) => {
    if (!draggingRef.current) return;
    handlePointer(e);
  };
  const onPointerUp = (e) => {
    draggingRef.current = false;
    setCursor(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
    }
  };
  const indX = CENTER + indicator.s * RADIUS * Math.cos(indicator.h * Math.PI / 180);
  const indY = CENTER + indicator.s * RADIUS * Math.sin(indicator.h * Math.PI / 180);
  return /* @__PURE__ */ jsxs("div", { className: "sl-cw", children: [
    /* @__PURE__ */ jsxs("div", { className: "sl-cw__diskwrap", children: [
      /* @__PURE__ */ jsx(
        "canvas",
        {
          ref: canvasRef,
          width: SIZE,
          height: SIZE,
          className: "sl-cw__disk",
          onPointerDown,
          onPointerMove,
          onPointerUp,
          onPointerCancel: onPointerUp,
          "aria-label": "HSB \u8272\u76D8:\u8272\u76F8\u6CBF\u5706\u5468,\u9971\u548C\u5EA6\u6CBF\u534A\u5F84"
        }
      ),
      /* @__PURE__ */ jsxs("svg", { className: "sl-cw__overlay", width: SIZE, height: SIZE, viewBox: `0 0 ${SIZE} ${SIZE}`, children: [
        /* @__PURE__ */ jsx(
          "circle",
          {
            cx: indX,
            cy: indY,
            r: 7,
            fill: anchorHex,
            stroke: "#FFFFFF",
            strokeWidth: 2.5,
            style: { filter: "drop-shadow(0 0 2px rgba(0,0,0,.5))", pointerEvents: "none" }
          }
        ),
        /* @__PURE__ */ jsx(
          HarmonyOverlay,
          {
            size: SIZE,
            centerX: CENTER,
            centerY: CENTER,
            radius: RADIUS,
            type: doc.viewState.selectedHarmony,
            sourceHex: anchorHex
          }
        )
      ] }),
      isEmpty && /* @__PURE__ */ jsxs("div", { className: "sl-cw__empty", role: "status", children: [
        "\u5F53\u524D\u677F\u65E0\u989C\u8272",
        /* @__PURE__ */ jsx("br", {}),
        "\u7528\u5DE6\u4FA7\u300C\u65B0\u5EFA\u989C\u8272\u300D\u6216\u300C\u8F93\u5165\u521B\u5EFA\u300D\u6DFB\u52A0\u7B2C\u4E00\u4E2A\u8272\u5361\uFF0C\u5373\u53EF\u5F00\u59CB\u7F16\u8F91"
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "sl-cw__controls", children: [
      /* @__PURE__ */ jsxs("div", { className: "sl-cw__quickrow", children: [
        /* @__PURE__ */ jsx("span", { className: "sl-cw__quickrow-hex", style: { backgroundColor: anchorHex }, title: anchorHex }),
        /* @__PURE__ */ jsx(
          "input",
          {
            className: "sl-cw__quickrow-input",
            value: textHex,
            placeholder: anchorHex,
            onChange: (e) => setTextHex(e.target.value),
            onKeyDown: (e) => {
              if (e.key === "Enter") commitText();
              if (e.key === "Escape") setTextHex("");
            },
            "aria-label": "\u8F93\u5165 hex/rgb/\u540D\u5B57\u76F4\u63A5\u7F16\u8F91\u5F53\u524D\u8272",
            title: "\u8F93\u5165 hex/rgb/\u540D\u5B57,\u56DE\u8F66\u7F16\u8F91\u5F53\u524D\u9009\u4E2D\u8272\u5361"
          }
        ),
        /* @__PURE__ */ jsx("code", { className: "sl-cw__quickrow-value", children: anchorHex })
      ] }),
      /* @__PURE__ */ jsxs("label", { className: "sl-cw__slider", children: [
        /* @__PURE__ */ jsx("span", { children: "B (\u660E\u5EA6)" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "range",
            min: 0,
            max: 100,
            value: doc.viewState.brightness,
            onChange: (e) => {
              const newV = Number(e.target.value);
              const nextHex = hsvToHex(indicator.h, indicator.s, newV / 100);
              setDoc((d) => {
                const mode = pickWheelCommitMode(d, d.viewState.selectedColorId);
                return commitWheelColor(d, mode.anchorColorId, nextHex);
              });
            }
          }
        ),
        /* @__PURE__ */ jsx("span", { className: "sl-cw__vlabel", children: doc.viewState.brightness })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "sl-cw__harmony", children: HARMONY_OPTIONS.map((opt) => /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: `sl-cs-btn sl-cs-btn--sm sl-cs-btn--ghost ${doc.viewState.selectedHarmony === opt.value ? "is-active" : ""}`,
          onClick: () => setDoc((d) => {
            const next = {
              ...d,
              palettes: d.palettes.map((p) => {
                if (p.id !== d.activePaletteId) return p;
                // 选「无」= 清掉和声数据(applyAutoFill 会随之清掉派生条目)
                if (!opt.value) return { ...p, harmony: null, updatedAt: Date.now() };
                return {
                  ...p,
                  harmony: {
                    type: opt.value,
                    // 和声锚点 = 当前选中的色卡(而非固定首色)
                    anchorColorId: commitMode.anchorColorId ?? p.colorIds[0] ?? "",
                    autoFill: p.harmony?.autoFill ?? false
                  },
                  updatedAt: Date.now()
                };
              }),
              viewState: {
                ...d.viewState,
                selectedHarmony: opt.value,
                showHarmony: opt.value != null
              },
              meta: { ...d.meta, updatedAt: Date.now() }
            };
            // 点规则 → 立即派生一次(force 绕过 autoFill 开关;选「无」→ 清掉派生条目)。
            // autoFill 复选框只控制「锚色后续变化时是否自动重派生」,
            // 不能让「点了规则但列表里没有派生色」——那会让用户以为功能坏了。
            return applyAutoFill(next, d.activePaletteId, { force: true });
          }),
          children: opt.label
        },
        String(opt.value)
      )) }),
      (() => {
        const p = doc.palettes.find((x) => x.id === doc.activePaletteId);
        if (!p || !p.harmony) return null;
        return /* @__PURE__ */ jsxs("label", { className: "sl-cw__autofill", children: [
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "checkbox",
              checked: p.harmony.autoFill,
              onChange: (e) => setDoc((d) => ({
                ...d,
                palettes: d.palettes.map((x) => x.id === p.id && x.harmony ? { ...x, harmony: { ...x.harmony, autoFill: e.target.checked }, updatedAt: Date.now() } : x),
                meta: { ...d.meta, updatedAt: Date.now() }
              }))
            }
          ),
          /* @__PURE__ */ jsx("span", { children: "\u951A\u8272\u53D8\u5316\u81EA\u52A8\u91CD\u6D3E\u751F" })
        ] });
      })()
    ] })
  ] });
}
export {
  ColorWheel
};
