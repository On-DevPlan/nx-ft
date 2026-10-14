import { useEffect, useRef } from "react";
import { useColorStudio } from "../state/useColorStudio";
import { useEyedropper } from "./useEyedropper";
import { writeClipboard } from "../utils/clipboard";
import { addEntryToActivePalette } from "../utils/paletteActions";
import { formatHexAs } from "../engine/colorMath";
function useKeyboardShortcuts(opts) {
  const { doc, setDoc } = useColorStudio();
  const { open: openEyedropper, isSupported: eyeSupported } = useEyedropper();
  const optsRef = useRef(opts);
  optsRef.current = opts;
  useEffect(() => {
    function onKey(e) {
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      const sc = optsRef.current.shortcuts;
      if ((key === sc.eyedropper || key === "e") && eyeSupported) {
        e.preventDefault();
        openEyedropper().then((hex) => {
          if (hex) optsRef.current.onEyedropperPick?.(hex);
        });
        return;
      }
      if (key === sc.addColor || key === "enter") {
        e.preventDefault();
        const palette = doc.palettes.find((p) => p.id === doc.activePaletteId);
        if (!palette || palette.colorIds.length === 0) return;
        const anchor = doc.colorEntries.find((c) => c.id === palette.colorIds[0]);
        if (!anchor) return;
        const hex = anchor.hex;
        setDoc((d) => addEntryToActivePalette(d, hex, "shortcut"));
        return;
      }
      if (key === sc.copy) {
        const palette = doc.palettes.find((p) => p.id === doc.activePaletteId);
        const firstCid = palette?.colorIds[0];
        const anchor = firstCid ? doc.colorEntries.find((c) => c.id === firstCid) : null;
        if (anchor) {
          const text = optsRef.current.copyFormat ? formatHexAs(anchor.hex, optsRef.current.copyFormat) : anchor.hex;
          writeClipboard(text).catch(() => void 0);
        }
        return;
      }
      if (key === sc.clearHistory) {
        setDoc((d) => ({ ...d, pickHistory: [] }));
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [doc, setDoc, eyeSupported, openEyedropper]);
}
export {
  useKeyboardShortcuts
};
