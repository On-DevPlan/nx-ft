import { fetch } from "./fetch.js";
import { emptyDoc } from "./types.js";
import { repairAnchor } from "../src/engine/anchor";
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
  const segs = path.replace(/^#\/?/, "").split("/").filter(Boolean).map((s) => {
    const raw = s.split("?")[0];
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  });
  // /color/edit/<g>/<p>[/...]
  if (segs[0] === "color" && segs[1] === "edit" && segs.length >= 4) {
    return segs[2];
  }
  return null;
}

// GROUP 不能在模块求值时冻结：本 chunk 首次加载通常发生在 #/color 列表页
// （还没有 ?group=），冻住就是 "demo"——load 找不到分组永远空 doc，save 还会把
// 调色板写进错误分组。改成调用时读 URL：包装器挂载时已把 ?group=（单次编码）
// 写进 hash，load/save 都发生在那之后。
function currentGroup() {
  return queryParam("group") || groupFromHash() || "demo";
}
// nx-ft 约定「资源名 = 调色板 id」（load 里 id: a.name）。导入进来的新调色板 id 是
// 解析器生成的 ULID——save 前先查它能不能映射回资源名，映射不上就按展示名建资源。
let knownAssetNames = new Set(); // load 时刷新：当前组里已有的资源名
const importNames = new Map(); // 导入调色板 id → 已建好的资源名（会话内）
function createColorStudioStore() {
  return {
    load,
    save
  };
}
async function load() {
  const GROUP = currentGroup();
  const res = await fetch(`/api/color/tree?search=&tags=`);
  if (!res.ok) throw new Error(`tree ${res.status}`);
  const env = await res.json();
  const tree = env.data ?? env; // nx-ft \u7EDF\u4E00\u4FE1\u5C01 {ok,data}
  const group = tree.groups?.find((g) => g.path === GROUP);
  knownAssetNames = new Set((group?.assets || []).map((a) => a.name));
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
  const activeId = urlPalette && palettes.find((p) => p.id === urlPalette) ? urlPalette : palettes[0].id;
  // 锚色兜底:data 里的 anchorColorId 可能指向一张已经被删掉的卡(外部改过 JSON),
  // 这种悬空锚色会让派生色整组算不出来——重新指到本板首色。
  let doc = {
    meta: { schemaVersion: "1.3.0", createdAt: palettes[0].createdAt, updatedAt: Date.now(), authorEmail: "" },
    activePaletteId: activeId,
    palettes,
    colorEntries,
    filterStack: [],
    pickHistory: [],
    viewState: {
      leftPane: "palettes",
      showHarmony: false,
      selectedHarmony: null,
      brightness: 100,
      mainView,
      selectedColorId: null
    }
  };
  for (const p of palettes) doc = repairAnchor(doc, p.id);
  const activePalette = doc.palettes.find((p) => p.id === activeId);
  // 重开 Studio 要回到上次的和声状态:规则按钮高亮、色轮派生标记、色轮指示都读 viewState,
  // 不能硬编码 null(否则 data 里存了 harmony 却显示「无」、不画派生标记——像功能坏了)。
  const activeHarmony = activePalette?.harmony?.type ?? null;
  return {
    ...doc,
    viewState: {
      ...doc.viewState,
      showHarmony: activeHarmony != null,
      selectedHarmony: activeHarmony,
      selectedColorId: activePalette?.harmony?.anchorColorId ?? null
    }
  };
}
async function save(doc) {
  const GROUP = currentGroup();
  for (const p of doc.palettes) {
    const data = JSON.stringify({
      name: p.name,
      harmony: p.harmony,
      colors: (p.colorIds || []).map((cid) => doc.colorEntries.find((c) => c.id === cid)).filter(Boolean),
      sortBy: p.sortBy ?? "manual",
      createdAt: p.createdAt ?? Date.now(),
      updatedAt: Date.now()
    }, null, 2);
    // id → 资源名：load 来的调色板 id 本来就是资源名；导入的是 ULID，
    // 首次保存按展示名建资源（assets 端点一步创建并写入 data），之后走更新。
    let name;
    if (knownAssetNames.has(p.id)) {
      name = p.id;
    } else if (importNames.has(p.id)) {
      name = importNames.get(p.id);
    } else {
      name = p.name;
      const created = await fetch("/api/color/assets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ group: GROUP, name, style: "default", "code-data": data })
      });
      if (!created.ok) throw new Error(`save ${p.name}: ${created.status} ${await created.text()}`);
      const envCreated = await created.json();
      if (envCreated && envCreated.ok === false) throw new Error(`save ${p.name}: ${envCreated.error}`);
      importNames.set(p.id, name);
      continue;
    }
    const res = await fetch("/api/color/asset-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ group: GROUP, name, style: "default", slot: "data", "code-data": data })
    });
    if (!res.ok) throw new Error(`save ${name}: ${res.status} ${await res.text()}`);
    const env3 = await res.json();
    if (env3 && env3.ok === false) throw new Error(`save ${name}: ${env3.error}`);
  }
  return { ok: true };
}
export {
  createColorStudioStore
};
