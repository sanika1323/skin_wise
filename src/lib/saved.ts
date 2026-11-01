import { useEffect, useState } from "react";
import type { CatalogProduct } from "../types";

/** Per-viewer "saved for later" list and dismissed recommendations (browser storage, best-effort). */
const KEY = "skinwise.saved";
const DISMISS = "skinwise.dismissed";
const read = <T,>(k: string, f: T): T => { try { return JSON.parse(localStorage.getItem(k) || "") as T; } catch { return f; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } window.dispatchEvent(new Event("skinwise-saved")); };

export function useSaved() {
  const [saved, setSaved] = useState<CatalogProduct[]>(() => read(KEY, []));
  const [dismissed, setDismissed] = useState<string[]>(() => read(DISMISS, []));
  useEffect(() => {
    const on = () => { setSaved(read(KEY, [])); setDismissed(read(DISMISS, [])); };
    window.addEventListener("skinwise-saved", on);
    return () => window.removeEventListener("skinwise-saved", on);
  }, []);
  return {
    saved,
    dismissed,
    isSaved: (code: string) => saved.some((p) => p.code === code),
    toggle: (p: CatalogProduct) => write(KEY, saved.some((x) => x.code === p.code) ? saved.filter((x) => x.code !== p.code) : [p, ...saved].slice(0, 40)),
    dismiss: (code: string) => write(DISMISS, [...new Set([...dismissed, code])]),
    resetDismissed: () => write(DISMISS, []),
  };
}
