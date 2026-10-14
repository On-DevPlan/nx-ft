import {
  parse,
  formatHex,
  converter,
  interpolate,
  formatCss
} from "culori";
const toRgbConverter = converter("rgb");
const toHslConverter = converter("hsl");
const toHsvConverter = converter("hsv");
const toLabConverter = converter("lab");
const toLchConverter = converter("lch");
const toOklchConverter = converter("oklch");
function toHex(color) {
  const out = formatHex(color);
  if (!out) throw new Error("toHex: cannot convert color to hex");
  return out.toUpperCase();
}
function fromHex(hex) {
  const rgb = toRgbConverter(hex);
  const hsl = toHslConverter(hex);
  const hsv = toHsvConverter(hex);
  const lab = toLabConverter(hex);
  const lch = toLchConverter(hex);
  const oklch = toOklchConverter(hex);
  return {
    hex: hex.toUpperCase(),
    rgb,
    hsl,
    hsv,
    lab,
    lch,
    oklch
  };
}
function parseUserInput(input) {
  const s = input.trim();
  if (!s) return null;
  const direct = parse(s);
  if (direct) {
    const rgb = toRgbConverter(direct);
    if (rgb && !Number.isNaN(rgb.r) && !Number.isNaN(rgb.g) && !Number.isNaN(rgb.b)) {
      return toHex(direct);
    }
  }
  let candidate = s;
  if (/^[0-9a-f]{3}$/i.test(s)) candidate = `#${s}`;
  else if (/^[0-9a-f]{6}$/i.test(s)) candidate = `#${s}`;
  else if (/^0x[0-9a-f]{6}$/i.test(s)) candidate = `#${s.slice(2)}`;
  if (candidate !== s) {
    const parsed = parse(candidate);
    if (parsed) {
      const rgb = toRgbConverter(parsed);
      if (rgb && !Number.isNaN(rgb.r) && !Number.isNaN(rgb.g) && !Number.isNaN(rgb.b)) {
        return toHex(parsed);
      }
    }
  }
  return null;
}
function resolveNewColorHex(input) {
  return parseUserInput(input) ?? "#FFFFFF";
}
function interpolateColor(a, b, t) {
  const clampT = Math.max(0, Math.min(1, t));
  return toHex(interpolate([a, b], "oklch")(clampT));
}
function formatColorCss(hex, mode = "rgb") {
  return formatCss(mode, hex);
}
function formatHexAs(hex, format) {
  const f = fromHex(hex);
  switch (format) {
    case "hex":
      return f.hex;
    case "rgb":
      return `rgb(${Math.round(f.rgb.r * 255)}, ${Math.round(f.rgb.g * 255)}, ${Math.round(f.rgb.b * 255)})`;
    case "hsl":
      return `hsl(${Math.round(f.hsl.h ?? 0)}, ${Math.round((f.hsl.s ?? 0) * 100)}%, ${Math.round((f.hsl.l ?? 0) * 100)}%)`;
    case "lab":
      return `lab(${(f.lab.l ?? 0).toFixed(2)} ${(f.lab.a ?? 0).toFixed(2)} ${(f.lab.b ?? 0).toFixed(2)})`;
    case "lch":
      return `lch(${(f.lch.l ?? 0).toFixed(2)} ${(f.lch.c ?? 0).toFixed(2)} ${(f.lch.h ?? 0).toFixed(2)})`;
    case "oklch":
      return `oklch(${(f.oklch.l ?? 0).toFixed(3)} ${(f.oklch.c ?? 0).toFixed(3)} ${(f.oklch.h ?? 0).toFixed(2)})`;
  }
}
export {
  formatColorCss,
  formatHexAs,
  fromHex,
  interpolateColor,
  parseUserInput,
  resolveNewColorHex,
  toHex
};
