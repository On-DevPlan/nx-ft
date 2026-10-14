// src/core/color/actions.js
//
// 色彩资源 color 专属的 action：
//   - color list       列出调色板 + 色卡
//   - color entry add  追加一个色卡
//   - color entry rm   删一个色卡
//   - color export     导出为 CSS 变量 / JSON / TOML / Tailwind
//
// 每个 color 资源 = 一个调色板（Palette JSON），存于 data 槽位。
// Palette 的形状：
//   {
//     "name": "primary",
//     "harmony": null | { type, anchorColorId, autoFill },
//     "colors": [ColorEntry, ...],   // 含 id/hex/weight/locked/note/tags/createdAt/updatedAt/derivedFrom?
//     "sortBy": "manual" | "hue" | "brightness" | "saturation",
//     "createdAt": <ms>,
//     "updatedAt": <ms>
//   }

import { badInput, notFound } from '../errors/index.js';
import { assertKind, parseGroupPath } from '../assets/constants.js';
import { assertSafeName } from '../paths.js';
import * as assets from '../assets/assets.js';
import * as storage from '../assets/storage.js';
import * as styles from '../assets/styles.js';
import { makeId } from './id.js';

const KIND = 'color';
const SLOT = 'data';

// ---- 内部工具：调色板的读 / 写 / 解析 ----

function emptyPalette(name, now = Date.now()) {
  return { name, harmony: null, colors: [], sortBy: 'manual', createdAt: now, updatedAt: now };
}

function readPalette({ group, name, style = 'default' }) {
  const groupPath = parseGroupPath(group);
  const entryName = assertSafeName(name, '资源名');
  const entry = assets.loadAsset({ kind: KIND, group: groupPath, name: entryName, code: false });
  const active = entry.activeStyle || style;
  const map = {};
  for (const s of entry.styles) {
    if (s.name === active) {
      const slots = storage.readCodeFiles(KIND, groupPath, entryName, s.name, [SLOT]);
      map[s.name] = slots[SLOT];
    }
  }
  const raw = map[active] ?? '';
  if (!raw.trim()) {
    // 资源刚建好（data 还没写）—— 视为空调色板
    return { palette: emptyPalette(entry.label || entryName), groupPath, entryName, styleName: active, raw: '' };
  }
  try {
    const parsed = JSON.parse(raw);
    return { palette: parsed, groupPath, entryName, styleName: active, raw };
  } catch (e) {
    throw badInput(`${groupPath}/${entryName} 的 data JSON 无法解析: ${e.message}`);
  }
}

function writePalette({ groupPath, entryName, styleName, palette, prevRaw }) {
  const next = JSON.stringify(palette, null, 2);
  if (next === prevRaw) return; // 无变化
  // saveCode 会做: 旧状态快照进 history + push 元数据 + 写新文件 + 更新 updatedAt。
  // 复用它而不是自己拼,这样面板里走 put 看到的 history 与 CLI 看到的完全一致。
  styles.saveCode({ kind: KIND, group: groupPath, name: entryName, style: styleName, files: { [SLOT]: next } });
}

