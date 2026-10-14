import { converter } from "culori";
import { toHex } from "./colorMath";
const toRgb = converter("rgb");
function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}
function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function linearToSrgb(c) {
  return c <= 31308e-7 ? 12.92 * c : 1.055 * Math.pow(c, 0.41666) - 0.055;
}
function isNeutral(f) {
  switch (f.type) {
    case "brightness":
    case "contrast":
    case "saturate":
      return f.value === 100;
    case "hueRotate":
      return f.value % 360 === 0;
    case "grayscale":
    case "sepia":
    case "invert":
      return f.value === 0;
  }
}
function applyOne(f, rgb) {
  const [r, g, b] = rgb;
  switch (f.type) {
    case "brightness": {
      const k = f.value / 100;
      return [clamp01(r * k), clamp01(g * k), clamp01(b * k)];
    }
    case "contrast": {
      const k = f.value / 100;
      return [clamp01((r - 0.5) * k + 0.5), clamp01((g - 0.5) * k + 0.5), clamp01((b - 0.5) * k + 0.5)];
    }
    case "saturate": {
      const k = f.value / 100;
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return [clamp01(l + (r - l) * k), clamp01(l + (g - l) * k), clamp01(l + (b - l) * k)];
    }
    case "grayscale": {
      const k = 1 - f.value / 100;
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return [clamp01(l + (r - l) * k), clamp01(l + (g - l) * k), clamp01(l + (b - l) * k)];
    }
    case "invert": {
      const x = f.value / 100;
      return [clamp01(x * (1 - r) + (1 - x) * r), clamp01(x * (1 - g) + (1 - x) * g), clamp01(x * (1 - b) + (1 - x) * b)];
    }
    case "hueRotate": {
      const rad = f.value % 360 * Math.PI / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
      const m = [
        0.213 + cos * 0.787 - sin * 0.213,
        0.715 - cos * 0.715 - sin * 0.715,
        0.072 - cos * 0.072 + sin * 0.928,
        0.213 - cos * 0.213 + sin * 0.143,
        0.715 + cos * 0.285 + sin * 0.14,
        0.072 - cos * 0.072 - sin * 0.283,
        0.213 - cos * 0.213 - sin * 0.787,
        0.715 - cos * 0.715 + sin * 0.715,
        0.072 + cos * 0.928 + sin * 0.072
      ];
      return [
        clamp01(linearToSrgb(m[0] * lr + m[1] * lg + m[2] * lb)),
        clamp01(linearToSrgb(m[3] * lr + m[4] * lg + m[5] * lb)),
        clamp01(linearToSrgb(m[6] * lr + m[7] * lg + m[8] * lb))
      ];
    }
    case "sepia": {
      const x = f.value / 100;
      const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
      const sr = 0.393 * lr + 0.769 * lg + 0.189 * lb;
      const sg = 0.349 * lr + 0.686 * lg + 0.168 * lb;
      const sb = 0.272 * lr + 0.534 * lg + 0.131 * lb;
      return [
        clamp01(linearToSrgb(lr + (sr - lr) * x)),
        clamp01(linearToSrgb(lg + (sg - lg) * x)),
        clamp01(linearToSrgb(lb + (sb - lb) * x))
      ];
    }
  }
}
function applyFilterStackToHex(hex, stack) {
  const active = stack.filter((f) => f.enabled && !isNeutral(f));
  if (active.length === 0) return hex.toUpperCase();
  const rgb = toRgb(hex);
  let cur = [rgb.r ?? 0, rgb.g ?? 0, rgb.b ?? 0];
  for (const f of active) {
    cur = applyOne(f, cur);
  }
  return toHex({ mode: "rgb", r: cur[0], g: cur[1], b: cur[2] });
}
function bakeFilterOn(doc, hex) {
  return applyFilterStackToHex(hex, doc.filterStack);
}
export {
  applyFilterStackToHex,
  bakeFilterOn
};
