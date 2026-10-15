import { useCallback, useMemo } from "react";
import { toHex } from "../engine/colorMath";
function useEyedropper() {
  const isSupported = useMemo(
    () => typeof window !== "undefined" && typeof window.EyeDropper === "function",
    []
  );
  const open = useCallback(async () => {
    if (typeof window === "undefined" || typeof window.EyeDropper !== "function") return null;
    try {
      const ed = new window.EyeDropper();
      const result = await ed.open();
      return toHex(result.sRGBHex);
    } catch {
      return null;
    }
  }, []);
  return { isSupported, open };
}
export {
  useEyedropper
};
