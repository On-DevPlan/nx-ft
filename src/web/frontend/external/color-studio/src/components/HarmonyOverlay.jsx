import { jsx, jsxs } from "react/jsx-runtime";
import { fromHex } from "../engine/colorMath";
import {
  harmonyMarkerAngles,
  harmonyMarkerRadiusFactor
} from "../engine/harmony";
function polar(cx, cy, r, deg) {
  const rad = deg * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function HarmonyOverlay({ centerX, centerY, radius, type, sourceHex }) {
  if (!type || !sourceHex) return null;
  const stroke = sourceHex;
  const anchorHue = fromHex(sourceHex).hsl.h ?? 0;
  const anchorSaturation = fromHex(sourceHex).hsv.s ?? 0;
  const factors = harmonyMarkerRadiusFactor(type, anchorSaturation);
  const anchorPos = polar(centerX, centerY, radius * anchorSaturation, anchorHue);
  switch (type) {
    case "triadic": {
      const [aDeg, bDeg] = harmonyMarkerAngles(anchorHue, type);
      const [f] = factors;
      const a = polar(centerX, centerY, radius * f, aDeg);
      const b = polar(centerX, centerY, radius * f, bDeg);
      return /* @__PURE__ */ jsxs("g", { children: [
        /* @__PURE__ */ jsx("line", { x1: anchorPos.x, y1: anchorPos.y, x2: a.x, y2: a.y, stroke, strokeWidth: 2 }),
        /* @__PURE__ */ jsx("line", { x1: anchorPos.x, y1: anchorPos.y, x2: b.x, y2: b.y, stroke, strokeWidth: 2 }),
        /* @__PURE__ */ jsx("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke, strokeWidth: 1, strokeDasharray: "2 3" }),
        /* @__PURE__ */ jsx("circle", { cx: a.x, cy: a.y, r: 6, fill: "none", stroke, strokeWidth: 2 }),
        /* @__PURE__ */ jsx("circle", { cx: b.x, cy: b.y, r: 6, fill: "none", stroke, strokeWidth: 2 })
      ] });
    }
    case "analogous": {
      const [aDeg, bDeg] = harmonyMarkerAngles(anchorHue, type);
      const [f] = factors;
      const a = polar(centerX, centerY, radius * f, aDeg);
      const b = polar(centerX, centerY, radius * f, bDeg);
      return /* @__PURE__ */ jsxs("g", { children: [
        /* @__PURE__ */ jsx("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke, strokeWidth: 2 }),
        /* @__PURE__ */ jsx("circle", { cx: a.x, cy: a.y, r: 6, fill: "none", stroke, strokeWidth: 2 }),
        /* @__PURE__ */ jsx("circle", { cx: b.x, cy: b.y, r: 6, fill: "none", stroke, strokeWidth: 2 })
      ] });
    }
    case "split-complementary": {
      const [aDeg, bDeg] = harmonyMarkerAngles(anchorHue, type);
      const [f] = factors;
      const a = polar(centerX, centerY, radius * f, aDeg);
      const b = polar(centerX, centerY, radius * f, bDeg);
      return /* @__PURE__ */ jsxs("g", { children: [
        /* @__PURE__ */ jsx("line", { x1: anchorPos.x, y1: anchorPos.y, x2: a.x, y2: a.y, stroke, strokeWidth: 2 }),
        /* @__PURE__ */ jsx("line", { x1: anchorPos.x, y1: anchorPos.y, x2: b.x, y2: b.y, stroke, strokeWidth: 2 }),
        /* @__PURE__ */ jsx("circle", { cx: a.x, cy: a.y, r: 6, fill: "none", stroke, strokeWidth: 2 }),
        /* @__PURE__ */ jsx("circle", { cx: b.x, cy: b.y, r: 6, fill: "none", stroke, strokeWidth: 2 })
      ] });
    }
    case "monochromatic": {
      return /* @__PURE__ */ jsx("g", { children: factors.map((t) => /* @__PURE__ */ jsx(
        "circle",
        {
          cx: centerX,
          cy: centerY,
          r: radius * t,
          fill: "none",
          stroke,
          strokeWidth: 1,
          strokeDasharray: "2 4"
        },
        t
      )) });
    }
  }
  return null;
}
export {
  HarmonyOverlay
};
