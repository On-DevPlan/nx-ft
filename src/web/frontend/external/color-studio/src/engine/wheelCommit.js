import { addEntryToActivePalette } from "../utils/paletteActions";
function pickWheelCommitMode(doc, effectiveColorId) {
  const anchorId = effectiveColorId ?? doc.palettes.find((p) => p.id === doc.activePaletteId)?.colorIds[0] ?? null;
  if (anchorId) {
    const exists = doc.colorEntries.some((c) => c.id === anchorId);
    if (exists) return { mode: "edit", anchorColorId: anchorId };
  }
  return { mode: "empty", anchorColorId: null };
}
function commitWheelColor(doc, anchorColorId, hex, now = Date.now()) {
  if (!anchorColorId) return doc;
  return {
    ...doc,
    colorEntries: doc.colorEntries.map(
      (c) => c.id === anchorColorId ? { ...c, hex, updatedAt: now } : c
    ),
    meta: { ...doc.meta, updatedAt: now }
  };
}
function addColorEntryAndSelect(doc, hex, source, now = Date.now()) {
  const next = addEntryToActivePalette(doc, hex, source, now);
  const newId = next.palettes.find((p) => p.id === doc.activePaletteId)?.colorIds.at(-1);
  return {
    ...next,
    viewState: { ...next.viewState, selectedColorId: newId ?? null }
  };
}
export {
  addColorEntryAndSelect,
  commitWheelColor,
  pickWheelCommitMode
};
