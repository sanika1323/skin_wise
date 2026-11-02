import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, ArrowRight, Bookmark, BookmarkCheck, Camera, Check, Cloud, Droplets, Eye, FlaskConical, Heart, Info, Loader2,
  Package, Pipette, Plus, Puzzle, ScanFace, Search, ShieldCheck, Smile, Sparkle, Sparkles, Sun, Target, Wallet, Waves, X, type LucideIcon,
} from "lucide-react";
import { useStore } from "../store";
import * as api from "../services/api";
import type { CatalogProduct, RoutineCategory } from "../types";
import { fmtDate, rankCandidates, type Need, type Ranked } from "../lib/engine";
import { Meter, ProductImage, Ring, imgSources } from "../components/ui";
import { ProductModal } from "../components/ProductModal";
import { useSaved } from "../lib/saved";

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
  { icon: Target, label: "Goal match", w: 35, g: "linear-gradient(135deg,#C4B5FD,#7C3AED)" },
  { icon: Heart, label: "Preferences", w: 25, g: "linear-gradient(135deg,#F9A8D4,#DB2777)" },
  { icon: Wallet, label: "Budget", w: 20, g: "linear-gradient(135deg,#FCD34D,#F97316)" },
  { icon: Puzzle, label: "Fills gap", w: 20, g: "linear-gradient(135deg,#5EEAD4,#0EA5E9)" },
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
        <p className="tiny row" style={{ gap: 6 }}><Info size={12} /> Missing data (e.g. price) is skipped, never guessed.</p>
      </div>
    </section>
  );
}

function GapRecommendations({ need }: { need: Need }) {
  const s = useStore();
  const saved = useSaved();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [items, setItems] = useState<CatalogProduct[]>([]);
  const [err, setErr] = useState("");
  const [detail, setDetail] = useState<Ranked | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const c = CAT[need.category] || CAT.Other; const CI = c.icon;

  async function load() {
    setState("loading"); setErr("");
    try { setItems(await api.searchCatalog(need.query)); setState("done"); }
    catch (e) { setErr((e as Error).message); setState("error"); }
  }
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [need.query]);

  const owned = useMemo(() => new Set(s.shelf.map((p) => p.code)), [s.shelf]);
  const ranked = useMemo(() => rankCandidates(need, items, s.profile, owned).filter((r) => !saved.dismissed.includes(r.product.code)).slice(0, 3), [need, items, s.profile, owned, saved.dismissed]);

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
      </div>

      {state === "loading" && <div className="rec-grid">{[0, 1, 2].map((i) => <div key={i} className="pcard"><div className="skeleton" style={{ aspectRatio: "1", margin: 10, borderRadius: 20 }} /><div className="pbody"><div className="skeleton" style={{ height: 14 }} /></div></div>)}</div>}
      {state === "error" && <div className="callout rose"><AlertCircle size={18} /><div>{err} <button className="link" onClick={load}>Retry</button></div></div>}
      {state === "done" && ranked.length === 0 && <div className="callout"><Search size={18} /><div>No matching catalog item — we won't invent one. <button className="link" onClick={() => s.go("discover")}>Search →</button></div></div>}

      {ranked.length > 0 && (
        <div className="rec-grid">
          {ranked.map((r, idx) => (
            <article key={r.product.code} className="pcard rec3">
              <ProductImage src={r.product.imageUrl} alt={r.product.name}>
                <div className="corner">
                  {idx === 0 ? <span className="ai-badge"><Sparkles size={11} /> Top match</span> : <span />}
                  <button className="heart-btn" onClick={() => { saved.toggle(r.product); s.toast(saved.isSaved(r.product.code) ? "Removed from saved" : "Saved for later"); }} aria-label="Save">{saved.isSaved(r.product.code) ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}</button>
                </div>
                <div className="score-orb">{r.score !== null ? <Ring value={r.score} size={58} stroke={6} label={<span style={{ fontSize: 15 }}>{r.score}</span>} /> : <span className="badge na">Not scored</span>}</div>
              </ProductImage>
              <div className="pbody">
                <span className="pbrand">{r.product.brand}</span>
                <h4 className="pname">{r.product.name}</h4>
                <div className="meta-chips">
                  {r.matched.slice(0, 3).map((m) => <span key={m} className="mchip ok"><Check size={11} /> {m}</span>)}
                  {r.flags.length > 0 && <span className="mchip warn"><AlertCircle size={11} /> {r.flags[0]}</span>}
                  {!r.product.ingredients && <span className="mchip">No ingredients</span>}
                  <span className="mchip"><Wallet size={11} /> No price</span>
                </div>
                {open === r.product.code && (
                  <div className="score-break" style={{ marginTop: 8 }}>
                    {r.components.map((comp) => (
                      <div key={comp.key} className="sb" title={comp.note}>
                        <span>{comp.label}</span>
                        {comp.value !== null ? <Meter value={comp.value} /> : <span className="tiny">n/a</span>}
                        <em>{comp.value ?? "—"}</em>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="pfoot">
                <button className="btn btn-primary btn-sm" onClick={() => setDetail(r)}>Details</button>
                <button className="icon-btn sm" onClick={() => setOpen(open === r.product.code ? null : r.product.code)} aria-label="Why this score" title="Why this score?"><Info size={14} /></button>
                <button className="icon-btn sm" onClick={() => saved.dismiss(r.product.code)} aria-label="Dismiss" title="Dismiss"><X size={14} /></button>
              </div>
            </article>
          ))}
        </div>
      )}
      {ranked.length > 0 && <button className="tiny link" style={{ fontSize: 12 }} onClick={() => s.go("my-products")}><Package size={12} /> Already own one? Add it — gap closes.</button>}
      {detail && <ProductModal product={detail.product} keywords={need.keywords} defaultCategory={need.category} reason={`Suggested for your ${need.role.toLowerCase()} gap. ${need.reason}`} onClose={() => setDetail(null)} />}
    </div>
  );
}
