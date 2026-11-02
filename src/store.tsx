import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as api from "./services/api";
import type { Assessment, Profile, RecResponse, Recommendation, Routine, RoutineCategory, ShelfProduct } from "./types";
import { computeCoverage, deriveNeeds, latestCompleted, todayKey, type Coverage, type Need } from "./lib/engine";

export type Page = "overview" | "analysis" | "profile" | "routine" | "smart-shelf" | "discover" | "my-products" | "journey" | "assistant" | "settings";
type Toast = { id: number; text: string; error?: boolean };

type Store = {
  page: Page; go: (p: Page) => void;
  ready: boolean; offline: boolean;
  providerReady: boolean | null;
  profile: Profile | null; shelf: ShelfProduct[]; routine: Routine | null; assessments: Assessment[];
  latest: Assessment | null; needs: Need[]; coverage: Coverage;
  recs: RecResponse | null; recsLoading: boolean; recsError: string; refreshRecs: () => void;
  picksFor: (category: RoutineCategory) => Recommendation[];
  budget: number | null; setBudget: (b: number | null) => Promise<void>;
  toasts: Toast[]; toast: (text: string, error?: boolean) => void;
  reload: () => Promise<void>;
  setAssessments: (fn: (a: Assessment[]) => Assessment[]) => void;
  setShelf: (fn: (s: ShelfProduct[]) => ShelfProduct[]) => void;
  setRoutine: (r: Routine) => void;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  removeProduct: (p: ShelfProduct) => Promise<void>;
  toggleStep: (type: "AM" | "PM", stepId: string) => Promise<void>;
};

const Ctx = createContext<Store | null>(null);
export const useStore = () => { const s = useContext(Ctx); if (!s) throw new Error("Store missing"); return s; };

const PAGES: Page[] = ["overview", "analysis", "profile", "routine", "smart-shelf", "discover", "my-products", "journey", "assistant", "settings"];
const pageFromHash = (): Page => { const h = window.location.hash.replace("#/", "") as Page; return PAGES.includes(h) ? h : "overview"; };

export function StoreProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<Page>(pageFromHash);
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);
  const [providerReady, setProviderReady] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [shelf, setShelfState] = useState<ShelfProduct[]>([]);
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [assessments, setAssessmentsState] = useState<Assessment[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((text: string, error?: boolean) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, error }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const go = useCallback((p: Page) => {
    setPage(p);
    if (window.location.hash !== `#/${p}`) window.history.pushState(null, "", `#/${p}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  useEffect(() => { const on = () => setPage(pageFromHash()); window.addEventListener("popstate", on); return () => window.removeEventListener("popstate", on); }, []);

  const reload = useCallback(async () => {
    const results = await Promise.allSettled([api.getHealth(), api.getProfile(), api.getShelf(), api.getRoutine(), api.getAssessmentHistory()]);
    const [h, p, s, r, a] = results;
    setOffline(results.every((x) => x.status === "rejected"));
    if (h.status === "fulfilled") setProviderReady(h.value.youcamConfigured);
    if (p.status === "fulfilled") setProfile(p.value);
    if (s.status === "fulfilled") setShelfState(s.value);
    if (r.status === "fulfilled") setRoutine(r.value);
    if (a.status === "fulfilled") setAssessmentsState(a.value);
    setReady(true);
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  const latest = useMemo(() => latestCompleted(assessments), [assessments]);
  const needs = useMemo(() => deriveNeeds(profile, latest), [profile, latest]);
  const coverage = useMemo(() => computeCoverage(needs, shelf), [needs, shelf]);

  /* ---- AI recommendations: every routine step that has no owned product gets real, priced picks ---- */
  const [recs, setRecs] = useState<RecResponse | null>(null);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsError, setRecsError] = useState("");
  const [recsNonce, setRecsNonce] = useState(0);
  const budget = profile?.budget ?? null;
  const recNeeds = useMemo(() => {
    const list = coverage.missing.map((n) => ({ category: n.category, role: n.role, reason: n.reason, source: n.source, keywords: n.keywords }));
    const steps = routine ? [...routine.AM.steps, ...routine.PM.steps] : [];
    for (const st of steps) {
      if (st.productId && shelf.some((p) => p.id === st.productId)) continue;
      if (st.category === "Other" || list.some((n) => n.category === st.category)) continue;
      const need = needs.find((n) => n.category === st.category);
      list.push({ category: st.category, role: need?.role || st.name, reason: need?.reason || st.reason, source: need?.source || "core", keywords: need?.keywords || [] });
    }
    return list;
  }, [coverage.missing, routine, shelf, needs]);
  const recKey = JSON.stringify([recNeeds, budget, recsNonce]);
  useEffect(() => {
    if (!ready || offline) return;
    if (!recNeeds.length) { setRecs(null); setRecsError(""); return; }
    let alive = true;
    const t = window.setTimeout(async () => {
      setRecsLoading(true); setRecsError("");
      try { const r = await api.getRecommendations(recNeeds, budget); if (alive) setRecs(r); }
      catch (e) { if (alive) setRecsError((e as Error).message); }
      finally { if (alive) setRecsLoading(false); }
    }, 350);
    return () => { alive = false; window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recKey, ready, offline]);
  const picksFor = useCallback((c: RoutineCategory) => recs?.results?.[c]?.products || [], [recs]);

  const updateProfile = useCallback(async (patch: Partial<Profile>) => {
    try { setProfile(await api.saveProfile(patch)); toast("Profile saved"); }
    catch (e) { toast((e as Error).message, true); }
  }, [toast]);

  const removeProduct = useCallback(async (p: ShelfProduct) => {
    const usedIn = routine ? [...routine.AM.steps, ...routine.PM.steps].filter((s) => s.productId === p.id).length : 0;
    try {
      await api.removeShelfProduct(p.id);
      setShelfState((s) => s.filter((x) => x.id !== p.id));
      if (usedIn) { setRoutine(await api.getRoutine()); toast(`Removed. ${usedIn} routine step${usedIn > 1 ? "s are" : " is"} now unassigned — pick a replacement in My Routine.`); }
      else toast(`${p.name} removed from your shelf`);
    } catch (e) { toast((e as Error).message, true); }
  }, [routine, toast]);

  const toggleStep = useCallback(async (type: "AM" | "PM", stepId: string) => {
    if (!routine) return;
    const day = todayKey();
    const done = !(routine.logs?.[day]?.[type] || []).includes(stepId);
    // optimistic
    setRoutine({ ...routine, logs: { ...routine.logs, [day]: { AM: routine.logs?.[day]?.AM || [], PM: routine.logs?.[day]?.PM || [], [type]: done ? [...(routine.logs?.[day]?.[type] || []), stepId] : (routine.logs?.[day]?.[type] || []).filter((x) => x !== stepId) } } });
    try { setRoutine(await api.logRoutineStep(day, type, stepId, done)); }
    catch (e) { toast((e as Error).message, true); }
  }, [routine, toast]);

  const value: Store = {
    page, go, ready, offline, providerReady, profile, shelf, routine, assessments, latest, needs, coverage, toasts, toast, reload,
    setAssessments: (fn) => setAssessmentsState(fn), setShelf: (fn) => setShelfState(fn), setRoutine,
    updateProfile, removeProduct, toggleStep,
    recs, recsLoading, recsError, refreshRecs: () => setRecsNonce((n) => n + 1), picksFor,
    budget, setBudget: async (b) => { try { setProfile(await api.saveProfile({ budget: b })); } catch (e) { toast((e as Error).message, true); } },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
