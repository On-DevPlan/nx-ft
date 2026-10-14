import { makeId } from "./id";
function addEntryToActivePalette(doc, hex, source, now = Date.now()) {
  const id = makeId(now);
  return {
    ...doc,
    colorEntries: [
      ...doc.colorEntries,
      { id, hex, weight: 1, locked: false, note: "", tags: [], createdAt: now, updatedAt: now }
    ],
    palettes: doc.palettes.map(
      (p) => p.id === doc.activePaletteId ? { ...p, colorIds: [...p.colorIds, id], updatedAt: now } : p
    ),
    pickHistory: [{ hex, source, pickedAt: now }, ...doc.pickHistory].slice(0, 12),
    meta: { ...doc.meta, updatedAt: now }
  };
}
export {
  addEntryToActivePalette
};
