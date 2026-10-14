import { makeId } from "../utils/id";
function mergePalettesIntoDoc(doc, result, now = Date.now()) {
  const stats = {
    palettesAdded: 0,
    palettesAppended: 0,
    colorsAdded: 0,
    colorsSkipped: 0
  };
  let seq = 0;
  const nextId = () => makeId(now + seq++);
  const mergedAt = now;
  const nextEntries = [...doc.colorEntries];
  const palettes = doc.palettes.map((p) => ({ ...p }));
  for (const imp of result.palettes) {
    const existing = palettes.find((p) => p.name === imp.name);
    if (!existing) {
      const paletteId = nextId();
      const colorIds = [];
      for (const c of imp.colors) {
        const id = nextId();
        nextEntries.push(makeEntry(id, c.hex, c.weight, c.note, c.tags, mergedAt));
        colorIds.push(id);
        stats.colorsAdded++;
      }
      palettes.push({
        id: paletteId,
        name: imp.name,
        colorIds,
        harmony: null,
        sortBy: "manual",
        createdAt: mergedAt,
        updatedAt: mergedAt
      });
      stats.palettesAdded++;
      continue;
    }
    const existingHexes = new Set(
      existing.colorIds.map((cid) => nextEntries.find((e) => e.id === cid)).filter((e) => !!e).map((e) => e.hex)
    );
    let appended = 0;
    for (const c of imp.colors) {
      if (existingHexes.has(c.hex)) {
        stats.colorsSkipped++;
        continue;
      }
      const id = nextId();
      nextEntries.push(makeEntry(id, c.hex, c.weight, c.note, c.tags, mergedAt));
      existing.colorIds.push(id);
      existingHexes.add(c.hex);
      appended++;
      stats.colorsAdded++;
    }
    if (appended > 0) {
      existing.updatedAt = mergedAt;
    }
    stats.palettesAppended++;
  }
  return {
    doc: {
      ...doc,
      colorEntries: nextEntries,
      palettes,
      meta: { ...doc.meta, updatedAt: mergedAt }
    },
    stats
  };
}
function makeEntry(id, hex, weight, note, tags, now) {
  return {
    id,
    hex,
    weight,
    locked: false,
    note,
    tags,
    createdAt: now,
    updatedAt: now
  };
}
export {
  mergePalettesIntoDoc
};
