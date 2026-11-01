import { useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, Info, Moon, Package, Plus, RefreshCw, Sparkles, Sun, Trash2, Wand2 } from "lucide-react";
import { useStore } from "../store";
import * as api from "../services/api";
import type { RoutineCategory, RoutineStep } from "../types";
import { CATEGORY_HOWTO, ROUTINE_CATEGORIES, categorize, generateRoutine, todayKey } from "../lib/engine";
import { Empty, Ring, Thumb } from "../components/ui";

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

  async function persist(next: { AM?: RoutineStep[]; PM?: RoutineStep[] }, msg?: string) {
    try {
      const saved = await api.saveRoutine({ ...(next.AM ? { AM: { steps: next.AM, updatedAt: null } } : {}), ...(next.PM ? { PM: { steps: next.PM, updatedAt: null } } : {}) });
      s.setRoutine(saved);
      if (msg) s.toast(msg);
    } catch (e) { s.toast((e as Error).message, true); }
  }

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
          <span className="eyebrow"><Sparkles size={13} /> Personalised routine</span>
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
            <div className="between" style={{ flexWrap: "wrap" }}>
              <div className="seg" role="tablist">
                <button role="tab" aria-selected={slot === "AM"} className={slot === "AM" ? "on" : ""} onClick={() => setSlot("AM")}><Sun size={14} /> Morning · {r!.AM.steps.length}</button>
                <button role="tab" aria-selected={slot === "PM"} className={slot === "PM" ? "on" : ""} onClick={() => setSlot("PM")}><Moon size={14} /> Evening · {r!.PM.steps.length}</button>
              </div>
              <span className="small">Tap the circle to mark today's step done</span>
            </div>
            <div className="ritual">
              {steps.map((st, i) => {
                const product = s.shelf.find((p) => p.id === st.productId);
                const isDone = day[slot]?.includes(st.id);
                const expanded = open === st.id;
                const options = s.shelf.filter((p) => categorize(p) === st.category);
                const others = s.shelf.filter((p) => categorize(p) !== st.category);
                return (
                  <div key={st.id} className={`step-card ${isDone ? "done" : ""}`}>
                    <button className="step-check" onClick={() => s.toggleStep(slot, st.id)} aria-label={isDone ? "Mark not done" : "Mark done"} aria-pressed={isDone}><Check size={15} /></button>
                    <div className="step-thumb"><Thumb src={product?.imageUrl} /></div>
                    <div className="step-body">
                      <span className="cat">Step {i + 1} · {st.category}{st.optional ? " · optional" : ""}</span>
                      <h4>{product ? product.name : st.name}</h4>
                      <p>{product ? `${product.brand} · from your shelf` : <span style={{ color: "#9A4F3D" }}>No product assigned{options.length ? "" : " — none on your shelf"}</span>} · {st.frequency}</p>
                    </div>
                    <div className="step-tools">
                      <button className="icon-btn sm ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp size={14} /></button>
                      <button className="icon-btn sm ghost" onClick={() => move(i, 1)} disabled={i === steps.length - 1} aria-label="Move down"><ArrowDown size={14} /></button>
                      <button className="icon-btn sm ghost" onClick={() => setOpen(expanded ? null : st.id)} aria-expanded={expanded} aria-label="Details"><ChevronDown size={15} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform .2s" }} /></button>
                    </div>
                    {expanded && (
                      <div className="step-detail">
                        <div className="why"><Info size={14} /><span><b>Why this step:</b> {st.reason || "Added by you."}</span></div>
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
                <div><span className="eyebrow">Today · {slot === "AM" ? "Morning" : "Evening"}</span><h3 className="h3" style={{ marginTop: 6 }}>{done === steps.length && steps.length ? "Ritual complete ✦" : "Steady, not perfect."}</h3><p className="small" style={{ marginTop: 4 }}>Consistency is logged for your Skin Journey.</p></div>
              </div>
            </div>
            <div className="card">
              <span className="eyebrow">Shelf assignment</span>
              <h3 className="h3" style={{ margin: "8px 0 14px" }}>{[...r!.AM.steps, ...r!.PM.steps].filter((x) => x.productId).length} of {r!.AM.steps.length + r!.PM.steps.length} steps use products you own</h3>
              <p className="body">Unassigned steps are exactly where Skin-to-Shelf will look for a genuine gap — never for duplicates.</p>
              <button className="link" style={{ marginTop: 12 }} onClick={() => s.go("smart-shelf")}>Open Skin-to-Shelf →</button>
            </div>
            <div className="callout"><Info size={18} /><div>Introduce one new product at a time and patch-test actives. This routine is an organisational aid, not a treatment plan.</div></div>
          </div>
        </div>
      )}
    </section>
  );
}
