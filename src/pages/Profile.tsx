import { useEffect, useState } from "react";
import { ArrowRight, Camera, Check, Pencil, Plus, Save, X } from "lucide-react";
import { useStore } from "../store";
import type { Profile } from "../types";
import { Empty, Meter, Source } from "../components/ui";
import { SUMMARY_TYPES, band, displayScore, fmtDate, metricMeta } from "../lib/engine";

const GOALS = ["Deeper hydration", "Calm redness", "Smoother texture", "Refine pores", "Clearer skin", "Balance oil", "Brighter glow", "Even tone", "Soften fine lines", "Brighter eyes", "Strengthen barrier"];
const SKIN_TYPES = ["Not sure", "Normal", "Dry", "Oily", "Combination", "Sensitive"];
const SENS = ["Low", "Moderate", "High"];

export default function ProfilePage() {
  const s = useStore();
  const [draft, setDraft] = useState<Profile | null>(s.profile);
  const [edit, setEdit] = useState(false);
  const [custom, setCustom] = useState("");
  const [avoid, setAvoid] = useState("");
  useEffect(() => { setDraft(s.profile); setAvoid((s.profile?.avoidIngredients || []).join(", ")); }, [s.profile]);
  const p = draft;
  const set = (patch: Partial<Profile>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const initials = (p?.name || "You").split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase();
  const latest = s.latest;
  const skinTypeResult = latest?.results.find((m) => m.type === "skin_type");

  async function save() {
    if (!p) return;
    await s.updateProfile({ name: p.name, skinType: p.skinType, sensitivity: p.sensitivity, goals: p.goals, preferences: p.preferences, budget: p.budget, avoidIngredients: avoid.split(",").map((x) => x.trim()).filter(Boolean) });
    setEdit(false);
  }

  if (!p) return <section className="page"><div className="card skeleton" style={{ height: 300 }} /></section>;

  return (
    <section className="page">
      <div className="card pad-lg tint-lav">
        <div className="between" style={{ flexWrap: "wrap", gap: 20 }}>
          <div className="profile-hero">
            <span className="avatar">{initials}</span>
            <div>
              <span className="eyebrow">Skin profile</span>
              <h1 className="h1" style={{ marginTop: 6 }}>{p.name || "Your skin profile"}</h1>
              <p className="small" style={{ marginTop: 6 }}>{latest ? <>Connected assessment · <b>{fmtDate(latest.completedAt)}</b> · {latest.results.length} YouCam measurements</> : "No assessment connected yet"}</p>
            </div>
          </div>
          {edit ? (
            <div className="row"><button className="btn btn-ghost" onClick={() => { setDraft(s.profile); setEdit(false); }}>Cancel</button><button className="btn btn-primary" onClick={save}><Save size={15} /> Save profile</button></div>
          ) : <button className="btn btn-ghost" onClick={() => setEdit(true)}><Pencil size={14} /> Edit goals & preferences</button>}
        </div>
      </div>

      <div className="grid-3" style={{ alignItems: "start" }}>
        {/* 1. AI observations */}
        <div className="source-col">
          <Source kind="ai" />
          {latest ? (
            <div className="card stack">
              <div><h3 className="h3">What YouCam observed</h3><p className="small" style={{ marginTop: 4 }}>Read-only. A new analysis creates a new record.</p></div>
              {latest.results.filter((m) => m.type !== "skin_type" && !SUMMARY_TYPES.has(m.type)).map((m) => {
                const v = displayScore(m); const meta = metricMeta(m.type);
                return (
                  <div className="metric-mini" key={m.type}>
                    <div className="between"><span>{meta.label}</span><span className="row" style={{ gap: 8 }}><span className={`badge ${band(v).tone}`}>{band(v).label}</span><b>{v ?? "—"}</b></span></div>
                    {v !== null && <Meter value={v} color={`linear-gradient(90deg, ${meta.hue}88, ${meta.hue})`} />}
                  </div>
                );
              })}
              {skinTypeResult && <div className="kv"><span>Skin type (YouCam)</span><b>{Object.values(skinTypeResult.extra || {}).filter((x) => typeof x === "string").join(", ") || (displayScore(skinTypeResult) ?? "Returned without a label")}</b></div>}
              <button className="link" onClick={() => s.go("journey")}>Compare over time <ArrowRight size={14} /></button>
            </div>
          ) : <Empty icon={<Camera size={24} />} title="Nothing observed yet" body="Run a skin analysis to add provider-measured observations." action={<button className="btn btn-primary btn-sm" onClick={() => s.go("analysis")}>Analyse my skin</button>} />}
        </div>

        {/* 2. Self-reported */}
        <div className="source-col">
          <Source kind="user" />
          <div className="card stack" style={{ gap: 18 }}>
            <div><h3 className="h3">What you told us</h3><p className="small" style={{ marginTop: 4 }}>Editable any time. Never overwritten by an analysis.</p></div>
            {edit ? (
              <>
                <label className="field"><span>Name</span><input className="input" value={p.name} onChange={(e) => set({ name: e.target.value })} placeholder="How should we greet you?" /></label>
                <div className="grid-2" style={{ gap: 12 }}>
                  <label className="field"><span>Skin type</span><select className="select" value={p.skinType} onChange={(e) => set({ skinType: e.target.value })}><option value="">Select</option>{SKIN_TYPES.map((x) => <option key={x}>{x}</option>)}</select></label>
                  <label className="field"><span>Sensitivity</span><select className="select" value={p.sensitivity} onChange={(e) => set({ sensitivity: e.target.value })}><option value="">Select</option>{SENS.map((x) => <option key={x}>{x}</option>)}</select></label>
                </div>
                <div className="field"><span>Goals</span>
                  <div className="row-wrap">
                    {[...new Set([...GOALS, ...p.goals])].map((g) => { const on = p.goals.includes(g); return <button key={g} className={`chip ${on ? "on" : ""}`} onClick={() => set({ goals: on ? p.goals.filter((x) => x !== g) : [...p.goals, g] })}>{on && <Check size={12} />}{g}</button>; })}
                  </div>
                  <div className="input-group" style={{ marginTop: 6 }}><input className="input" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add your own goal" onKeyDown={(e) => { if (e.key === "Enter" && custom.trim()) { set({ goals: [...p.goals, custom.trim()] }); setCustom(""); } }} /><button className="icon-btn" onClick={() => { if (custom.trim()) { set({ goals: [...p.goals, custom.trim()] }); setCustom(""); } }} aria-label="Add goal"><Plus size={16} /></button></div>
                </div>
                <div className="field"><span>Preferences</span>
                  {([["fragranceFree", "Prefer fragrance-free"], ["nonComedogenic", "Prefer non-comedogenic"], ["minimalRoutine", "Keep my routine minimal"]] as const).map(([k, label]) => (
                    <label key={k} className="between" style={{ fontSize: 13.5, padding: "6px 0" }}>{label}<input type="checkbox" className="switch" checked={Boolean(p.preferences[k])} onChange={(e) => set({ preferences: { ...p.preferences, [k]: e.target.checked } })} /></label>
                  ))}
                </div>
                <label className="field"><span>Ingredients to avoid</span><input className="input" value={avoid} onChange={(e) => setAvoid(e.target.value)} placeholder="e.g. alcohol denat, essential oil" /></label>
                <label className="field"><span>Budget per product (₹)</span><input className="input" type="number" min={0} value={p.budget ?? ""} onChange={(e) => set({ budget: e.target.value === "" ? null : Number(e.target.value) })} placeholder="Optional" /></label>
              </>
            ) : (
              <>
                <div className="kv"><span>Skin type</span><b>{p.skinType || <span className="muted">Not set</span>}</b></div>
                <div className="kv"><span>Sensitivity</span><b>{p.sensitivity || <span className="muted">Not set</span>}</b></div>
                <div className="kv"><span>Goals</span>{p.goals.length ? <div className="row-wrap" style={{ marginTop: 6 }}>{p.goals.map((g) => <span key={g} className="chip static on">{g}</span>)}</div> : <b className="muted">No goals yet</b>}</div>
                <div className="kv"><span>Preferences</span><b>{[p.preferences.fragranceFree && "Fragrance-free", p.preferences.nonComedogenic && "Non-comedogenic", p.preferences.minimalRoutine && "Minimal routine"].filter(Boolean).join(" · ") || <span className="muted">None</span>}</b></div>
                <div className="kv"><span>Avoid</span><b>{p.avoidIngredients.join(", ") || <span className="muted">Nothing listed</span>}</b></div>
                <div className="kv"><span>Budget per product</span><b>{p.budget !== null ? `₹${p.budget}` : <span className="muted">Not set</span>}</b></div>
                {!p.goals.length && <button className="btn btn-soft btn-sm" onClick={() => setEdit(true)}>Add goals</button>}
              </>
            )}
          </div>
        </div>

        {/* 3. Derived */}
        <div className="source-col">
          <Source kind="derived" />
          <div className="card tint-sage stack">
            <div><h3 className="h3">Your routine priorities</h3><p className="small" style={{ marginTop: 4 }}>Recomputed from the two columns on the left. Suggestions, not prescriptions.</p></div>
            {s.needs.map((n) => (
              <div key={n.category} className="kv">
                <span className="row" style={{ gap: 8 }}>{n.role}{n.optional ? <span className="badge na">optional</span> : <span className="badge good">core</span>}</span>
                <b style={{ fontWeight: 400, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>{n.reason}</b>
              </div>
            ))}
            <button className="btn btn-primary btn-sm" onClick={() => s.go("routine")}>Turn into a routine <ArrowRight size={14} /></button>
          </div>
          {edit && <button className="btn btn-ghost btn-sm" onClick={() => { setDraft(s.profile); setEdit(false); }}><X size={13} /> Discard changes</button>}
        </div>
      </div>
    </section>
  );
}
