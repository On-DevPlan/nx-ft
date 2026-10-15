function normalizeWeights(entries) {
  const total = entries.reduce((s, e) => s + Math.max(0, e.weight), 0);
  if (total <= 0) {
    const even = entries.length > 0 ? 100 / entries.length : 0;
    return entries.map((e) => ({ entry: e, pct: Math.round(even * 100) / 100 }));
  }
  return entries.map((e) => ({
    entry: e,
    pct: Math.round(Math.max(0, e.weight) / total * 1e4) / 100
  }));
}
function donutSlicePath(cx, cy, rOuter, rInner, startPct, endPct) {
  const a0 = startPct / 100 * 2 * Math.PI - Math.PI / 2;
  const a1 = endPct / 100 * 2 * Math.PI - Math.PI / 2;
  const large = endPct - startPct > 50 ? 1 : 0;
  const x0 = cx + rOuter * Math.cos(a0);
  const y0 = cy + rOuter * Math.sin(a0);
  const x1 = cx + rOuter * Math.cos(a1);
  const y1 = cy + rOuter * Math.sin(a1);
  const x2 = cx + rInner * Math.cos(a1);
  const y2 = cy + rInner * Math.sin(a1);
  const x3 = cx + rInner * Math.cos(a0);
  const y3 = cy + rInner * Math.sin(a0);
  return [
    `M ${x0} ${y0}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${x1} ${y1}`,
    `L ${x2} ${y2}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${x3} ${y3}`,
    "Z"
  ].join(" ");
}
export {
  donutSlicePath,
  normalizeWeights
};
