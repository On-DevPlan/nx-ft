import { converter, formatHex } from "culori";
const toOklch = converter("oklch");
function toHexOklch(l, c, h) {
  const out = formatHex({ mode: "oklch", l, c, h });
  if (!out) return "#000000";
  return out.toUpperCase();
}
function dist(a, b) {
  const dl = a.oklch[0] - b.oklch[0];
  const dc = a.oklch[1] - b.oklch[1];
  const dh = a.oklch[2] - b.oklch[2];
  return dl * dl + dc * dc + dh * dh;
}
function extractDominantColors(image, k) {
  if (!image.data || image.data.length === 0 || k < 1) return [];
  const points = [];
  for (let i = 0; i < image.data.length; i += 4) {
    const r = image.data[i];
    const g = image.data[i + 1];
    const b = image.data[i + 2];
    const a = image.data[i + 3];
    if (a < 200) continue;
    const rgb = `rgb(${r}, ${g}, ${b})`;
    const ok = toOklch(rgb);
    if (!ok || ok.l === void 0 || ok.c === void 0) continue;
    points.push({ oklch: [ok.l, ok.c, ok.h ?? 0] });
  }
  if (points.length === 0) return [];
  const centroidCount = Math.min(k, points.length);
  const centroids = [];
  centroids.push({ oklch: points[0].oklch });
  for (let i = 1; i < centroidCount; i++) {
    let bestIdx = 0;
    let bestMinDist = -1;
    for (let pi = 0; pi < points.length; pi++) {
      let minDist = Infinity;
      for (const c of centroids) {
        const d = dist(points[pi], c);
        if (d < minDist) minDist = d;
      }
      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        bestIdx = pi;
      }
    }
    centroids.push({ oklch: points[bestIdx].oklch });
  }
  const ITER = 12;
  for (let it = 0; it < ITER; it++) {
    const sums = centroids.map(() => [0, 0, 0, 0]);
    for (const p of points) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let ci = 0; ci < centroids.length; ci++) {
        const d = dist(p, centroids[ci]);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = ci;
        }
      }
      sums[bestIdx][0] += p.oklch[0];
      sums[bestIdx][1] += p.oklch[1];
      sums[bestIdx][2] += p.oklch[2];
      sums[bestIdx][3] += 1;
    }
    for (let i = 0; i < centroids.length; i++) {
      const count = sums[i][3];
      if (count > 0) {
        centroids[i] = {
          oklch: [
            sums[i][0] / count,
            sums[i][1] / count,
            sums[i][2] / count
          ]
        };
      }
    }
  }
  const counts = new Array(centroids.length).fill(0);
  for (const p of points) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let ci = 0; ci < centroids.length; ci++) {
      const d = dist(p, centroids[ci]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = ci;
      }
    }
    counts[bestIdx]++;
  }
  const order = centroids.map((c, i) => ({ c, count: counts[i] })).sort((a, b) => b.count - a.count);
  const out = order.map((o) => toHexOklch(o.c.oklch[0], o.c.oklch[1], o.c.oklch[2]));
  return out;
}
export {
  extractDominantColors
};
