// 锚色（anchor）解析与同步——纯函数，无任何 import（可直接被 node 单测 import）。
//
// 背景:派生色的基准色叫「锚色」，存在 palette.harmony.anchorColorId。
// 它过去只在「点和声规则按钮」那一刻写一次,之后再也不动——用户换色卡、拖色轮,
// 锚色都还钉在旧色卡上。于是:
//   · 色轮上的派生标记按「当前选中色」画(ColorWheel 传 sourceHex=选中色),
//   · 列表里的派生色却按「旧锚色」派生(applyAutoFill 读 harmony.anchorColorId),
// 两边对不上 → 用户看到的就是「锚色无效、不响应、不会自动变」。
//
// 这里把锚色定义成「当前选中的色卡」:选中谁,谁就是锚色。
// 派生色恒为 f(锚色, 规则),所以换锚色必须重派生——由调用方在 applyAutoFill 里落地。

function activePalette(doc) {
  if (!doc) return null;
  const list = Array.isArray(doc.palettes) ? doc.palettes : [];
  return list.find((p) => p.id === doc.activePaletteId) ?? null;
}
function entryOf(doc, id) {
  if (!id) return null;
  const list = Array.isArray(doc.colorEntries) ? doc.colorEntries : [];
  return list.find((c) => c.id === id) ?? null;
}
// 某个 id 是否是「当前板里真实存在的色卡」
function isColorOf(doc, palette, id) {
  if (!id || !palette) return false;
  if (!palette.colorIds.includes(id)) return false;
  return !!entryOf(doc, id);
}
// 当前锚色 id:选中色 → 和声锚色 → 首色(都必须是本板真实存在的色卡)
function resolveAnchorId(doc) {
  const palette = activePalette(doc);
  if (!palette) return null;
  const view = doc.viewState ?? {};
  if (isColorOf(doc, palette, view.selectedColorId)) return view.selectedColorId;
  if (isColorOf(doc, palette, palette.harmony?.anchorColorId)) return palette.harmony.anchorColorId;
  return palette.colorIds.find((id) => !!entryOf(doc, id)) ?? null;
}
function resolveAnchorEntry(doc) {
  return entryOf(doc, resolveAnchorId(doc));
}
// 角色互换:新锚色原本是张「派生色卡」时,把它占着的派生槽位交给旧锚色卡。
// 否则每次「拿派生色当锚色」都会多长出一张色卡(派生色数量恒定,调色板却越滚越大)。
function reassignDerivedSlot(doc, oldAnchorId, newAnchorId) {
  if (!oldAnchorId || oldAnchorId === newAnchorId) return doc;
  const palette = activePalette(doc);
  const target = entryOf(doc, newAnchorId);
  const old = entryOf(doc, oldAnchorId);
  const from = target?.derivedFrom;
  if (!palette || !from || from.paletteId !== palette.id) return doc;
  if (typeof from.slot !== "number") return doc;
  if (!old || old.derivedFrom) return doc;
  return {
    ...doc,
    colorEntries: doc.colorEntries.map((c) => {
      if (c.id === newAnchorId) {
        const copy = { ...c };
        delete copy.derivedFrom;
        return copy;
      }
      if (c.id === oldAnchorId) {
        return { ...c, derivedFrom: { paletteId: from.paletteId, rule: from.rule, slot: from.slot } };
      }
      return c;
    })
  };
}
// 让 colorId 成为新锚色:选中态 + harmony.anchorColorId 一起改。
// 不做派生(纯函数,派生由调用方接 applyAutoFill),也不碰 autoFill 开关语义。
function withAnchor(doc, colorId) {
  const palette = activePalette(doc);
  if (!palette) return doc;
  const target = isColorOf(doc, palette, colorId) ? colorId : resolveAnchorId(doc);
  if (!target) return doc;
  const oldAnchorId = palette.harmony?.anchorColorId ?? null;
  const sameSelection = (doc.viewState ?? {}).selectedColorId === target;
  const sameAnchor = !palette.harmony || palette.harmony.anchorColorId === target;
  if (sameSelection && sameAnchor) return doc;
  const now = Date.now();
  const next = {
    ...doc,
    viewState: { ...(doc.viewState ?? {}), selectedColorId: target },
    palettes: doc.palettes.map((p) => {
      if (p.id !== doc.activePaletteId || !p.harmony) return p;
      return { ...p, harmony: { ...p.harmony, anchorColorId: target }, updatedAt: now };
    }),
    meta: { ...doc.meta, updatedAt: now }
  };
  return reassignDerivedSlot(next, oldAnchorId, target);
}
// 切和声规则:type=null 表示「无」(清掉和声数据,派生色由调用方清)。
// 规则键下锚色 = 当前选中色卡(而不是固定首色),与 withAnchor 同一口径。
function withHarmonyRule(doc, type) {
  const palette = activePalette(doc);
  if (!palette) return doc;
  const now = Date.now();
  if (!type) {
    return {
      ...doc,
      palettes: doc.palettes.map((p) => p.id === doc.activePaletteId ? { ...p, harmony: null, updatedAt: now } : p),
      viewState: { ...(doc.viewState ?? {}), selectedHarmony: null, showHarmony: false },
      meta: { ...doc.meta, updatedAt: now }
    };
  }
  const anchorId = resolveAnchorId(doc);
  const oldAnchorId = palette.harmony?.anchorColorId ?? null;
  const next = {
    ...doc,
    palettes: doc.palettes.map((p) => {
      if (p.id !== doc.activePaletteId) return p;
      return {
        ...p,
        harmony: {
          type,
          anchorColorId: anchorId ?? p.colorIds[0] ?? "",
          autoFill: p.harmony?.autoFill ?? false
        },
        updatedAt: now
      };
    }),
    viewState: {
      ...(doc.viewState ?? {}),
      selectedHarmony: type,
      showHarmony: true,
      selectedColorId: anchorId ?? (doc.viewState ?? {}).selectedColorId ?? null
    },
    meta: { ...doc.meta, updatedAt: now }
  };
  return reassignDerivedSlot(next, oldAnchorId, anchorId);
}
// 兜底:锚色指向的色卡已经不在板里(外部改过 data / 删过色)时,重新指到首色。
// 不动 viewState——选中态由调用方按自己的口径决定。
function repairAnchor(doc, paletteId) {
  const pid = paletteId ?? doc.activePaletteId;
  const palette = doc.palettes.find((p) => p.id === pid);
  if (!palette || !palette.harmony) return doc;
  if (isColorOf(doc, palette, palette.harmony.anchorColorId)) return doc;
  const fallback = palette.colorIds.find((id) => !!entryOf(doc, id)) ?? null;
  return {
    ...doc,
    palettes: doc.palettes.map((p) => {
      if (p.id !== pid) return p;
      if (!fallback) return { ...p, harmony: null };
      return { ...p, harmony: { ...p.harmony, anchorColorId: fallback } };
    })
  };
}
export {
  activePalette,
  isColorOf,
  reassignDerivedSlot,
  repairAnchor,
  resolveAnchorEntry,
  resolveAnchorId,
  withAnchor,
  withHarmonyRule
};
