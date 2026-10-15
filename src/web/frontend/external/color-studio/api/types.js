import { makeId } from "../src/utils/id.js";
function emptyDoc(authorEmail = "", now = Date.now()) {
  const defaultPaletteId = makeId(now);
  const defaultAnchorId = makeId(now + 1);
  return {
    meta: { schemaVersion: "1.3.0", createdAt: now, updatedAt: now, authorEmail },
    activePaletteId: defaultPaletteId,
    palettes: [{
      id: defaultPaletteId,
      name: "\u9ED8\u8BA4\u8C03\u8272\u677F",
      colorIds: [defaultAnchorId],
      harmony: null,
      sortBy: "manual",
      createdAt: now,
      updatedAt: now
    }],
    colorEntries: [{
      id: defaultAnchorId,
      hex: "#3B82F6",
      weight: 1,
      locked: false,
      note: "",
      tags: [],
      createdAt: now,
      updatedAt: now
    }],
    filterStack: [],
    pickHistory: [],
    viewState: {
      leftPane: "palettes",
      showHarmony: false,
      selectedHarmony: null,
      brightness: 100,
      mainView: "wheel",
      selectedColorId: null
    }
  };
}
export {
  emptyDoc
};
