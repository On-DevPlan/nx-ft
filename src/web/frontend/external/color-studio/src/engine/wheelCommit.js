import { addEntryToActivePalette } from "../utils/paletteActions";
import { resolveAnchorId } from "./anchor";
// 色轮编辑的目标色卡 = 当前锚色(选中色 → 和声锚色 → 首色)。
// 过去这里只看 viewState.selectedColorId,选中态为空时直接退回「首色」,
// 于是「锚色 ≠ 当前色」时拖色轮改的是别的卡,派生色当然纹丝不动。
function pickWheelCommitMode(doc, effectiveColorId) {
  const anchorId = effectiveColorId && doc.colorEntries.some((c) => c.id === effectiveColorId)
    ? effectiveColorId
    : resolveAnchorId(doc);
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
  const palette = next.palettes.find((p) => p.id === next.activePaletteId);
  // 板上有和声规则时不让新色抢走选中态:选中色即锚色,抢走会把派生色整组冲掉。
  const anchored = !!palette?.harmony?.anchorColorId && palette.colorIds.includes(palette.harmony.anchorColorId);
  if (anchored) return next;
  const newId = palette?.colorIds.at(-1);
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
