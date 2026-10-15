function groupByEntries(entries) {
  const groups = /* @__PURE__ */ new Map();
  const ungrouped = [];
  for (const e of entries) {
    const g = (e.group ?? "").trim();
    if (!g) {
      ungrouped.push(e);
      continue;
    }
    const bucket = groups.get(g);
    if (bucket) bucket.push(e);
    else groups.set(g, [e]);
  }
  const named = Array.from(groups.entries()).map(([name, es]) => ({ name, entries: es }));
  if (ungrouped.length > 0) named.push({ name: void 0, entries: ungrouped });
  return named;
}
function listGroupNames(entries) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const e of entries) {
    const g = (e.group ?? "").trim();
    if (g && !seen.has(g)) {
      seen.add(g);
      out.push(g);
    }
  }
  return out;
}
export {
  groupByEntries,
  listGroupNames
};
