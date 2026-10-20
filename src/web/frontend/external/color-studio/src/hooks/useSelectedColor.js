import { useCallback, useMemo } from "react";
import { useColorStudio } from "../state/useColorStudio";
import { applyAutoFill } from "../engine/autoFill";
import { resolveAnchorId, withAnchor } from "../engine/anchor";
// 「当前色卡」= 锚色:选中色 → 和声锚色 → 首色。
// 锚色是派生色的基准,它必须跟着选中色走——否则色轮画的是选中色的派生标记,
// 列表里的派生色却是旧锚色算的,两边永远对不上(用户看到的「锚色无效」)。
function useSelectedColor() {
  const { doc, setDoc } = useColorStudio();
  return useMemo(() => {
    const effectiveId = resolveAnchorId(doc);
    const entry = effectiveId ? doc.colorEntries.find((c) => c.id === effectiveId) ?? null : null;
    return {
      entry,
      selectedId: doc.viewState.selectedColorId,
      effectiveId,
      isSelected: (id) => id === effectiveId,
      select: (id) => {
        setDoc((d) => {
          const next = withAnchor(d, id);
          const palette = next.palettes.find((p) => p.id === next.activePaletteId);
          if (!palette?.harmony) return next;
          // 换锚色 → 派生色整组重算(派生色恒为 f(锚色, 规则))
          return applyAutoFill(next, next.activePaletteId, { force: true });
        });
      }
    };
  }, [doc, setDoc]);
}
function useSelectColorCallback() {
  const { setDoc } = useColorStudio();
  return useCallback((id) => {
    setDoc((d) => {
      const next = withAnchor(d, id);
      const palette = next.palettes.find((p) => p.id === next.activePaletteId);
      if (!palette?.harmony) return next;
      return applyAutoFill(next, next.activePaletteId, { force: true });
    });
  }, [setDoc]);
}
export {
  useSelectColorCallback,
  useSelectedColor
};
