import { deriveHarmony } from "./harmony";
import { makeId } from "../utils/id";

// force:绕过 autoFill 开关强制派生一次。色盘上点规则时用——
// 「点了三角就该在列表里看到派生色」,autoFill 复选框只管后续锚色变化是否自动重派生。
function applyAutoFill(doc, paletteId, { force = false } = {}) {
  const palette = doc.palettes.find((p) => p.id === paletteId);
  if (!palette) return doc;
  const now = Date.now();
  // 没选规则(「无」):清空该 palette 全部派生条目
  if (!palette.harmony) {
    return removeAllDerived(doc, paletteId, now);
  }
  // autoFill 关且非 force:视为「冻结当前派生集」——不清不派,保持原样
  if (!palette.harmony.autoFill && !force) {
    return doc;
  }
  const { type, anchorColorId } = palette.harmony;
  const anchor = doc.colorEntries.find((c) => c.id === anchorColorId);
  if (!anchor) return doc;
  const derived = deriveHarmony(anchor.hex, type);
  const derivedOnly = derived.slice(1);
  const existingBySlot = /* @__PURE__ */ new Map();
  for (const cid of palette.colorIds) {
    const c = doc.colorEntries.find((x) => x.id === cid);
    if (!c) continue;
    if (c.id === anchor.id) continue;
    if (c.derivedFrom?.paletteId !== paletteId) continue;
    if (typeof c.derivedFrom.slot !== "number") continue;
    existingBySlot.set(c.derivedFrom.slot, { id: c.id, entry: c });
  }
  const nextEntries = [...doc.colorEntries];
  const newIds = [];
  for (let slot = 0; slot < derivedOnly.length; slot++) {
    const hex = derivedOnly[slot];
    const existing = existingBySlot.get(slot);
    if (existing) {
      const idx = nextEntries.findIndex((e) => e.id === existing.id);
      if (idx >= 0) {
        nextEntries[idx] = {
          ...nextEntries[idx],
          hex,
          derivedFrom: { paletteId, rule: type, slot },
          updatedAt: now
        };
      }
      newIds.push(existing.id);
    } else {
      const id = makeId(now + slot);
      nextEntries.push({
        id,
        hex,
        weight: 1,
        locked: false,
        note: "",
        tags: [],
        derivedFrom: { paletteId, rule: type, slot },
        createdAt: now,
        updatedAt: now
      });
      newIds.push(id);
    }
  }
  const keepSlots = /* @__PURE__ */ new Set();
  for (let s = 0; s < derivedOnly.length; s++) keepSlots.add(s);
  const removedIds = /* @__PURE__ */ new Set();
  for (const [slot, { id, entry }] of existingBySlot) {
    if (keepSlots.has(slot)) continue;
    if (entry.locked) continue;
    removedIds.add(id);
  }
  const filteredEntries = nextEntries.filter((e) => !removedIds.has(e.id));
  return {
    ...doc,
    colorEntries: filteredEntries,
    palettes: doc.palettes.map((p) => {
      if (p.id !== paletteId) return p;
      const nonDerived = p.colorIds.filter((cid) => !removedIds.has(cid) && !newIds.includes(cid));
      return { ...p, colorIds: [...nonDerived, ...newIds], updatedAt: now };
    }),
    meta: { ...doc.meta, updatedAt: now }
  };
}
function removeAllDerived(doc, paletteId, now) {
  const removable = /* @__PURE__ */ new Set();
  for (const c of doc.colorEntries) {
    if (c.derivedFrom?.paletteId === paletteId && !c.locked) removable.add(c.id);
  }
  return {
    ...doc,
    colorEntries: doc.colorEntries.filter((e) => !removable.has(e.id)),
    palettes: doc.palettes.map((p) => {
      if (p.id !== paletteId) return p;
      return { ...p, colorIds: p.colorIds.filter((cid) => !removable.has(cid)), updatedAt: now };
    }),
    meta: { ...doc.meta, updatedAt: now }
  };
}
export {
  applyAutoFill
};
