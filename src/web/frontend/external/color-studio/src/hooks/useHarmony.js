import { useEffect, useMemo, useRef } from "react";
import { useColorStudio } from "../state/useColorStudio";
import { deriveHarmony } from "../engine/harmony";
import { applyAutoFill } from "../engine/autoFill";
function useHarmony() {
  const { doc } = useColorStudio();
  return useMemo(() => {
    const palette = doc.palettes.find((p) => p.id === doc.activePaletteId);
    if (!palette?.harmony) return { derived: [], sourceHex: null };
    const anchor = doc.colorEntries.find((c) => c.id === palette.harmony.anchorColorId);
    if (!anchor) return { derived: [], sourceHex: null };
    return { derived: deriveHarmony(anchor.hex, palette.harmony.type), sourceHex: anchor.hex };
  }, [doc]);
}
function useAutoFillEffect() {
  const { doc, setDoc } = useColorStudio();
  const palette = doc.palettes.find((p) => p.id === doc.activePaletteId);
  const anchorId = palette?.harmony?.anchorColorId;
  const harmonyType = palette?.harmony?.type ?? null;
  const autoFill = palette?.harmony?.autoFill ?? false;
  const anchorHex = useMemo(
    () => doc.colorEntries.find((c) => c.id === anchorId)?.hex ?? null,
    [doc.colorEntries, anchorId]
  );
  const fingerprint = `${anchorHex ?? ""}::${harmonyType ?? ""}`;
  const lastFingerprintRef = useRef(fingerprint);
  useEffect(() => {
    if (!autoFill || !anchorId || !anchorHex || !harmonyType) {
      lastFingerprintRef.current = fingerprint;
      return;
    }
    if (lastFingerprintRef.current === fingerprint) return;
    lastFingerprintRef.current = fingerprint;
    setDoc((d) => applyAutoFill(d, d.activePaletteId));
  }, [fingerprint, anchorId, autoFill, setDoc]);
}
export {
  useAutoFillEffect,
  useHarmony
};
