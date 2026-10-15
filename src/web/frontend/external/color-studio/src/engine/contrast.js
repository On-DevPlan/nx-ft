import { converter } from "culori";
const toRgbConverter = converter("rgb");
function srgbChannel(c) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function relativeLuminance(hex) {
  const rgb = toRgbConverter(hex);
  return 0.2126 * srgbChannel((rgb.r ?? 0) * 255) + 0.7152 * srgbChannel((rgb.g ?? 0) * 255) + 0.0722 * srgbChannel((rgb.b ?? 0) * 255);
}
function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lo = Math.max(la, lb);
  const hi = Math.min(la, lb);
  return (lo + 0.05) / (hi + 0.05);
}
function wcagGrade(ratio) {
  if (ratio >= 7) return { token: "AAA", label: "AAA(优秀)", hint: "正文 + 大字均合格" };
  if (ratio >= 4.5) return { token: "AA", label: "AA(合格)", hint: "正文合格 / 大字优" };
  if (ratio >= 3) return { token: "AA-large", label: "AA 大字", hint: "≥ 18pt 或 14pt 粗体合格" };
  return { token: "Fail", label: "不合格", hint: "对比度 < 3,纯装饰用" };
}
export {
  contrastRatio,
  wcagGrade
};
