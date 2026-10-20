// color 域调色板加载：树 → 每个调色板资源正文 → 分组后的色板列表。
//
// 与 color-utils.js 分开：那一层是纯函数（可单测），这一层碰网络。
// 调色板正文在 color 域资源的 data 槽里（JSON），解析失败就跳过那一条——
// 一个坏资源不该让整块面板空掉。
//
// 旧版把全部调色板**平铺**成一片色块，几十个调色板混在一起就分不清谁是谁；
// 这里按调色板分组返回，面板按组渲染。
import { canonicalHex } from './color-utils.js';

const readJson = async (res) => {
  const env = await res.json();
  return env?.data ?? env;
};

// 取一个调色板：返回 { id, name, group, colors:[{hex, note}] } 或 null。
async function loadPalette(group, asset) {
  try {
    const res = await fetch(
      `/api/color/asset?group=${encodeURIComponent(group.path)}&name=${encodeURIComponent(asset.name)}&code=1`
    );
    if (!res.ok) return null;
    const detail = await readJson(res);
    const raw = detail?.code?.default?.data;
    if (!raw) return null;
    const p = JSON.parse(raw);
    const colors = (Array.isArray(p.colors) ? p.colors : [])
      .filter((c) => c && c.hex)
      .map((c) => ({ hex: canonicalHex(c.hex) || String(c.hex).toUpperCase(), note: c.note || '' }));
    if (!colors.length) return null;
    return {
      id: `${group.path}/${asset.name}`,
      name: p.name || asset.label || asset.name,
      group: group.label || group.path || '未分组',
      colors,
    };
  } catch {
    return null;
  }
}

// 拉全量调色板。分组之间并发（原来是一条一条串行等，慢到面板空着不出东西）。
export async function loadPalettes() {
  const res = await fetch('/api/color/tree?search=&tags=');
  if (!res.ok) throw new Error(`调色板树加载失败（HTTP ${res.status}）`);
  const tree = await readJson(res);
  const groups = Array.isArray(tree?.groups) ? tree.groups : [];
  const out = [];
  await Promise.all(
    groups.map(async (g) => {
      const assets = Array.isArray(g.assets) ? g.assets : [];
      const loaded = await Promise.all(assets.map((a) => loadPalette(g, a)));
      for (const p of loaded) if (p) out.push(p);
    })
  );
  return out;
}
