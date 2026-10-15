import { parseUserInput } from "./colorMath";
const WEIGHT_DEFAULT = 1;
const WEIGHT_MIN = 0;
const WEIGHT_MAX = 100;
function unescapeBasicString(s) {
  return s.replace(/\\(["\\nrt])/g, (_match, ch) => {
    switch (ch) {
      case "n":
        return "\n";
      case "r":
        return "\r";
      case "t":
        return "	";
      default:
        return ch;
    }
  });
}
function parseStringArray(raw) {
  const s = raw.trim();
  if (!s.startsWith("[") || !s.endsWith("]")) return null;
  const inner = s.slice(1, -1).trim();
  if (inner === "") return [];
  const out = [];
  const re = /"((?:\\.|[^"\\])*)"/g;
  let m;
  while ((m = re.exec(inner)) !== null) {
    out.push(unescapeBasicString(m[1]));
  }
  const stripped = inner.replace(/"(?:\\.|[^"\\])*"/g, "").replace(/[,\s]/g, "");
  if (stripped !== "") return null;
  return out;
}
function parseWeight(raw) {
  const s = raw.trim();
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (n < WEIGHT_MIN || n > WEIGHT_MAX) return null;
  return n;
}
function parseColorImportToml(toml) {
  const palettes = [];
  const errors = [];
  const lines = toml.split("\n");
  let currentPalette = null;
  let inColors = false;
  let pendingHex = null;
  let pendingWeight = null;
  let pendingNote = null;
  let pendingTags = null;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    if (line === "[[palettes]]") {
      if (currentPalette) finalizePalette();
      currentPalette = { name: "", colors: [] };
      inColors = false;
      continue;
    }
    if (line === "[[palettes.colors]]") {
      inColors = true;
      resetPending();
      continue;
    }
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) {
      errors.push(`\u7B2C ${i + 1} \u884C: \u65E0\u6CD5\u89E3\u6790 "${raw}"`);
      continue;
    }
    const key = line.slice(0, eqIdx).trim();
    const valRaw = line.slice(eqIdx + 1).trim();
    const val = valRaw.startsWith('"') && valRaw.endsWith('"') ? unescapeBasicString(valRaw.slice(1, -1)) : valRaw;
    if (inColors && currentPalette) {
      if (key === "hex") {
        pendingHex = val;
      } else if (key === "weight") {
        if (currentPalette.colors.length > 0) {
          currentPalette.colors[currentPalette.colors.length - 1].weight = val;
        } else {
          pendingWeight = val;
        }
      } else if (key === "note") {
        if (currentPalette.colors.length > 0) {
          currentPalette.colors[currentPalette.colors.length - 1].note = val;
        } else {
          pendingNote = val;
        }
      } else if (key === "tags") {
        const arr = parseStringArray(valRaw);
        if (arr === null) {
          errors.push(`\u7B2C ${i + 1} \u884C: tags \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\u6570\u7EC4 ["a", "b"]`);
        } else if (currentPalette.colors.length > 0) {
          currentPalette.colors[currentPalette.colors.length - 1].tags = arr;
        } else {
          pendingTags = arr;
        }
      } else {
        errors.push(`\u7B2C ${i + 1} \u884C: \u672A\u77E5\u5B57\u6BB5 "${key}"`);
      }
      if (key === "hex" && currentPalette) {
        flushColor(currentPalette);
      }
    } else if (!inColors && currentPalette) {
      if (key === "name") currentPalette.name = val;
      else errors.push(`\u7B2C ${i + 1} \u884C: \u672A\u77E5\u5B57\u6BB5 "${key}"`);
    } else {
      errors.push(`\u7B2C ${i + 1} \u884C: \u4E0D\u5728\u4EFB\u4F55\u8868\u5934\u4E0B\u7684\u5B57\u6BB5 "${key}"`);
    }
  }
  if (currentPalette) finalizePalette();
  function resetPending() {
    pendingHex = null;
    pendingWeight = null;
    pendingNote = null;
    pendingTags = null;
  }
  function flushColor(palette) {
    if (pendingHex === null) return;
    const hex = pendingHex;
    const note = pendingNote ?? "";
    const tags = pendingTags ?? [];
    const weightRaw = pendingWeight ?? String(WEIGHT_DEFAULT);
    resetPending();
    palette.colors.push({ hex, weight: weightRaw, note, tags });
  }
  function finalizePalette() {
    if (!currentPalette) return;
    const name = currentPalette.name.trim();
    if (!name) {
      errors.push("\u8C03\u8272\u677F\u7F3A\u5C11 name \u5B57\u6BB5,\u5DF2\u8DF3\u8FC7");
      currentPalette = null;
      inColors = false;
      return;
    }
    const colors = [];
    for (const c of currentPalette.colors) {
      if (!c.hex) continue;
      const hex = resolveHex(c.hex);
      if (!hex) {
        errors.push(`\u8C03\u8272\u677F "${name}" \xB7 \u989C\u8272 "${c.hex}": \u65E0\u6CD5\u8BC6\u522B\u7684\u989C\u8272\u503C,\u5DF2\u8DF3\u8FC7`);
        continue;
      }
      const weight = parseWeight(c.weight);
      if (weight === null) {
        errors.push(`\u8C03\u8272\u677F "${name}" \xB7 ${hex}: weight \u5FC5\u987B\u4E3A 0-100 \u7684\u6570\u5B57,\u5DF2\u56DE\u843D\u5230 1`);
      }
      colors.push({ hex, weight: weight ?? WEIGHT_DEFAULT, note: c.note, tags: c.tags });
    }
    palettes.push({ name, colors });
    currentPalette = null;
    inColors = false;
  }
  return { palettes, errors };
}
function resolveHex(raw) {
  const hex = parseUserInput(raw);
  return hex ? hex.toUpperCase() : null;
}
export {
  parseColorImportToml
};
