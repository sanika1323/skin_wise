import { useState } from "react";
import { ShoppingCart, ArrowDown, ArrowUp, Check, ChevronDown, Clock, Cloud, Droplets, Eye, FlaskConical, Flame, Info, Moon, Package, Pipette, Plus, RefreshCw, ShieldCheck, Smile, Sparkle, Sparkles, Sun, Trash2, Wand2, Waves, type LucideIcon } from "lucide-react";
import { useStore } from "../store";
import * as api from "../services/api";
import type { RoutineCategory, RoutineStep } from "../types";
import { CATEGORY_HOWTO, ROUTINE_CATEGORIES, categorize, generateRoutine, todayKey } from "../lib/engine";
import { Empty, Ring, imgSources } from "../components/ui";
import { BudgetBar, CostSummary, RecCard, inr } from "../components/Recs";
import { useEffect, useRef } from "react";

const CAT: Record<RoutineCategory, { icon: LucideIcon; g: string }> = {
  Cleanser: { icon: Droplets, g: "linear-gradient(135deg,#67E8F9,#0EA5E9)" },
  Toner: { icon: Waves, g: "linear-gradient(135deg,#5EEAD4,#14B8A6)" },
  Serum: { icon: Pipette, g: "linear-gradient(135deg,#C4B5FD,#7C3AED)" },
  Treatment: { icon: FlaskConical, g: "linear-gradient(135deg,#F9A8D4,#DB2777)" },
  Exfoliant: { icon: Sparkle, g: "linear-gradient(135deg,#FDE68A,#F59E0B)" },
  Moisturizer: { icon: Cloud, g: "linear-gradient(135deg,#A5B4FC,#6366F1)" },
  Sunscreen: { icon: Sun, g: "linear-gradient(135deg,#FCD34D,#F97316)" },
  "Eye care": { icon: Eye, g: "linear-gradient(135deg,#DDD6FE,#8B5CF6)" },
  Mask: { icon: Smile, g: "linear-gradient(135deg,#FBCFE8,#EC4899)" },
  Other: { icon: Package, g: "linear-gradient(135deg,#CBD5E1,#64748B)" },
};

function CatIcon({ cat, src }: { cat: RoutineCategory; src?: string | null }) {
  const c = CAT[cat] || CAT.Other; const I = c.icon;
  const [i, setI] = useState(0); const srcs = imgSources(src);
  return (
    <div className="cat-ico" style={{ background: c.g }}>
      {srcs[i] ? <><img src={srcs[i]} alt="" referrerPolicy="no-referrer" onError={() => setI((x) => x + 1)} /><span className="mini" style={{ background: c.g }}><I size={12} /></span></> : <I size={22} />}
    </div>
  );
}

