import { fetch } from "./fetch.js";
import { emptyDoc } from "./types.js";
// 解析查询参数:URL 形如 /#/path?... 时 location.search 为空,
// 因此优先从 hash 的 ? 后取,再回落到 search。
function queryParam(name) {
  if (typeof location === "undefined") return null;
  const fromHash = location.hash.split("?")[1];
  const sp = new URLSearchParams(fromHash || location.search);
  return sp.get(name);
}

// 从 hash 路径里取 group: /#/color/edit/<group>/<palette>/full
function groupFromHash() {
  if (typeof location === "undefined") return null;
  const path = location.hash.split("?")[0];
  const segs = path.replace(/^#\/?/, "").split("/").filter(Boolean).map((s) => s.split("?")[0]);
  // /color/edit/<g>/<p>[/...]
  if (segs[0] === "color" && segs[1] === "edit" && segs.length >= 4) {
    return segs[2];
  }
  return null;
}

const GROUP = queryParam("group") || groupFromHash() || "demo";
function createColorStudioStore() {
  return {
    load,
    save
  };
}
async function load() {
  const res = await fetch(`/api/color/tree?search=&tags=`);
  if (!res.ok) throw new Error(`tree ${res.status}`);
  const env = await res.json();
  const tree = env.data ?? env; // nx-ft \u7EDF\u4E00\u4FE1\u5C01 {ok,data}
  const group = tree.groups?.find((g) => g.path === GROUP);
  if (!group) return emptyDoc();
  const palettes = [];
  const colorEntries = [];
  for (const a of group.assets) {
    const r = await fetch(`/api/color/asset?group=${encodeURIComponent(GROUP)}&name=${encodeURIComponent(a.name)}&code=1`);
    if (!r.ok) continue;
    const env2 = await r.json();
    const detail = env2.data ?? env2;
    const raw = detail.code?.default?.data ?? "";
    if (!raw.trim()) continue;
    try {
      const palette = JSON.parse(raw);
      const localIds = [];
      for (const c of palette.colors || []) {
        colorEntries.push(c);
        localIds.push(c.id);
      }
      palettes.push({
        id: a.name,
        name: palette.name ?? a.label ?? a.name,
        colorIds: localIds,
        harmony: palette.harmony ?? null,
        sortBy: palette.sortBy ?? "manual",
        createdAt: palette.createdAt ?? Date.now(),
        updatedAt: palette.updatedAt ?? Date.now()
      });
    } catch (e) {
      console.warn(`[colorStudioStore] ${a.name} JSON \u89E3\u6790\u5931\u8D25:`, e);
    }
  }
  if (palettes.length === 0) return emptyDoc();
  // URL 参数覆盖初始视图(深链支持 + 测试钩子):
  //   ?view=proportional  → 进入「比例」视图
  //   ?view=brush         → 进入「笔刷」视图
  //   ?palette=<id>       → 切到指定调色板为活动
  //   ?modal=cookbook|import|export  → 自动打开对应弹窗
  const urlView = queryParam("view");
  const urlPalette = queryParam("palette");
  const mainView = urlView === "proportional" || urlView === "brush" ? urlView : "wheel";
  return {
    meta: { schemaVersion: "1.3.0", createdAt: palettes[0].createdAt, updatedAt: Date.now(), authorEmail: "" },
    activePaletteId: urlPalette && palettes.find((p) => p.id === urlPalette) ? urlPalette : palettes[0].id,
    palettes,
    colorEntries,
    filterStack: [],
    pickHistory: [],
    viewState: { leftPane: "palettes", showHarmony: false, selectedHarmony: null, brightness: 100, mainView, selectedColorId: null }
  };
}
async function save(doc) {
  for (const p of doc.palettes) {
    const data = JSON.stringify({
      name: p.name,
      harmony: p.harmony,
      colors: (p.colorIds || []).map((cid) => doc.colorEntries.find((c) => c.id === cid)).filter(Boolean),
      sortBy: p.sortBy ?? "manual",
      createdAt: p.createdAt ?? Date.now(),
      updatedAt: Date.now()
    }, null, 2);
    const res = await fetch("/api/color/asset-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ group: GROUP, name: p.id, style: "default", slot: "data", "code-data": data })
    });
    if (!res.ok) throw new Error(`save ${p.id}: ${res.status} ${await res.text()}`);
    const env3 = await res.json();
    if (env3 && env3.ok === false) throw new Error(`save ${p.id}: ${env3.error}`);
  }
  return { ok: true };
}
export {
  createColorStudioStore
};
