import { useState } from "react";
import {
  AlertCircle, ArrowRight, Bookmark, BookmarkCheck, Camera, Check, Cloud, Droplets, Eye, FlaskConical, Heart, Info, Loader2,
  Package, Pipette, Plus, Puzzle, ScanFace, Search, ShieldCheck, Smile, Sparkle, Sparkles, Sun, Target, Wallet, Waves, X, type LucideIcon,
} from "lucide-react";
import { useStore } from "../store";
import type { RoutineCategory } from "../types";
import { fmtDate, type Need } from "../lib/engine";
import { Ring, imgSources } from "../components/ui";
import { BudgetBar, CostSummary, RecCard, inr } from "../components/Recs";

const CAT: Record<RoutineCategory, { icon: LucideIcon; g: string; c: string }> = {
  Cleanser: { icon: Droplets, g: "linear-gradient(135deg,#67E8F9,#0EA5E9)", c: "#0EA5E9" },
  Toner: { icon: Waves, g: "linear-gradient(135deg,#5EEAD4,#14B8A6)", c: "#14B8A6" },
  Serum: { icon: Pipette, g: "linear-gradient(135deg,#C4B5FD,#7C3AED)", c: "#7C3AED" },
  Treatment: { icon: FlaskConical, g: "linear-gradient(135deg,#F9A8D4,#DB2777)", c: "#DB2777" },
  Exfoliant: { icon: Sparkle, g: "linear-gradient(135deg,#FDE68A,#F59E0B)", c: "#F59E0B" },
  Moisturizer: { icon: Cloud, g: "linear-gradient(135deg,#A5B4FC,#6366F1)", c: "#6366F1" },
  Sunscreen: { icon: Sun, g: "linear-gradient(135deg,#FCD34D,#F97316)", c: "#F97316" },
  "Eye care": { icon: Eye, g: "linear-gradient(135deg,#DDD6FE,#8B5CF6)", c: "#8B5CF6" },
  Mask: { icon: Smile, g: "linear-gradient(135deg,#FBCFE8,#EC4899)", c: "#EC4899" },
  Other: { icon: Package, g: "linear-gradient(135deg,#CBD5E1,#64748B)", c: "#64748B" },
};
const WEIGHTS = [
  { icon: Target, label: "Skin suitability", w: 50, g: "linear-gradient(135deg,#C4B5FD,#7C3AED)" },
  { icon: Wallet, label: "Value for money", w: 25, g: "linear-gradient(135deg,#FCD34D,#F97316)" },
  { icon: Heart, label: "Trusted brand", w: 25, g: "linear-gradient(135deg,#F9A8D4,#DB2777)" },
];

function SlotImg({ src }: { src?: string | null }) {
  const srcs = imgSources(src); const [i, setI] = useState(0);
  return srcs[i] ? <img src={srcs[i]} alt="" referrerPolicy="no-referrer" onError={() => setI((x) => x + 1)} /> : null;
}

