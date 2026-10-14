import { jsx } from "react/jsx-runtime";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { createColorStudioStore } from "../../api/colorStudioStore";
import { subscribeJwtAuth, getJwtAuthSnapshot } from "../../api/authStore";
import { emptyDoc } from "../../api/types";
import {
  ColorStudioContext
} from "./ColorStudioContext";
function isLoggedIn(jwtStatus) {
  return jwtStatus.jwtAuthState === "logged-in";
}
function assertInvariants(doc) {
  const ids = new Set(doc.colorEntries.map((c) => c.id));
  for (const p of doc.palettes) {
    for (const cid of p.colorIds) {
      if (!ids.has(cid)) {
        throw new Error(
          `palette ${p.id} references missing colorEntry ${cid}; document is corrupt`
        );
      }
    }
  }
  if (!doc.palettes.find((p) => p.id === doc.activePaletteId)) {
    throw new Error(`activePaletteId ${doc.activePaletteId} not in palettes`);
  }
}
function ColorStudioProvider({ children }) {
  const [doc, setDocState] = useState(() => emptyDoc());
  const [status, setStatus] = useState("loading");
  const [authState, setAuthState] = useState(
    isLoggedIn(getJwtAuthSnapshot()) ? "logged-in" : "logged-out"
  );
  const storeRef = useRef(createColorStudioStore());
  const saveTimerRef = useRef(null);
  const lastSavedJsonRef = useRef("");
  const forceReload = useCallback(async () => {
    setStatus("loading");
    try {
      const loaded = await storeRef.current.load();
      assertInvariants(loaded);
      setDocState(loaded);
      lastSavedJsonRef.current = JSON.stringify(loaded);
      setStatus("idle");
    } catch {
      setDocState(emptyDoc());
      setStatus("error");
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await storeRef.current.load();
        if (cancelled) return;
        assertInvariants(loaded);
        setDocState(loaded);
        lastSavedJsonRef.current = JSON.stringify(loaded);
        setStatus("idle");
      } catch {
        if (cancelled) return;
        setDocState(emptyDoc());
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    return subscribeJwtAuth(() => {
      setAuthState(isLoggedIn(getJwtAuthSnapshot()) ? "logged-in" : "logged-out");
    });
  }, []);
  const setDoc = useCallback((updater) => {
    setDocState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try {
        assertInvariants(next);
      } catch {
        setStatus("error");
        return prev;
      }
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setStatus("saving");
      saveTimerRef.current = setTimeout(async () => {
        const json = JSON.stringify(next);
        if (json === lastSavedJsonRef.current) {
          setStatus("synced");
          return;
        }
        try {
          await storeRef.current.save(next);
          lastSavedJsonRef.current = json;
          setStatus("synced");
        } catch {
          setStatus("error");
        }
      }, 600);
      return next;
    });
  }, []);
  const value = useMemo(
    () => ({ doc, setDoc, status, authState, forceReload }),
    [doc, setDoc, status, authState, forceReload]
  );
  return /* @__PURE__ */ jsx(ColorStudioContext.Provider, { value, children });
}
export {
  ColorStudioProvider
};