// 校验 hex（#RGB / #RRGGBB / 0xRRGGBB 都允许，归一为 #RRGGBB 大写）
function normalizeHex(input) {
  const s = String(input ?? '').trim();
  let m;
  if ((m = /^#([0-9a-fA-F]{6})$/.exec(s))) return '#' + m[1].toUpperCase();
  if ((m = /^#([0-9a-fA-F]{3})$/.exec(s))) {
    const c = m[1];
    return ('#' + c[0] + c[0] + c[1] + c[1] + c[2] + c[2]).toUpperCase();
  }
  if ((m = /^0x([0-9a-fA-F]{6})$/i.exec(s))) return '#' + m[1].toUpperCase();
  throw badInput(`无法解析为 hex: ${input}（需 #RGB / #RRGGBB / 0xRRGGBB）`);
}

// ---- 列出所有 palette 的所有 entry（color list） ----

function listGroup(group) {
  assertKind(KIND);
  const groupPath = parseGroupPath(group);
  const manifest = storage.loadGroup(KIND, groupPath);
  if (!manifest) throw notFound(`分组不存在: ${groupPath}`);
  const names = Object.keys(manifest.assets || {});
  const palettes = names.map((n) => {
    const r = readPalette({ group: groupPath, name: n });
    return { name: n, label: r.palette.name, palette: r.palette };
  });
  return { group: groupPath, count: palettes.length, palettes };
}

function renderList(r) {
  const lines = [`${r.group}/  ${r.count} 个调色板`];
  for (const p of r.palettes) {
    lines.push(`  ${p.name}  (${p.label})  ${p.palette.colors.length} 色`);
    for (const c of p.palette.colors) {
      const tags = c.tags?.length ? `  #${c.tags.join(' #')}` : '';
      const note = c.note ? `  ${c.note}` : '';
      const derived = c.derivedFrom ? `  ←${c.derivedFrom.rule}#${c.derivedFrom.slot}` : '';
      lines.push(`    ${c.hex}  ${c.id}${note}${tags}${derived}`);
    }
  }
  return lines.join('\n');
}

// ---- entry add / rm ----

function entryAdd({ group, name, hex, note, tags }) {
  const { palette, groupPath, entryName, styleName, raw } = readPalette({ group, name });
  const normHex = normalizeHex(hex);
  const now = Date.now();
  const id = makeId(now);
  const entry = {
    id,
    hex: normHex,
    weight: 1,
    locked: false,
    note: String(note || ''),
    tags: Array.isArray(tags) ? tags : (tags ? String(tags).split(',').map((t) => t.trim()).filter(Boolean) : []),
    createdAt: now,
    updatedAt: now,
  };
  palette.colors.push(entry);
  palette.updatedAt = now;
  writePalette({ groupPath, entryName, styleName, palette, prevRaw: raw });
  return { group: groupPath, name: entryName, added: entry, total: palette.colors.length };
}

function renderEntryAdd(r) {
  return `已添加 ${r.added.hex} 到 ${r.group}/${r.name}  (调色板共 ${r.total} 色, id=${r.added.id})`;
}

function entryRm({ group, name, hex, id }) {
  const { palette, groupPath, entryName, styleName, raw } = readPalette({ group, name });
  const before = palette.colors.length;
  let removed = 0;
  if (id) {
    const idx = palette.colors.findIndex((c) => c.id === id);
    if (idx >= 0) { palette.colors.splice(idx, 1); removed = 1; }
  } else {
    const norm = normalizeHex(hex);
    palette.colors = palette.colors.filter((c) => c.hex !== norm);
    removed = before - palette.colors.length;
  }
  if (!removed) throw notFound(`未找到匹配条目（hex=${hex || ''} id=${id || ''}）`);
  palette.updatedAt = Date.now();
  writePalette({ groupPath, entryName, styleName, palette, prevRaw: raw });
  return { group: groupPath, name: entryName, removed, remaining: palette.colors.length };
}

function renderEntryRm(r) {
  return `已从 ${r.group}/${r.name} 删除 ${r.removed} 个色  (剩 ${r.remaining})`;
}

// ---- export ----

function exportGroup({ group, format }) {
  const list = listGroup(group);
  const fmt = format || 'css';
  const slugify = (s) => String(s || '').trim().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9一-鿿-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'palette';
  const out = { group: list.group, format: fmt, text: '' };
  if (fmt === 'json') {
    out.text = JSON.stringify(
      list.palettes.map((p) => ({ name: p.label, colors: p.palette.colors.map((c) => ({ hex: c.hex, note: c.note, tags: c.tags })) })),
      null,
      2,
    );
  } else if (fmt === 'css') {
    const lines = [`/* ${list.group} — ${list.count} 个调色板 */`];
    for (const p of list.palettes) {
      const slug = slugify(p.label);
      lines.push(`\n/* ${p.label} */`);
      p.palette.colors.forEach((c, i) => {
        const v = slug + (p.palette.colors.length === 1 ? '' : `-${i + 1}`);
        lines.push(`--${v}: ${c.hex};`);
      });
    }
    out.text = lines.join('\n');
  } else if (fmt === 'tailwind') {
    // tailwind.config.js 风格：colors: { 'palette-name-N': '#HEX' }
    const colors = {};
    for (const p of list.palettes) {
      const slug = slugify(p.label);
      p.palette.colors.forEach((c, i) => {
        const v = p.palette.colors.length === 1 ? slug : `${slug}-${i + 1}`;
        colors[v] = c.hex;
      });
    }
    out.text = `// tailwind.config.js\nmodule.exports = {\n  theme: {\n    extend: { colors: ${JSON.stringify(colors, null, 6).replace(/\n/g, '\n      ')} }\n  }\n};`;
  } else if (fmt === 'toml') {
    const lines = [`# ${list.group} — ${list.count} 个调色板`, ''];
    for (const p of list.palettes) {
      lines.push(`[[palettes]]`);
      lines.push(`name = "${p.label.replace(/"/g, '\\"')}"`);
      lines.push('');
      for (const c of p.palette.colors) {
        lines.push(`  [[palettes.colors]]`);
        lines.push(`  hex = "${c.hex}"`);
        if (c.note) lines.push(`  note = "${c.note.replace(/"/g, '\\"')}"`);
        if (c.tags?.length) lines.push(`  tags = [${c.tags.map((t) => `"${t}"`).join(', ')}]`);
        lines.push('');
      }
    }
    out.text = lines.join('\n');
  } else {
    throw badInput(`不支持的导出格式: ${fmt}（可用 css | json | tailwind | toml）`);
  }
  return out;
}

function renderExport(r) {
  return r.text;
}

// ---- 公共入口 ----

export function colorActions() {
  // 共享的 makeActions 提供了 19 条 CRUD/历史命令，但 color 域有一个特例：
  // data 槽位只有 1 个文件，不传 --style 时也应有地方落数据。
  // 这里把共享的 .add 替成「style 缺省为 'default'」的版本，再追加 color 专属的
  // list / entry add / entry rm / export 四条。
  return [
    {
      id: 'color.add',
      cli: [KIND, 'add'],
      http: ['POST', '/api/color/assets'],
      summary: '新建调色板资源（--code-data 必填；--style 缺省为 default）',
      args: ['group', 'name'],
      flags: {
        label: { type: 'string' },
        style: { type: 'string', default: 'default' },
        tags: { type: 'array', hint: 'brand,primary' },
        'code-data': { type: 'string', hint: 'JSON 字符串或 -' },
      },
      run: (ctx) => {
        const files = ctx['code-data'] !== undefined ? { data: ctx['code-data'] } : undefined;
        return assets.createAsset({
          kind: KIND,
          group: ctx.group,
          name: ctx.name,
          label: ctx.label,
          tags: ctx.tags,
          style: ctx.style || 'default',
          code: files,
        });
      },
      render: (r) => {
        if (r.status === 'skipped') return `资源已存在: ${r.group}/${r.name}`;
        return `已创建资源: ${r.group}/${r.name}（风格 default）`;
      },
    },
    {
      id: 'color.put',
      cli: [KIND, 'put'],
      http: ['POST', '/api/color/asset-code'],
      summary: '改写 data 槽位（--code-data 必填；--style 缺省为 default）',
      args: ['group', 'name'],
      flags: {
        style: { type: 'string', default: 'default' },
        'code-data': { type: 'string', hint: 'JSON 字符串或 -' },
      },
      run: (ctx) => {
        if (ctx['code-data'] === undefined) throw badInput('需要 --code-data');
        return styles.saveCode({
          kind: KIND,
          group: ctx.group,
          name: ctx.name,
          style: ctx.style || 'default',
          files: { [SLOT]: ctx['code-data'] },
        });
      },
      render: (r) => {
        if (r.status === 'skipped') return `无变化: ${r.group}/${r.name}@${r.style}`;
        return `已保存: ${r.group}/${r.name}@${r.style}（${(r.changed || []).join(', ')}；历史 ${r.historyCount} 条）`;
      },
    },
    {
      id: 'color.list',
      cli: [KIND, 'list'],
      http: ['GET', '/api/color/list'],
      summary: '列出组内所有调色板与色卡',
      args: ['group'],
      run: (ctx) => listGroup(ctx.group),
      render: renderList,
    },
    {
      id: 'color.entry.add',
      cli: [KIND, 'entry', 'add'],
      http: ['POST', '/api/color/entry-add'],
      summary: '向调色板追加一个色（--note 可选，--tags a,b 可选）',
      args: ['group', 'name', 'hex'],
      flags: {
        note: { type: 'string' },
        tags: { type: 'array', hint: 'a,b' },
      },
      run: (ctx) => entryAdd({ group: ctx.group, name: ctx.name, hex: ctx.hex, note: ctx.note, tags: ctx.tags }),
      render: renderEntryAdd,
    },
    {
      id: 'color.entry.rm',
      cli: [KIND, 'entry', 'rm'],
      http: ['POST', '/api/color/entry-rm'],
      summary: '从调色板删除一个色（按 hex；--id 指定时按 id 删）',
      args: ['group', 'name'],
      flags: {
        hex: { type: 'string' },
        id: { type: 'string' },
      },
      run: (ctx) => entryRm({ group: ctx.group, name: ctx.name, hex: ctx.hex, id: ctx.id }),
      render: renderEntryRm,
    },
    {
      id: 'color.export',
      cli: [KIND, 'export'],
      http: ['GET', '/api/color/export'],
      summary: '导出整组调色板（css | json | tailwind | toml）',
      args: ['group'],
      flags: {
        format: { type: 'string', enum: ['css', 'json', 'tailwind', 'toml'], default: 'css' },
      },
      run: (ctx) => exportGroup({ group: ctx.group, format: ctx.format }),
      render: renderExport,
    },
  ];
}