export default function RoutinePage() {
  const s = useStore();
  const [slot, setSlot] = useState<"AM" | "PM">(new Date().getHours() < 15 ? "AM" : "PM");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addCat, setAddCat] = useState<RoutineCategory>("Serum");
  const r = s.routine;
  const steps = r?.[slot].steps || [];
  const day = r?.logs?.[todayKey()] || { AM: [], PM: [] };
  const has = Boolean(r && (r.AM.steps.length || r.PM.steps.length));
  const done = steps.filter((x) => day[slot]?.includes(x.id)).length;
  const slotStat = (t: "AM" | "PM") => { const n = r?.[t].steps.length || 0; const d = (r?.[t].steps || []).filter((x) => day[t]?.includes(x.id)).length; return { n, d, pct: n ? Math.round((d / n) * 100) : 0 }; };
  const streak = (() => { let n = 0; const d = new Date(); for (let k = 0; k < 120; k++) { const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; const l = r?.logs?.[key]; if (l && (l.AM.length || l.PM.length)) n++; else if (k > 0) break; d.setDate(d.getDate() - 1); } return n; })();

  async function persist(next: { AM?: RoutineStep[]; PM?: RoutineStep[] }, msg?: string) {
    try {
      const saved = await api.saveRoutine({ ...(next.AM ? { AM: { steps: next.AM, updatedAt: null } } : {}), ...(next.PM ? { PM: { steps: next.PM, updatedAt: null } } : {}) });
      s.setRoutine(saved);
      if (msg) s.toast(msg);
    } catch (e) { s.toast((e as Error).message, true); }
  }

  // First visit with no routine: build one automatically (never overwrites an existing routine).
  const autoBuilt = useRef(false);
  useEffect(() => {
    if (!s.ready || !r || has || autoBuilt.current) return;
    autoBuilt.current = true;
    void persist(generateRoutine(s.needs, s.shelf), "AI routine built from your scan, goals and shelf");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.ready, r, has]);

  async function generate() {
    if (has && !window.confirm("Replace your current AM and PM routine with a freshly generated one? Your edits will be lost.")) return;
    setBusy(true);
    const g = generateRoutine(s.needs, s.shelf);
    await persist(g, "Routine generated from your analysis, goals and shelf");
    setBusy(false);
  }

  const update = (id: string, patch: Partial<RoutineStep>) => persist({ [slot]: steps.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  const move = (i: number, d: -1 | 1) => { const a = [...steps]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; void persist({ [slot]: a }); };
  const remove = (id: string) => persist({ [slot]: steps.filter((x) => x.id !== id) }, "Step removed");
  const add = () => {
    const owned = s.shelf.find((p) => categorize(p) === addCat);
    const step: RoutineStep = { id: `${slot}-${addCat}-${Date.now()}`.toLowerCase().replace(/\s+/g, "-"), productId: owned?.id ?? null, category: addCat, name: addCat, instructions: CATEGORY_HOWTO[addCat], frequency: "Daily", reason: "Added by you.", optional: true, sortOrder: steps.length };
    void persist({ [slot]: [...steps, step] }, `${addCat} added to your ${slot === "AM" ? "morning" : "evening"}`);
  };

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <span className="row" style={{ gap: 8 }}><span className="ai-badge"><Sparkles size={11} /> AI-curated</span><span className="eyebrow">Personalised routine</span></span>
          <h1 className="h1" style={{ marginTop: 10 }}>Daily <span className="grad-text">ritual.</span></h1>
          <p className="lead">Built from your scan, goals and shelf.</p>
        </div>
        {has && <button className="btn btn-ghost" onClick={generate} disabled={busy}><RefreshCw size={15} className={busy ? "spin" : ""} /> Regenerate</button>}
      </div>

      {!has ? (
        <Empty icon={<Wand2 size={28} />} title="Let's build your routine" body={s.latest ? "We'll arrange cleanser, moisturiser and sunscreen as your core, then add up to three optional steps tied to your focus areas and goals — assigning products you already own where they fit." : "You can build a core routine now, or run a skin analysis first so optional steps reflect your real focus areas."} action={<div className="row-wrap" style={{ justifyContent: "center" }}><button className="btn btn-primary" onClick={generate} disabled={busy}><Wand2 size={15} /> Generate my routine</button>{!s.latest && <button className="btn btn-ghost" onClick={() => s.go("analysis")}>Analyse first</button>}</div>} />
      ) : (
        <div className="split">
          <div className="stack">
            <div className="slot-tiles" role="tablist">
              {(["AM", "PM"] as const).map((t) => { const st = slotStat(t); return (
                <button key={t} role="tab" aria-selected={slot === t} className={`slot-tile ${t.toLowerCase()} ${slot === t ? "on" : ""}`} onClick={() => setSlot(t)}>
                  <span className="big-ico">{t === "AM" ? <Sun size={26} /> : <Moon size={26} />}</span>
                  <span><b>{t === "AM" ? "Morning" : "Evening"}</b><small><Sparkles size={12} /> {st.n} steps</small></span>
                  <Ring value={st.pct} size={56} stroke={6} label={<span style={{ fontSize: 13 }}>{st.d}/{st.n}</span>} />
                </button>
              ); })}
            </div>
            <div className="ritual v3">
              {steps.map((st, i) => {
                const product = s.shelf.find((p) => p.id === st.productId);
                const picks = product ? [] : s.picksFor(st.category);
                const pick = picks[0];
                const isDone = day[slot]?.includes(st.id);
                const expanded = open === st.id;
                const options = s.shelf.filter((p) => categorize(p) === st.category);
                const others = s.shelf.filter((p) => categorize(p) !== st.category);
                return (
                  <div key={st.id} className={`step-card ${isDone ? "done" : ""}`}>
                    <button className="step-check" onClick={() => s.toggleStep(slot, st.id)} aria-label={isDone ? "Mark not done" : "Mark done"} aria-pressed={isDone}><Check size={15} /></button>
                    <div style={{ position: "relative" }}><span className="step-num">{i + 1}</span><CatIcon cat={st.category} src={product?.imageUrl || pick?.image} /></div>
                    <div className="step-body">
                      <span className="cat">{st.category}</span>
                      <h4 title={pick?.fullTitle}>{product ? product.name : pick ? (pick.name.toLowerCase().startsWith(pick.brand.toLowerCase().split(' ')[0]) ? pick.name : `${pick.brand} · ${pick.name}`) : st.name}</h4>
                      <div className="meta-chips">
                        {product ? <span className="mchip ok"><Package size={11} /> Owned</span> : pick ? <><span className="mchip opt"><Sparkles size={11} /> AI pick · not owned</span><span className="mchip price">{inr(pick.price)} · {pick.retailer}</span></> : s.recsLoading ? <span className="mchip">Finding AI pick…</span> : <span className="mchip warn"><Package size={11} /> Not assigned</span>}
                        <span className="mchip"><Clock size={11} /> {st.frequency}</span>
                        {st.optional && <span className="mchip opt"><Sparkle size={11} /> Optional</span>}
                      </div>
                    </div>
                    <div className="step-tools">
                      {pick?.link && <a className="btn btn-primary btn-sm" href={pick.link} target="_blank" rel="noopener noreferrer" title={`Buy on ${pick.retailer}`}><ShoppingCart size={13} /> Buy</a>}
                      <button className="icon-btn sm ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp size={14} /></button>
                      <button className="icon-btn sm ghost" onClick={() => move(i, 1)} disabled={i === steps.length - 1} aria-label="Move down"><ArrowDown size={14} /></button>
                      <button className="icon-btn sm ghost" onClick={() => setOpen(expanded ? null : st.id)} aria-expanded={expanded} aria-label="Details"><ChevronDown size={15} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform .2s" }} /></button>
                    </div>
                    {expanded && (
                      <div className="step-detail">
                        <div className="why"><Info size={14} /><span><b>Why this step:</b> {st.reason || "Added by you."}</span></div>
                        {picks.length > 0 && <div className="rec-grid compact">{picks.map((p, k) => <RecCard key={p.id} p={p} rank={k} compact />)}</div>}
                        <p className="small" style={{ color: "var(--ink-2)" }}>{st.instructions}</p>
                        <div className="grid-2" style={{ gap: 10 }}>
                          <label className="field"><span>Assigned product</span>
                            <select className="select" value={st.productId || ""} onChange={(e) => update(st.id, { productId: e.target.value || null })}>
                              <option value="">Unassigned</option>
                              {options.length > 0 && <optgroup label={`${st.category} on your shelf`}>{options.map((p) => <option key={p.id} value={p.id}>{p.brand} — {p.name}</option>)}</optgroup>}
                              {others.length > 0 && <optgroup label="Other shelf products">{others.map((p) => <option key={p.id} value={p.id}>{p.brand} — {p.name}</option>)}</optgroup>}
                            </select>
                          </label>
                          <label className="field"><span>Frequency</span>
                            <select className="select" value={st.frequency} onChange={(e) => update(st.id, { frequency: e.target.value })}>{["Daily", "Every other day", "2–3× weekly", "Weekly", "As needed"].map((f) => <option key={f}>{f}</option>)}</select>
                          </label>
                        </div>
                        <div className="between">
                          <label className="row small" style={{ gap: 10, cursor: "pointer" }}><input type="checkbox" className="switch" checked={st.optional} onChange={(e) => update(st.id, { optional: e.target.checked })} /> Optional step</label>
                          <div className="row" style={{ gap: 8 }}>
                            {!product && <button className="btn btn-soft btn-sm" onClick={() => s.go("smart-shelf")}>Find a product</button>}
                            <button className="btn btn-danger btn-sm" onClick={() => remove(st.id)}><Trash2 size={13} /> Remove</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {steps.length === 0 && <div className="card empty" style={{ padding: 32 }}><p className="body">No {slot === "AM" ? "morning" : "evening"} steps yet.</p></div>}
            </div>
            <div className="row" style={{ gap: 10 }}>
              <select className="select" style={{ width: 200 }} value={addCat} onChange={(e) => setAddCat(e.target.value as RoutineCategory)} aria-label="Step category">{ROUTINE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
              <button className="btn btn-ghost" onClick={add}><Plus size={15} /> Add step</button>
            </div>
          </div>

          <div className="stack">
            <div className="card tint-lav">
              <div className="progress-orb">
                <Ring value={steps.length ? Math.round((done / steps.length) * 100) : 0} size={96} stroke={9} label={<span style={{ fontSize: 22 }}>{done}/{steps.length}</span>} />
                <div><span className="eyebrow">Today · {slot === "AM" ? "Morning" : "Evening"}</span><h3 className="h3" style={{ marginTop: 6 }}>{done === steps.length && steps.length ? "Ritual complete" : "Keep going"}</h3><p className="small row" style={{ marginTop: 4, gap: 6 }}><Check size={13} /> Tap circles to log</p></div>
              </div>
            </div>
            <div className="card stack" style={{ gap: 14 }}>
              <BudgetBar />
              <CostSummary />
            </div>
            <div className="card streak">
              <span className="big-ico"><Flame size={26} /></span>
              <div><div className="stat-num">{streak}<span style={{ fontSize: 14, color: "var(--ink-3)", marginLeft: 6 }}>day{streak === 1 ? "" : "s"}</span></div><span className="small">Routine streak</span></div>
            </div>
            <button className="card lift streak" style={{ textAlign: "left" }} onClick={() => s.go("smart-shelf")}>
              <span className="big-ico" style={{ background: "var(--grad)", boxShadow: "0 12px 24px -10px rgba(124,58,237,.8)" }}><ShieldCheck size={26} /></span>
              <div style={{ flex: 1 }}><div className="stat-num">{[...r!.AM.steps, ...r!.PM.steps].filter((x) => x.productId).length}<span style={{ fontSize: 14, color: "var(--ink-3)", marginLeft: 4 }}>/ {r!.AM.steps.length + r!.PM.steps.length}</span></div><span className="small">Steps using products you own</span></div>
              <ArrowUp size={16} style={{ transform: "rotate(45deg)", color: "var(--plum)" }} />
            </button>
            <p className="tiny row" style={{ gap: 6 }}><Info size={12} /> Patch-test new actives · not a treatment plan</p>
          </div>
        </div>
      )}
    </section>
  );
}
