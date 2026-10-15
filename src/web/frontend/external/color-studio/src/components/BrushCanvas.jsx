import { jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getStroke } from "perfect-freehand";
import { useColorStudio } from "../state/useColorStudio";
import { toHex } from "../engine/colorMath";
import { Btn } from "./ui/Btn";
import { Icon } from "./ui/Icon";
const BLEND_MODES = [
  { value: "source-over", label: "\u6B63\u5E38" },
  { value: "multiply", label: "\u6B63\u7247\u53E0\u5E95" },
  { value: "screen", label: "\u6EE4\u8272" },
  { value: "overlay", label: "\u53E0\u52A0" },
  { value: "soft-light", label: "\u67D4\u5149" }
];
const CANVAS_W = 560;
const CANVAS_H = 360;
const MAX_UNDO = 20;
const SAMPLE_STEP = 4;
const MAX_POINTS = 2e3;
const BASE_PRESSURE = 0.5;
const buildStrokeOptions = (size, last) => ({
  size,
  thinning: 0.35,
  smoothing: 0.5,
  streamline: 0.5,
  simulatePressure: true,
  start: { cap: true },
  end: { cap: true },
  last
});
function BrushCanvas({ onPickColor }) {
  const { doc } = useColorStudio();
  const canvasRef = useRef(null);
  const commitRef = useRef(null);
  const undoStackRef = useRef([]);
  const drawingRef = useRef(false);
  const strokePointsRef = useRef([]);
  const [blend, setBlend] = useState("multiply");
  const [size, setSize] = useState(16);
  const [opacity, setOpacity] = useState(80);
  const [pickMode, setPickMode] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [hoverHex, setHoverHex] = useState(null);
  const palette = doc.palettes.find((p) => p.id === doc.activePaletteId);
  const brushHex = useMemo(() => {
    const anchorId = palette?.colorIds[0];
    return doc.colorEntries.find((c) => c.id === anchorId)?.hex ?? "#000000";
  }, [doc.colorEntries, palette]);
  const ctx = () => canvasRef.current?.getContext("2d") ?? null;
  const commitCtx = () => commitRef.current?.getContext("2d") ?? null;
  const pushUndo = useCallback(() => {
    const commit = commitRef.current;
    if (!commit) return;
    const stack = undoStackRef.current;
    stack.push(commit.toDataURL());
    if (stack.length > MAX_UNDO) stack.shift();
    setCanUndo(true);
  }, []);
  const undo = useCallback(() => {
    const canvas = canvasRef.current;
    const context = ctx();
    const commit = commitRef.current;
    const commitContext = commitCtx();
    const snap = undoStackRef.current.pop();
    if (!canvas || !context || !commit || !commitContext || !snap) return;
    const img = new Image();
    img.onload = () => {
      commitContext.globalCompositeOperation = "source-over";
      commitContext.globalAlpha = 1;
      commitContext.clearRect(0, 0, commit.width, commit.height);
      commitContext.drawImage(img, 0, 0);
      context.globalCompositeOperation = "source-over";
      context.globalAlpha = 1;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(commit, 0, 0);
    };
    img.src = snap;
    setCanUndo(undoStackRef.current.length > 0);
  }, []);
  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const context = ctx();
    const commit = commitRef.current;
    const commitContext = commitCtx();
    if (!canvas || !context || !commit || !commitContext) return;
    pushUndo();
    strokePointsRef.current = [];
    drawingRef.current = false;
    commitContext.globalCompositeOperation = "source-over";
    commitContext.globalAlpha = 1;
    commitContext.clearRect(0, 0, commit.width, commit.height);
    commitContext.fillStyle = "#FFFFFF";
    commitContext.fillRect(0, 0, commit.width, commit.height);
    context.globalCompositeOperation = "source-over";
    context.globalAlpha = 1;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(commit, 0, 0);
  }, [pushUndo]);
  const toCanvasXY = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width * canvas.width,
      y: (e.clientY - rect.top) / rect.height * canvas.height
    };
  };
  const renderLiveStroke = useCallback(
    (last) => {
      const canvas = canvasRef.current;
      const context = ctx();
      const commit = commitRef.current;
      if (!canvas || !context || !commit) return;
      context.globalCompositeOperation = "source-over";
      context.globalAlpha = 1;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(commit, 0, 0);
      const points = strokePointsRef.current;
      if (points.length === 0) return;
      const outline = getStroke(points, buildStrokeOptions(size, last));
      if (outline.length < 3) return;
      context.globalCompositeOperation = blend;
      context.globalAlpha = opacity / 100;
      context.fillStyle = brushHex;
      context.beginPath();
      context.moveTo(outline[0][0], outline[0][1]);
      for (let i = 1; i < outline.length; i += 1) context.lineTo(outline[i][0], outline[i][1]);
      context.closePath();
      context.fill();
    },
    [blend, opacity, size, brushHex]
  );
  const pushPoint = useCallback((x, y) => {
    const pts = strokePointsRef.current;
    const lastPt = pts[pts.length - 1];
    if (pts.length >= MAX_POINTS) {
      if (lastPt) {
        lastPt[0] = x;
        lastPt[1] = y;
      }
      return;
    }
    if (!lastPt) {
      pts.push([x, y, BASE_PRESSURE]);
      return;
    }
    const dx = x - lastPt[0];
    const dy = y - lastPt[1];
    const dist = Math.hypot(dx, dy);
    if (dist <= 0) return;
    if (dist > SAMPLE_STEP) {
      const steps = Math.ceil(dist / SAMPLE_STEP);
      for (let i = 1; i <= steps; i += 1) {
        const t = i / steps;
        pts.push([lastPt[0] + dx * t, lastPt[1] + dy * t, BASE_PRESSURE]);
      }
    } else {
      pts.push([x, y, BASE_PRESSURE]);
    }
  }, []);
  const onPointerDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = toCanvasXY(e);
    if (pickMode || e.altKey) {
      const context = ctx();
      const px = context.getImageData(Math.round(x), Math.round(y), 1, 1).data;
      const hex = toHex({ mode: "rgb", r: px[0] / 255, g: px[1] / 255, b: px[2] / 255 });
      onPickColor?.(hex);
      return;
    }
    pushUndo();
    drawingRef.current = true;
    strokePointsRef.current = [];
    pushPoint(x, y);
    renderLiveStroke(false);
  };
  const onPointerMove = (e) => {
    const { x, y } = toCanvasXY(e);
    if (pickMode) {
      const context = ctx();
      if (context) {
        const px = context.getImageData(Math.round(x), Math.round(y), 1, 1).data;
        setHoverHex(toHex({ mode: "rgb", r: px[0] / 255, g: px[1] / 255, b: px[2] / 255 }));
      }
      return;
    }
    if (!drawingRef.current) return;
    pushPoint(x, y);
    renderLiveStroke(false);
  };
  const finishStroke = useCallback(() => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    renderLiveStroke(true);
    const canvas = canvasRef.current;
    const commit = commitRef.current;
    const commitContext = commitCtx();
    if (canvas && commit && commitContext) {
      commitContext.globalCompositeOperation = "source-over";
      commitContext.globalAlpha = 1;
      commitContext.clearRect(0, 0, commit.width, commit.height);
      commitContext.drawImage(canvas, 0, 0);
    }
    strokePointsRef.current = [];
  }, [renderLiveStroke]);
  const onPointerUp = (e) => {
    finishStroke();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
    }
  };
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const commit = document.createElement("canvas");
    commit.width = canvas.width;
    commit.height = canvas.height;
    const commitContext = commit.getContext("2d");
    if (commitContext) {
      commitContext.fillStyle = "#FFFFFF";
      commitContext.fillRect(0, 0, commit.width, commit.height);
    }
    commitRef.current = commit;
    const context = ctx();
    if (context) {
      context.fillStyle = "#FFFFFF";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    return () => {
      commitRef.current = null;
      strokePointsRef.current = [];
      drawingRef.current = false;
    };
  }, []);
  return /* @__PURE__ */ jsxs("div", { className: "sl-cs-brush", children: [
    /* @__PURE__ */ jsxs("div", { className: "sl-cs-brush__toolbar", children: [
      /* @__PURE__ */ jsx("div", { className: "sl-cs-brush__modes", children: BLEND_MODES.map((m) => /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: `sl-cs-btn sl-cs-btn--sm sl-cs-btn--ghost ${blend === m.value ? "is-active" : ""}`,
          onClick: () => setBlend(m.value),
          children: m.label
        },
        m.value
      )) }),
      /* @__PURE__ */ jsxs("label", { className: "sl-cs-brush__param", children: [
        /* @__PURE__ */ jsx("span", { children: "\u5927\u5C0F" }),
        /* @__PURE__ */ jsx("input", { type: "range", min: 2, max: 64, value: size, onChange: (e) => setSize(Number(e.target.value)) }),
        /* @__PURE__ */ jsx("code", { children: size })
      ] }),
      /* @__PURE__ */ jsxs("label", { className: "sl-cs-brush__param", children: [
        /* @__PURE__ */ jsx("span", { children: "\u4E0D\u900F\u660E\u5EA6" }),
        /* @__PURE__ */ jsx("input", { type: "range", min: 5, max: 100, value: opacity, onChange: (e) => setOpacity(Number(e.target.value)) }),
        /* @__PURE__ */ jsxs("code", { children: [
          opacity,
          "%"
        ] })
      ] }),
      /* @__PURE__ */ jsxs("span", { className: "sl-cs-brush__color", children: [
        /* @__PURE__ */ jsx("span", { className: "sl-cs-brush__chip", style: { backgroundColor: brushHex } }),
        /* @__PURE__ */ jsx("code", { children: brushHex })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "sl-cs-brush__actions", children: [
        /* @__PURE__ */ jsx(
          Btn,
          {
            variant: pickMode ? "primary" : "secondary",
            size: "sm",
            icon: "eyedropper",
            onClick: () => setPickMode((v) => !v),
            title: "\u4ECE\u753B\u5E03\u53D6\u8272(\u6216\u6309\u4F4F Alt \u70B9\u51FB)",
            children: "\u53D6\u8272"
          }
        ),
        /* @__PURE__ */ jsx(Btn, { variant: "secondary", size: "sm", icon: "undo", disabled: !canUndo, onClick: undo, title: "\u64A4\u9500", children: "\u64A4\u9500" }),
        /* @__PURE__ */ jsx(Btn, { variant: "danger", size: "sm", icon: "trash", onClick: clear, title: "\u6E05\u7A7A\u753B\u5E03", children: "\u6E05\u7A7A" })
      ] })
    ] }),
    /* @__PURE__ */ jsx(
      "canvas",
      {
        ref: canvasRef,
        width: CANVAS_W,
        height: CANVAS_H,
        className: `sl-cs-brush__canvas ${pickMode ? "is-picking" : ""}`,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel: onPointerUp,
        onPointerLeave: () => {
          setHoverHex(null);
          if (drawingRef.current) finishStroke();
        },
        "aria-label": "\u7B14\u5237\u753B\u5E03"
      }
    ),
    /* @__PURE__ */ jsxs("p", { className: "sl-cs-brush__hint", children: [
      /* @__PURE__ */ jsx(Icon, { name: "brush", size: 11 }),
      pickMode ? hoverHex ? `\u53D6\u8272:${hoverHex}` : "\u70B9\u51FB\u753B\u5E03\u53D6\u8272" : `\u7B14\u5237\u8272\u8DDF\u968F\u6D3B\u52A8\u677F\u9996\u8272;\u6309\u4F4F Alt \u70B9\u51FB\u753B\u5E03\u53EF\u53CD\u5411\u53D6\u8272${hoverHex ? ` \xB7 ${hoverHex}` : ""}`
    ] })
  ] });
}
export {
  BrushCanvas
};
