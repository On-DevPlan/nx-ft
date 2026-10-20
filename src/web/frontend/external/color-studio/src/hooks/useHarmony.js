import { useEffect, useMemo, useRef } from "react";
import { useColorStudio } from "../state/useColorStudio";
import { deriveHarmony } from "../engine/harmony";
import { applyAutoFill } from "../engine/autoFill";
import { resolveAnchorId } from "../engine/anchor";
function useHarmony() {
  const { doc } = useColorStudio();
  return useMemo(() => {
    const palette = doc.palettes.find((p) => p.id === doc.activePaletteId);
    if (!palette?.harmony) return { derived: [], sourceHex: null };
    const anchor = doc.colorEntries.find((c) => c.id === resolveAnchorId(doc));
    if (!anchor) return { derived: [], sourceHex: null };
    return { derived: deriveHarmony(anchor.hex, palette.harmony.type), sourceHex: anchor.hex };
  }, [doc]);
}
function useAutoFillEffect() {
  const { doc, setDoc } = useColorStudio();
  const palette = doc.palettes.find((p) => p.id === doc.activePaletteId);
  // 指纹跟「真实锚色」——即色轮正在编辑的那张卡。
  // 过去盯的是 harmony.anchorColorId 指向的色卡,而色轮改的是当前选中色:
  // 两者一旦不是同一张,拖色轮就不会触发重派生(autoFill 形同虚设)。
  const anchorId = resolveAnchorId(doc);
  const harmonyType = palette?.harmony?.type ?? null;
  const autoFill = palette?.harmony?.autoFill ?? false;
  const anchorHex = useMemo(
    () => doc.colorEntries.find((c) => c.id === anchorId)?.hex ?? null,
    [doc.colorEntries, anchorId]
  );
  // 指纹 = (锚色 id, 锚色 hex, 和声类型, autoFill)。四者任一变化都要重跑派生——
  // 只看 (hex, type) 会漏掉「勾选 autoFill 复选框」这一步:勾上后指纹没变,
  // effect 早退,派生色永远不出现(真实踩过:点规则→列表为空→勾选框也无效)。
  const fingerprint = `${anchorId ?? ""}::${anchorHex ?? ""}::${harmonyType ?? ""}::${autoFill ? 1 : 0}`;
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
