import { useCallback, useEffect, useRef, useState } from "react";
import {
  createShortcutPrefsStore,
  defaultShortcutPrefs,
  COPY_FORMATS
} from "../../api/createShortcutPrefsStore";
const ACTION_LABELS = {
  eyedropper: "\u5C4F\u5E55\u53D6\u8272",
  addColor: "\u52A0\u5165\u5F53\u524D\u8272",
  copy: "\u590D\u5236 hex",
  clearHistory: "\u6E05\u7A7A\u5386\u53F2"
};
function shortcutActionLabel(action) {
  return ACTION_LABELS[action];
}
function useShortcutPrefs() {
  const [prefs, setPrefs] = useState(defaultShortcutPrefs());
  const [ready, setReady] = useState(false);
  const storeRef = useRef(createShortcutPrefsStore());
  const timerRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await storeRef.current.load();
      if (!cancelled) {
        setPrefs(loaded);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const persist = useCallback((next) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      storeRef.current.save(next).catch(() => void 0);
    }, 600);
  }, []);
  const setKey = useCallback((action, rawKey) => {
    const key = rawKey.toLowerCase();
    if (!/^[a-z]$/.test(key)) return "\u4EC5\u652F\u6301\u5355\u5B57\u6BCD\u952E";
    const conflict = Object.keys(prefs.shortcuts).find((a) => a !== action && prefs.shortcuts[a] === key);
    if (conflict) return shortcutActionLabel(conflict);
    const next = {
      ...prefs,
      shortcuts: { ...prefs.shortcuts, [action]: key },
      updatedAt: Date.now()
    };
    setPrefs(next);
    persist(next);
    return null;
  }, [prefs, persist]);
  const setCopyFormat = useCallback((format) => {
    setPrefs((prev) => {
      const next = { ...prev, preferredCopyFormat: format, updatedAt: Date.now() };
      persist(next);
      return next;
    });
  }, [persist]);
  const resetAll = useCallback(() => {
    const next = defaultShortcutPrefs();
    setPrefs(next);
    persist(next);
  }, [persist]);
  return { prefs, ready, setKey, setCopyFormat, resetAll };
}
export {
  COPY_FORMATS,
  shortcutActionLabel,
  useShortcutPrefs
};
