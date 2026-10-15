function slug(s) {
  return s.trim().toLowerCase().replace(/[^a-z0-9一-龥]+/g, "-").replace(/^-+|-+$/g, "") || "palette";
}
function paletteEntries(doc, palette) {
  return palette.colorIds.map((cid) => doc.colorEntries.find((c) => c.id === cid)).filter((c) => !!c);
}
function exportCssVars(doc) {
  const lines = ["/* Color Studio 导出 \u2014 CSS Variables */", ":root {"];
  for (const p of doc.palettes) {
    const key = slug(p.name);
    paletteEntries(doc, p).forEach((e, i) => {
      lines.push(`  --color-${key}-${i}: ${e.hex};`);
    });
  }
  lines.push("}");
  return lines.join("\n");
}
function exportTailwind(doc) {
  const lines = [
    "// Color Studio 导出 \u2014 Tailwind config",
    "// \u7528\u6CD5:tailwind.config.js \u91CC require/extend",
    "module.exports = {",
    "  theme: {",
    "    extend: {",
    "      colors: {"
  ];
  for (const p of doc.palettes) {
    const key = slug(p.name);
    lines.push(`        '${key}': {`);
    paletteEntries(doc, p).forEach((e, i) => {
      lines.push(`          '${i}': '${e.hex}',`);
    });
    lines.push("        },");
  }
  lines.push("      },");
  lines.push("    },");
  lines.push("  },");
  lines.push("};");
  return lines.join("\n");
}
function exportDesignTokens(doc) {
  const tree = {};
  for (const p of doc.palettes) {
    const key = slug(p.name);
    const inner = {};
    paletteEntries(doc, p).forEach((e, i) => {
      inner[String(i)] = { $type: "color", $value: e.hex };
    });
    tree[key] = inner;
  }
  return JSON.stringify(
    { $schema: "https://design-tokens.org/schema.json", color: tree },
    null,
    2
  );
}
function exportJson(doc) {
  return JSON.stringify(doc, null, 2);
}
function exportToml(doc) {
  const lines = ["# Color Studio 导出 \u2014 TOML"];
  for (const p of doc.palettes) {
    lines.push("");
    lines.push("[[palettes]]");
    lines.push(`name = "${escapeToml(p.name)}"`);
    paletteEntries(doc, p).forEach((e) => {
      lines.push("");
      lines.push("[[palettes.colors]]");
      lines.push(`hex = "${e.hex}"`);
      lines.push(`weight = ${e.weight}`);
      if (e.note) lines.push(`note = "${escapeToml(e.note)}"`);
      if (e.tags.length > 0) {
        lines.push(`tags = [${e.tags.map((t) => `"${escapeToml(t)}"`).join(", ")}]`);
      }
    });
  }
  return lines.join("\n");
}
function escapeToml(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
const EXPORT_FORMATS = [
  { value: "css-vars", label: "CSS Variables", ext: "css" },
  { value: "tailwind", label: "Tailwind", ext: "js" },
  { value: "design-tokens", label: "Design Tokens", ext: "tokens.json" },
  { value: "toml", label: "TOML \u5BFC\u5165\u683C\u5F0F", ext: "toml" },
  { value: "json", label: "JSON \u6587\u6863", ext: "json" }
];
function exportDoc(doc, format) {
  switch (format) {
    case "css-vars":
      return exportCssVars(doc);
    case "tailwind":
      return exportTailwind(doc);
    case "design-tokens":
      return exportDesignTokens(doc);
    case "toml":
      return exportToml(doc);
    case "json":
      return exportJson(doc);
  }
}
export {
  EXPORT_FORMATS,
  exportCssVars,
  exportDesignTokens,
  exportDoc,
  exportJson,
  exportTailwind,
  exportToml
};
