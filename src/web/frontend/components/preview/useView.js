// useView —— 预览画布的缩放/平移状态，外加舞台元素的 ref。
// 数学全在 zoom.js（纯函数、有单测），这里只管「事件进来 → 调模型 → 存 state」。
import { useCallback, useRef, useState } from 'react';
import { IDENTITY, STEP, applyZoom, wheelDelta, wheelFactor } from './zoom.js';

export function useView() {
  const stageRef = useRef(null);
  const [view, setView] = useState(IDENTITY);

  // 父窗口坐标 → 舞台坐标。每次调用现读 rect（容器会被分隔条拖着变大小，缓存不得）。
  const toStage = (clientX, clientY) => {
    const r = stageRef.current ? stageRef.current.getBoundingClientRect() : null;
    return r ? { x: clientX - r.left, y: clientY - r.top } : null;
  };

  // 滚轮（遮罩层上收到的）：事件坐标是父窗口的。
  // preventDefault 必须有——这个监听就是特意用 { passive: false } 挂的，
  // 不拦的话预览一缩放，底下的页面（详情页的 .shell-content）跟着滚，内容会从指针底下溜走。
  const zoomByWheel = useCallback((e) => {
    e.preventDefault();
    const p = toStage(e.clientX, e.clientY);
    if (!p) return;
    setView((v) => applyZoom(v, wheelFactor(wheelDelta(e)), p.x, p.y, 'stage'));
  }, []);

  // 滚轮（iframe 内部收到的）：事件坐标已经是内容坐标，直接用
  const zoomByInnerWheel = useCallback((e) => {
    setView((v) => applyZoom(v, wheelFactor(wheelDelta(e)), e.clientX, e.clientY, 'content'));
  }, []);

  // 工具条的 ± ：围绕舞台中心，缩小后内容仍居中（不然会缩到左上角去）
  const zoomStep = useCallback((dir) => {
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setView((v) => applyZoom(v, dir > 0 ? STEP : 1 / STEP, r.width / 2, r.height / 2, 'stage'));
  }, []);

  const panBy = useCallback((dx, dy) => setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy })), []);
  const reset = useCallback(() => setView(IDENTITY), []);

  return { view, stageRef, zoomByWheel, zoomByInnerWheel, zoomStep, panBy, reset };
}
