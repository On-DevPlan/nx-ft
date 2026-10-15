function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
function filterToCss(f) {
  switch (f.type) {
    case "brightness":
    case "contrast":
    case "saturate": {
      const v = clamp(f.value, 0, 300);
      if (v === 100) return null;
      return `${f.type}(${(v / 100).toFixed(2)})`;
    }
    case "hueRotate": {
      const v = clamp(f.value, 0, 360);
      if (v === 0) return null;
      return `hue-rotate(${Math.round(v)}deg)`;
    }
    case "grayscale":
    case "sepia":
    case "invert": {
      const v = clamp(f.value, 0, 100);
      if (v === 0) return null;
      return `${f.type}(${(v / 100).toFixed(2)})`;
    }
  }
}
function filterStackToCss(stack) {
  const parts = stack.filter((f) => f.enabled).map(filterToCss).filter((s) => s !== null);
  return parts.length > 0 ? parts.join(" ") : "none";
}
export {
  filterStackToCss
};
