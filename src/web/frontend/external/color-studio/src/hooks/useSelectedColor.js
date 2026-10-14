import { useCallback, useMemo } from "react";
import { useColorStudio } from "../state/useColorStudio";
function useSelectedColor() {
  const { doc, setDoc } = useColorStudio();
  return useMemo(() => {
    const palette = doc.palettes.find((p) => p.id === doc.activePaletteId);
    const anchorId = palette?.colorIds[0] ?? null;
    const explicit = doc.viewState.selectedColorId;
    const explicitEntry = explicit ? doc.colorEntries.find((c) => c.id === explicit) ?? null : null;
    const effective = explicitEntry ? explicitEntry.id : anchorId;
    const entry = effective ? doc.colorEntries.find((c) => c.id === effective) ?? null : null;
    return {
      entry,
      selectedId: explicit,
      effectiveId: effective,
      isSelected: (id) => id === effective,
      select: (id) => {
        setDoc((d) => ({
          ...d,
          viewState: { ...d.viewState, selectedColorId: id },
          meta: { ...d.meta, updatedAt: Date.now() }
        }));
      }
    };
  }, [doc, setDoc]);
}
function useSelectColorCallback() {
  const { setDoc } = useColorStudio();
  return useCallback((id) => {
    setDoc((d) => ({
      ...d,
      viewState: { ...d.viewState, selectedColorId: id },
      meta: { ...d.meta, updatedAt: Date.now() }
    }));
  }, [setDoc]);
}
export {
  useSelectColorCallback,
  useSelectedColor
};
