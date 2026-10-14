import { converter, modeRgb } from "culori";
import {
  toHex,
  fromHex,
  interpolateColor
} from "./colorMath";
import {
  HARMONY_ANGLE_TABLE,
  HARMONY_OUTPUT_LENGTH,
  MONOCHROMATIC_TIERS
} from "../utils/constants";
const toHslConverter = converter("hsl");
function hueShift(hex, deltaDeg) {
  const hsl = toHslConverter(hex);
  const cur = hsl.h ?? 0;
  const next = ((cur + deltaDeg) % 360 + 360) % 360;
  return toHex({ mode: "hsl", h: next, s: hsl.s ?? 0, l: hsl.l ?? 0 });
}
function darkenTo(hex, targetL) {
  const currentL = fromHex(hex).hsl.l ?? 0;
  if (currentL === 0) return toHex({ mode: "rgb", r: 0, g: 0, b: 0 });
  if (targetL === 0) return toHex({ mode: "rgb", r: 0, g: 0, b: 0 });
  return interpolateColor(hex, "#000000", 1 - targetL / currentL);
}
function lightenTo(hex, targetL) {
  const currentL = fromHex(hex).hsl.l ?? 0;
  if (currentL >= 1) return toHex({ mode: "rgb", r: 1, g: 1, b: 1 });
  return interpolateColor(hex, "#FFFFFF", (targetL - currentL) / (1 - currentL));
}
function monochromaticTiers(anchor) {
  const baseL = fromHex(anchor).hsl.l ?? 0;
  const targets = [0.1, 0.35, 0.6, 0.85, 0.95];
  return targets.map((target) => {
    if (Math.abs(target - baseL) < 0.01) return anchor;
    return target > baseL ? lightenTo(anchor, target) : darkenTo(anchor, target);
  });
}
function deriveHarmony(anchor, type) {
  if (type === "monochromatic") {
    return monochromaticTiers(anchor).slice(0, MONOCHROMATIC_TIERS);
  }
  const offsets = HARMONY_ANGLE_TABLE[type];
  const expected = HARMONY_OUTPUT_LENGTH[type];
  const result = [anchor, ...offsets.map((deg) => hueShift(anchor, deg))];
  return result.slice(0, expected);
}
function harmonyMarkerAngles(anchorHue, type) {
  if (type === "monochromatic") return [];
  const offsets = HARMONY_ANGLE_TABLE[type];
  if (!offsets) return [];
  return offsets.map((deg) => ((anchorHue + deg) % 360 + 360) % 360);
}
function harmonyMarkerRadiusFactor(type, anchorSaturation) {
  if (type === "monochromatic") return [0.2, 0.4, 0.6, 0.8];
  const sat = Number.isFinite(anchorSaturation) ? Math.max(0, Math.min(1, anchorSaturation)) : 0;
  return [sat];
}
void modeRgb;
export {
  deriveHarmony,
  harmonyMarkerAngles,
  harmonyMarkerRadiusFactor
};