export default function SmartShelf() {
  const s = useStore();
  const { coverage, shelf, profile, latest, routine } = s;
  const assigned = routine ? [...routine.AM.steps, ...routine.PM.steps].filter((x) => x.productId).length : 0;

  const inputs = [
    { icon: ScanFace, label: "AI scan", value: latest ? fmtDate(latest.completedAt, { day: "numeric", month: "short" }) : "None", ok: Boolean(latest) },
    { icon: Target, label: "Goals", value: profile?.goals.length ? String(profile.goals.length) : "—", ok: Boolean(profile?.goals.length) },
    { icon: Sun, label: "Routine", value: routine && (routine.AM.steps.length || routine.PM.steps.length) ? `${assigned} set` : "—", ok: Boolean(routine?.AM.steps.length) },
    { icon: Package, label: "Shelf", value: String(shelf.length), ok: shelf.length > 0 },
    { icon: Wallet, label: "Budget", value: profile?.budget != null ? `₹${profile.budget}` : "—", ok: profile?.budget != null },
  ];

  const slots = coverage.needs.map((need) => ({ need, owned: coverage.covered.find((c) => c.need.category === need.category)?.products[0] || null }));

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <span className="row" style={{ gap: 8 }}><span className="ai-badge"><Sparkles size={11} /> AI engine</span><span className="eyebrow">Skin-to-Shelf</span></span>
          <h1 className="h1" style={{ marginTop: 10 }}>Shop <span className="grad-text">smarter.</span></h1>
          <p className="lead">Your shelf, checked before anything new.</p>
        </div>
      </div>

      {/* HERO: coverage + visual shelf */}
      <div className="shelf-hero">
        <div className="sh-left">
          <div className="sh-ring">
            <Ring value={coverage.percent} size={190} stroke={16} color="#fff" label={<span style={{ color: "#fff", fontSize: 54 }}>{coverage.percent}<span style={{ fontSize: 22 }}>%</span></span>} sub="covered" />
          </div>
          <div className="sh-count">
            <span><b>{coverage.covered.length}</b><small><Check size={12} /> Owned</small></span>
            <i />
            <span><b>{coverage.missing.length}</b><small><Plus size={12} /> Gaps</small></span>
          </div>
        </div>
        <div className="sh-right">
          <h2 className="h2" style={{ color: "#fff" }}>{shelf.length === 0 ? "Add what you own first" : coverage.noPurchaseNeeded ? "Fully covered — no purchase needed" : "Your routine shelf"}</h2>
          <div className="shelf-slots">
            {slots.map(({ need, owned }) => {
              const c = CAT[need.category] || CAT.Other; const I = c.icon;
              return (
                <a key={need.category} href={owned ? undefined : `#gap-${need.category}`} className={`slot ${owned ? "full" : "empty"}`} onClick={owned ? () => s.go("my-products") : undefined} title={owned ? `${owned.brand} ${owned.name}` : need.reason}>
                  <span className="slot-art" style={{ background: owned ? "#fff" : "transparent" }}>
                    {owned ? <SlotImg src={owned.imageUrl} /> : null}
                    <span className="slot-ico" style={{ background: c.g }}><I size={owned?.imageUrl ? 13 : 20} /></span>
                  </span>
                  <b>{need.role}</b>
                  <span className={`slot-tag ${owned ? "ok" : "gap"}`}>{owned ? <><Check size={11} /> Owned</> : <><Plus size={11} /> Gap</>}</span>
                </a>
              );
            })}
          </div>
          <div className="ai-inputs">
            <span className="tiny" style={{ color: "rgba(255,255,255,.75)", fontWeight: 700 }}>AI inputs</span>
            {inputs.map((x) => { const I = x.icon; return (
              <span key={x.label} className={`ai-in ${x.ok ? "ok" : ""}`} title={x.label}><I size={13} />{x.value}</span>
            ); })}
          </div>
        </div>
      </div>

      <div className="shop-bar">
        <BudgetBar />
        {coverage.missing.length > 0 && <CostSummary />}
      </div>

      {!latest && <div className="callout"><Camera size={18} /><div>Run an AI scan to add focus-area steps. <button className="link" onClick={() => s.go("analysis")}>Scan now →</button></div></div>}

      {coverage.noPurchaseNeeded && shelf.length > 0 && (
        <div className="no-buy">
          <div className="seal"><ShieldCheck size={30} /></div>
          <div style={{ flex: 1 }}>
            <span className="eyebrow" style={{ color: "var(--sage-ink)" }}>AI verdict</span>
            <h2 className="h2" style={{ marginTop: 6 }}>You don't need to buy anything.</h2>
          </div>
          <button className="btn btn-dark" onClick={() => s.go("routine")}>My routine <ArrowRight size={15} /></button>
        </div>
      )}

      {coverage.missing.map((need) => <GapRecommendations key={need.category} need={need} />)}

      {/* Ranking formula infographic */}
      <div className="card formula">
        <span className="row" style={{ gap: 10 }}><span className="icon-bubble grad sm"><Sparkles size={15} /></span><b className="h4">How the AI ranks products</b></span>
        <div className="formula-bar">
          {WEIGHTS.map((w) => { const I = w.icon; return (
            <div key={w.label} className="fseg" style={{ flex: w.w, background: w.g }}><I size={16} /><b>{w.w}%</b><small>{w.label}</small></div>
          ); })}
        </div>
        <p className="tiny row" style={{ gap: 6 }}><Info size={12} /> Only in-stock products within your budget · lowest live price via Pricee · nothing is guessed.</p>
      </div>
    </section>
  );
}

function GapRecommendations({ need }: { need: Need }) {
  const s = useStore();
  const c = CAT[need.category] || CAT.Other; const CI = c.icon;
  const r = s.recs?.results?.[need.category];
  const products = r?.products || [];
  const loading = s.recsLoading && !r;
  const err = r?.error || (!r && s.recsError);

  return (
    <div className="gap-block" id={`gap-${need.category}`} style={{ scrollMarginTop: 90 }}>
      <div className="gap-head">
        <span className="gap-ico" style={{ background: c.g }}><CI size={24} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <h3 className="h3">{need.role}</h3>
            <span className="mchip warn"><Plus size={11} /> Gap</span>
            {need.source === "assessment" && <span className="mchip opt"><ScanFace size={11} /> From AI scan</span>}
            {need.source === "goal" && <span className="mchip opt"><Target size={11} /> From goals</span>}
          </div>
          {need.keywords.length > 0 && <div className="meta-chips" style={{ marginTop: 6 }}>{need.keywords.slice(0, 4).map((k) => <span key={k} className="mchip"><FlaskConical size={11} /> {k}</span>)}</div>}
        </div>
        {products[0] && <span className="gap-from">from <b>{inr(Math.min(...products.map((p) => p.price)))}</b></span>}
      </div>

      {loading && <div className="rec-grid">{[0, 1, 2].map((i) => <div key={i} className="pcard"><div className="skeleton" style={{ aspectRatio: "1", margin: 10, borderRadius: 20 }} /><div className="pbody"><div className="skeleton" style={{ height: 14 }} /><div className="skeleton" style={{ height: 22, width: "40%" }} /></div></div>)}</div>}
      {!loading && err && <div className="callout rose"><AlertCircle size={18} /><div>{err} <button className="link" onClick={s.refreshRecs}>Retry</button></div></div>}
      {!loading && !err && r && products.length === 0 && (
        <div className="callout amber"><Wallet size={18} /><div>{(r.totalFound || 0) > 0 && s.budget !== null ? <>No suitable {need.role.toLowerCase()} under {inr(s.budget)}. <button className="link" onClick={() => s.setBudget(null)}>Show any price →</button></> : <>No suitable in-stock product was found for this step right now — we won't show an unrelated one.</>}</div></div>
      )}
      {products.length > 0 && <div className="rec-grid">{products.map((p, i) => <RecCard key={p.id} p={p} rank={i} />)}</div>}
      {products.length > 0 && <button className="tiny link" style={{ fontSize: 12 }} onClick={() => s.go("my-products")}><Package size={12} /> Already own one? Add it to My Products — this gap closes.</button>}
    </div>
  );
}
