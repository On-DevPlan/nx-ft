const KEY = "nx-ft:color-studio:shortcut-prefs";
const DEFAULT_SHORTCUTS = { eyedropper: "p", addColor: "a", copy: "c", clearHistory: "x" };
const DEFAULT = {
  schemaVersion: "1.0.0",
  shortcuts: { ...DEFAULT_SHORTCUTS },
  preferredCopyFormat: "hex",
  updatedAt: 0,
};
export const COPY_FORMATS = ["hex", "rgb", "hsl", "lab", "lch", "oklch"];

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT, shortcuts: { ...DEFAULT_SHORTCUTS } };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT, ...parsed, shortcuts: { ...DEFAULT_SHORTCUTS, ...(parsed.shortcuts || {}) } };
  } catch {
    return { ...DEFAULT, shortcuts: { ...DEFAULT_SHORTCUTS } };
  }
}
function defaultShortcutPrefs() {
  return { ...DEFAULT, shortcuts: { ...DEFAULT_SHORTCUTS } };
}
let timer = null;
let pending = null;
function save(prefs) {
  pending = prefs;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...pending, updatedAt: Date.now() }));
    } catch {
    }
  }, 600);
}
function createShortcutPrefsStore() {
  let current = load();
  const subs = /* @__PURE__ */ new Set();
  const notify = () => {
    for (const cb of subs) cb(current);
  };
  return {
    load: () => current,
    save: (next) => {
      current = next;
      save(next);
      notify();
    },
    subscribe: (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
  };
}
export {
  createShortcutPrefsStore,
  defaultShortcutPrefs,
  DEFAULT_SHORTCUTS,
};
