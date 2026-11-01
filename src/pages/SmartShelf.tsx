import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, Bookmark, BookmarkCheck, Camera, CheckCircle2, CircleSlash, Info, Layers, Loader2, Package, Search, ShieldCheck, Sparkles, X } from "lucide-react";
import { useStore } from "../store";
import * as api from "../services/api";
import type { CatalogProduct } from "../types";
import { fmtDate, rankCandidates, type Need, type Ranked } from "../lib/engine";
import { Meter, ProductImage, Ring } from "../components/ui";
import { ProductModal } from "../components/ProductModal";
import { useSaved } from "../lib/saved";

export default function SmartShelf() {
  const s = useStore();
  const { coverage, shelf, profile, latest, routine } = s;
  const assigned = routine ? [...routine.AM.steps, ...routine.PM.steps].filter((x) => x.productId).length : 0;

  const inputs = [
    { label: "Latest assessment", value: latest ? fmtDate(latest.completedAt) : "None yet", ok: Boolean(latest) },
    { label: "Goals & preferences", value: profile?.goals.length ? `${profile.goals.length} goals` : "Not set", ok: Boolean(profile?.goals.length) },
    { label: "Current routine", value: routine && (routine.AM.steps.length || routine.PM.steps.length) ? `${assigned} steps assigned` : "Not built", ok: Boolean(routine?.AM.steps.length) },
    { label: "Owned products", value: `${shelf.length} on shelf`, ok: shelf.length > 0 },
    { label: "Budget", value: profile?.budget != null ? `₹${profile.budget} / product` : "Not set", ok: profile?.budget != null },
  ];

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow"><ShieldCheck size={13} /> Smart Skin-to-Shelf engine</span>
          <h1 className="h1" style={{ marginTop: 10 }}>Skin-to-<span className="grad-text">Shelf.</span></h1>
          <p className="lead">We check what you own before suggesting anything.</p>
        </div>
      </div>

      <div className="card pad-lg">
        <div className="coverage-hero">
          <Ring value={coverage.percent} size={176} stroke={14} label={<span>{coverage.percent}<span style={{ fontSize: 22 }}>%</span></span>} sub="routine covered" />
          <div className="stack" style={{ gap: 18 }}>
            <div>
              <h2 className="h2">{shelf.length === 0 ? "Start with what you already own." : coverage.noPurchaseNeeded ? "Everything your routine needs is already on your shelf." : `${coverage.covered.length} of ${coverage.needs.length} steps covered by products you own.`}</h2>
              <p className="body" style={{ marginTop: 8 }}>{shelf.length === 0 ? "Your shelf is empty, so every step reads as a gap. Add the products you use today first — you may already be covered." : coverage.noPurchaseNeeded ? "No additional purchase is currently identified as necessary. Keep using what you have." : `Genuine gap${coverage.missing.length > 1 ? "s" : ""}: ${coverage.missing.map((m) => m.role.toLowerCase()).join(", ")}.`}</p>
            </div>
            <div className="row-wrap">
              {inputs.map((i) => <span key={i.label} className={`chip static ${i.ok ? "on" : ""}`} title={i.label}>{i.ok ? <CheckCircle2 size={13} /> : <CircleSlash size={13} />}{i.label}: <b style={{ fontWeight: 600 }}>{i.value}</b></span>)}
            </div>
            {!latest && <div className="callout"><Camera size={18} /><div>Run a skin analysis to add focus-area steps. Right now only your core routine{profile?.goals.length ? " and goals are" : " is"} considered. <button className="link" onClick={() => s.go("analysis")}>Analyse →</button></div></div>}
          </div>
        </div>
      </div>

      {coverage.noPurchaseNeeded && shelf.length > 0 && (
        <div className="no-buy">
          <div className="seal"><ShieldCheck size={30} /></div>
          <div style={{ flex: 1 }}>
            <span className="eyebrow" style={{ color: "var(--sage-ink)" }}>No purchase recommended</span>
            <h2 className="h2" style={{ marginTop: 6 }}>You may not need to buy anything.</h2>
            <p className="body" style={{ marginTop: 6 }}>Your {shelf.length} product{shelf.length === 1 ? "" : "s"} cover every step your analysis and goals call for. The smartest skincare purchase is sometimes none at all.</p>
          </div>
          <button className="btn btn-dark" onClick={() => s.go("routine")}>Continue my routine <ArrowRight size={15} /></button>
        </div>
      )}

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="stack">
          <div className="between"><h3 className="h3">Already covered</h3><span className="badge good">{coverage.covered.length}</span></div>
          {coverage.covered.length ? coverage.covered.map(({ need, products }) => (
            <div key={need.category} className="cov-item ok">
              <span className="ci"><CheckCircle2 size={19} /></span>
              <span style={{ minWidth: 0 }}><b>{need.role}</b><small>{products[0].brand} · {products[0].name}{products.length > 1 ? ` (+${products.length - 1} more)` : ""}</small></span>
              <span className="badge good">Owned</span>
            </div>
          )) : <div className="card" style={{ padding: 20 }}><p className="small">Nothing covered yet. <button className="link" onClick={() => s.go("my-products")}>Add products you own →</button></p></div>}
        </div>
        <div className="stack">
          <div className="between"><h3 className="h3">Genuine gaps</h3><span className={`badge ${coverage.missing.length ? "focus" : "good"}`}>{coverage.missing.length}</span></div>
          {coverage.missing.length ? coverage.missing.map((need) => (
            <div key={need.category} className="cov-item gap">
              <span className="ci"><AlertCircle size={19} /></span>
              <span style={{ minWidth: 0 }}><b>{need.role}{need.optional && <span className="badge na" style={{ marginLeft: 8 }}>optional</span>}</b><small title={need.reason}>{need.reason}</small></span>
              <a className="link" href={`#gap-${need.category}`}>Options</a>
            </div>
          )) : <div className="callout sage"><CheckCircle2 size={18} /><div>No gaps. Nothing to recommend.</div></div>}
        </div>
      </div>

      {coverage.missing.map((need) => <GapRecommendations key={need.category} need={need} />)}

      <div className="callout"><Info size={18} /><div><b>How ranking works.</b> Score = 0.35 × goal match + 0.25 × preference fit + 0.20 × budget fit + 0.20 × fills-the-gap. Components without data (e.g. price, which Open Beauty Facts doesn't provide) are left out and the remaining weights are rescaled — never guessed. It's a product-ranking heuristic, not a clinical suitability score.</div></div>
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

  async function load() {
    setState("loading"); setErr("");
    try { setItems(await api.searchCatalog(need.query)); setState("done"); }
    catch (e) { setErr((e as Error).message); setState("error"); }
  }
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [need.query]);

  const owned = useMemo(() => new Set(s.shelf.map((p) => p.code)), [s.shelf]);
  const ranked = useMemo(() => rankCandidates(need, items, s.profile, owned).filter((r) => !saved.dismissed.includes(r.product.code)).slice(0, 3), [need, items, s.profile, owned, saved.dismissed]);

  return (
    <div className="card pad-lg" id={`gap-${need.category}`} style={{ scrollMarginTop: 90 }}>
      <div className="card-head">
        <div>
          <span className="eyebrow"><Layers size={13} /> Gap · {need.category}</span>
          <h3 className="h2" style={{ marginTop: 8 }}>{need.role}</h3>
          <p className="body" style={{ marginTop: 6, maxWidth: 640 }}>{need.reason}{need.keywords.length ? ` Looking for: ${need.keywords.slice(0, 4).join(", ")}.` : ""}</p>
        </div>
        <span className="badge">Searched “{need.query}”</span>
      </div>

      {state === "loading" && <div className="row small" style={{ padding: "20px 0" }}><Loader2 size={16} className="spin" /> Searching the Open Beauty Facts catalog…</div>}
      {state === "error" && <div className="callout rose"><AlertCircle size={18} /><div>{err} <button className="link" onClick={load}>Retry</button></div></div>}
      {state === "done" && ranked.length === 0 && <div className="callout"><Search size={18} /><div>No suitable catalog item was found for this step. We won't invent one. <button className="link" onClick={() => s.go("discover")}>Search manually →</button></div></div>}

      <div className="stack">
        {ranked.map((r) => (
          <div key={r.product.code} className="rec-card">
            <ProductImage src={r.product.imageUrl} alt={r.product.name} />
            <div className="stack-sm" style={{ minWidth: 0 }}>
              <div className="between" style={{ alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}><span className="pbrand">{r.product.brand}</span><h4 className="pname" style={{ fontSize: 15, marginTop: 4 }}>{r.product.name}</h4></div>
                {r.score !== null && <span className="score-pill" title="SkinWise ranking score">{r.score}<small>/100</small></span>}
                {r.score === null && <span className="badge na" title="Not enough catalog data to score fairly">Not scored</span>}
              </div>
              <p className="small" style={{ color: "var(--ink-2)" }}>
                {r.matched.length ? <>Fills your <b>{need.role.toLowerCase()}</b> gap and lists <b>{r.matched.join(", ")}</b>.</> : <>Catalogued for your <b>{need.role.toLowerCase()}</b> gap.{!r.product.ingredients && " Ingredients unavailable — can't check goals or preferences."}</>}
                {r.flags.length > 0 && <span style={{ color: "#9A4F3D" }}> Note: {r.flags.join("; ")}.</span>}
              </p>
              <div className="row-wrap" style={{ alignItems: "center" }}>
                <span className="badge na">Price unavailable</span>
                {!r.product.ingredients && <span className="badge na">Ingredients unavailable</span>}
                <button className="link" style={{ fontSize: 12 }} onClick={() => setOpen(open === r.product.code ? null : r.product.code)}>{open === r.product.code ? "Hide" : "Why this score?"}</button>
              </div>
              {open === r.product.code && (
                <div className="score-break">
                  {r.components.map((c) => (
                    <div key={c.key} className="sb" title={c.note}>
                      <span>{c.label} <span className="muted">×{c.weight}</span></span>
                      {c.value !== null ? <Meter value={c.value} /> : <span className="tiny">{c.note}</span>}
                      <em>{c.value ?? "—"}</em>
                    </div>
                  ))}
                </div>
              )}
              <div className="row-wrap" style={{ marginTop: 4 }}>
                <button className="btn btn-primary btn-sm" onClick={() => setDetail(r)}>Details</button>
                <button className="btn btn-ghost btn-sm" onClick={() => { saved.toggle(r.product); s.toast(saved.isSaved(r.product.code) ? "Removed from saved" : "Saved for later"); }}>{saved.isSaved(r.product.code) ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}{saved.isSaved(r.product.code) ? "Saved" : "Save"}</button>
                <button className="btn btn-sm" style={{ color: "var(--ink-3)" }} onClick={() => saved.dismiss(r.product.code)}><X size={14} /> Dismiss</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {ranked.length > 0 && <p className="tiny" style={{ marginTop: 14 }}><Sparkles size={11} style={{ verticalAlign: "-1px" }} /> Already own something for this step? <button className="link" style={{ fontSize: 11 }} onClick={() => s.go("my-products")}>Add it to your shelf</button> and this gap closes — no purchase needed.</p>}
      {detail && <ProductModal product={detail.product} keywords={need.keywords} defaultCategory={need.category} reason={`Suggested for your ${need.role.toLowerCase()} gap. ${need.reason}`} onClose={() => setDetail(null)} />}
      {state === "idle" && <Package size={0} />}
    </div>
  );
}
