import { jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useRef, useState } from "react";
import { extractDominantColors } from "../engine/colorExtraction";
import { toHex } from "../engine/colorMath";
import { Btn } from "./ui/Btn";
/* SharedMount removed: nx-ft 没有跨框架桥 */
import FileDropZone from "../../components/FileDropZone";
const MAX_SIDE = 256;
function ImageColorPicker({ onPick }) {
  const canvasRef = useRef(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [hoverHex, setHoverHex] = useState(null);
  const onFiles = useCallback(async (picked) => {
    const file = picked[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    const img = new Image();
    img.src = url;
    await img.decode();
    const ratio = Math.min(MAX_SIDE / img.width, MAX_SIDE / img.height, 1);
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = canvasRef.current;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
  }, []);
  const onHover = useCallback((evt) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round((evt.clientX - rect.left) / rect.width * canvas.width);
    const y = Math.round((evt.clientY - rect.top) / rect.height * canvas.height);
    const ctx = canvas.getContext("2d");
    const px = ctx.getImageData(x, y, 1, 1).data;
    const r = Math.round(px[0] ?? 0);
    const g = Math.round(px[1] ?? 0);
    const b = Math.round(px[2] ?? 0);
    setHoverHex(toHex({ mode: "rgb", r: r / 255, g: g / 255, b: b / 255 }));
  }, []);
  const onClick = useCallback(() => {
    if (hoverHex) onPick(hoverHex);
  }, [hoverHex, onPick]);
  const extractDominant = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const palette = extractDominantColors(data, 6);
    palette.slice(0, 5).forEach(onPick);
  }, [onPick]);
  return /* @__PURE__ */ jsxs("div", { className: "sl-cs-imagepicker", children: [
    /* @__PURE__ */ jsx(
        FileDropZone, {
          variant: "bare",
          accept: "image/*",
          label: "\u4E0A\u4F20\u56FE\u7247\u53D6\u8272",
          onSelect: (picked) => {
            void onFiles(picked);
          }
        }
      ),
    imageUrl && /* @__PURE__ */ jsxs("div", { className: "sl-cs-imagepicker__preview", children: [
      /* @__PURE__ */ jsx(
        "canvas",
        {
          ref: canvasRef,
          onMouseMove: onHover,
          onMouseLeave: () => setHoverHex(null),
          onClick,
          style: { maxWidth: "100%", cursor: "crosshair" }
        }
      ),
      hoverHex && /* @__PURE__ */ jsxs("div", { className: "sl-cs-imagepicker__hover", children: [
        /* @__PURE__ */ jsx(
          "span",
          {
            className: "sl-cs-imagepicker__chip",
            style: { backgroundColor: hoverHex }
          }
        ),
        /* @__PURE__ */ jsx("code", { children: hoverHex }),
        /* @__PURE__ */ jsx(Btn, { variant: "secondary", size: "sm", icon: "plus", onClick, children: "\u52A0\u5165" })
      ] }),
      /* @__PURE__ */ jsx(Btn, { variant: "secondary", icon: "palette", onClick: extractDominant, children: "\u63D0\u53D6 5 \u4E3B\u8272" })
    ] })
  ] });
}
export {
  ImageColorPicker
};
