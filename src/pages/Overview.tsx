import { useState } from "react";
import { ArrowRight, Calendar, Camera, Check, ChevronRight, Package, ScanFace, ShieldCheck, Sparkles, Sun, Moon, UserRound, ShoppingBag } from "lucide-react";
import { useStore } from "../store";
import { Empty, ProductImage, Ring, RingTile, Skeleton } from "../components/ui";
import { averageScore, categorize, fmtDate, greeting, metricMeta, focusAreas, scoredMetrics, todayKey } from "../lib/engine";

// Decorative editorial portrait (not the user). Falls back to a soft gradient orb if it can't load.
const HERO_PHOTO = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=1100&q=85";

export default function Overview() {
  const s = useStore();
  const { latest, coverage, routine, shelf, profile } = s;
  const [photoOk, setPhotoOk] = useState(true);
  const processing = s.assessments.find((a) => a.status === "processing");
  const avg = averageScore(latest);
  const focus = focusAreas(latest);
  const day = routine?.logs?.[todayKey()] || { AM: [], PM: [] };
  const hasRoutine = Boolean(routine && (routine.AM.steps.length || routine.PM.steps.length));
  const slot: "AM" | "PM" = new Date().getHours() < 15 ? "AM" : "PM";
  const steps = routine?.[slot].steps || [];
  const doneCount = steps.filter((x) => day[slot]?.includes(x.id)).length;
  const routinePct = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;
  const firstName = (profile?.name || "").split(" ")[0];

  const journey = [
    { n: 1, t: "Analyze", icon: ScanFace, done: Boolean(latest), go: "analysis" as const },
    { n: 2, t: "Profile", icon: UserRound, done: Boolean(profile?.goals.length), go: "profile" as const },
    { n: 3, t: "Routine", icon: Sun, done: hasRoutine, go: "routine" as const },
    { n: 4, t: "Shelf check", icon: ShieldCheck, done: coverage.noPurchaseNeeded && shelf.length > 0, go: "smart-shelf" as const },
  ];
  const next = journey.find((j) => !j.done);

  return (
    <section className="page">
      {/* HERO */}
      <div className="hero2">
        <div className="hero2-copy">
          <div className="row-wrap" style={{ alignItems: "center" }}><span className="hello-chip"><i><Sparkles size={14} /></i>{greeting()}{firstName ? `, ${firstName}` : ""}</span><span className="ai-badge lg"><Sparkles size={13} /> AI-powered skin coach</span></div>
          <h1 className="display">Your skin,<br />thoughtfully <span className="grad-text underline-swash">cared.</span></h1>
          <p>{latest ? (focus.length ? `Today's focus: ${focus.map((f) => metricMeta(f.type).label.toLowerCase()).join(" & ")}.` : "Your latest read looks steady.") : "AI skin analysis that checks your shelf before you shop."}</p>
          <div className="row-wrap">
            {processing ? (
              <button className="btn btn-primary btn-lg" onClick={() => s.go("analysis")}><span className="dot warn" /> Analysis running</button>
            ) : !latest ? (
              <button className="btn btn-primary btn-lg" onClick={() => s.go("analysis")}><Camera size={17} /> Analyze my skin</button>
            ) : (
              <button className="btn btn-primary btn-lg" onClick={() => s.go(next?.go || "routine")}>{next ? `Next: ${next.t}` : "Today's routine"} <ArrowRight size={17} /></button>
            )}
            {latest && <button className="btn btn-ghost btn-lg" onClick={() => s.go("analysis")}><ScanFace size={17} /> Rescan</button>}
          </div>
        </div>
        <div className="hero2-visual" aria-hidden="true">
          <div className="hero2-photo">
            {photoOk ? <img src={HERO_PHOTO} alt="" onError={() => setPhotoOk(false)} /> : <div className="hero2-fallback" />}
            <div className="tint" />
          </div>
          <span className="orbit-line" style={{ width: 120, height: 120, left: "14%", top: "14%" }} />
          <Sparkles className="sparkle" size={26} style={{ left: "22%", top: "16%" }} />
          <Sparkles className="sparkle" size={18} style={{ right: "14%", top: "40%", animationDelay: "1.2s" }} />
          <Sparkles className="sparkle" size={14} style={{ left: "40%", bottom: "18%", animationDelay: "2s" }} />
          <div className="glass-chip" style={{ left: "6%", bottom: "16%" }}>
            <span className="gi"><ScanFace size={19} /></span>
            <span><b>{avg ?? "Ready"}{avg !== null && <span style={{ fontSize: 11, color: "var(--ink-3)" }}> /100</span>}</b><small>{latest ? "AI skin score" : "AI skin scan"}</small></span>
          </div>
          <div className="glass-chip" style={{ right: "6%", top: "12%", animationDelay: "1.6s" }}>
            <Ring value={hasRoutine ? routinePct : 0} size={44} stroke={5} label={<span style={{ fontSize: 11 }}>{hasRoutine ? `${routinePct}%` : "—"}</span>} />
            <span><b>Routine</b><small>{hasRoutine ? `${doneCount}/${steps.length} today` : "Not built"}</small></span>
          </div>
        </div>
      </div>

      {/* JOURNEY */}
      <div className="journey-strip" role="list">
        {journey.map((j) => { const I = j.icon; return (
          <button key={j.n} role="listitem" className={`journey-step ${j.done ? "done" : ""}`} onClick={() => s.go(j.go)} style={{ alignItems: "center" }}>
            <span className="n">{j.done ? <Check size={14} /> : <I size={14} />}</span>
            <span><b>{j.t}</b></span>
            <ChevronRight size={16} style={{ marginLeft: "auto", color: "var(--violet-300)" }} />
          </button>
        ); })}
      </div>

      {/* SKIN OVERVIEW */}
      <div className="stack">
        <div className="between">
          <h2 className="h2 row" style={{ fontSize: 22, gap: 10 }}>Skin overview <span className="ai-badge"><Sparkles size={11} /> AI</span></h2>
          {latest && <button className="link" onClick={() => s.go("profile")}>{fmtDate(latest.completedAt, { day: "numeric", month: "short" })} <ChevronRight size={15} /></button>}
        </div>
        {!s.ready ? <Skeleton h={170} r={24} /> : latest ? (
          <div className="ring-row">
            {avg !== null && (
              <div className="ring-tile overall">
                <span className="rt-head"><span className="rt-ico" style={{ background: "rgba(255,255,255,.22)", boxShadow: "none" }}><Sparkles size={16} /></span><span className="rt-label" style={{ color: "#fff" }}>AI Score</span></span>
                <Ring value={avg} size={96} stroke={9} color="#fff" label={<span className="rt-num" style={{ color: "#fff" }}>{avg}</span>} />
                <span className="rt-pill" style={{ background: "rgba(255,255,255,.22)", color: "#fff" }}><ScanFace size={12} /> {scoredMetrics(latest).length} metrics</span>
              </div>
            )}
            {scoredMetrics(latest).map((m) => <RingTile key={m.type} m={m} onClick={() => s.go("profile")} />)}
          </div>
        ) : (
          <Empty icon={<ScanFace size={30} />} title="No skin scan yet" body="One selfie. Real YouCam scores in under a minute." action={<button className="btn btn-primary" onClick={() => s.go("analysis")}><Camera size={15} /> Start scan</button>} />
        )}
      </div>

      {/* ROUTINE + SHELF */}
      <div className="grid-2">
        <button className="card lift" style={{ textAlign: "left", display: "flex", alignItems: "center", gap: 18 }} onClick={() => s.go("routine")}>
          <span className="icon-bubble grad"><Calendar size={20} /></span>
          <span style={{ flex: 1 }}>
            <b className="h3" style={{ display: "block" }}>Daily routine</b>
            <span className="small" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>{slot === "AM" ? <Sun size={13} /> : <Moon size={13} />}{hasRoutine ? `${doneCount} of ${steps.length} ${slot === "AM" ? "morning" : "evening"} steps` : "Build in one tap"}</span>
          </span>
          <Ring value={hasRoutine ? routinePct : 0} size={68} stroke={7} label={<span style={{ fontSize: 15 }}>{hasRoutine ? `${routinePct}%` : "+"}</span>} />
        </button>
        <button className="card lift" style={{ textAlign: "left", display: "flex", alignItems: "center", gap: 18 }} onClick={() => s.go(shelf.length ? "smart-shelf" : "my-products")}>
          <span className="icon-bubble pink"><ShieldCheck size={20} /></span>
          <span style={{ flex: 1 }}>
            <b className="h3" style={{ display: "block" }}>{shelf.length === 0 ? "Add your shelf" : coverage.noPurchaseNeeded ? "Nothing to buy" : `${coverage.missing.length} real gap${coverage.missing.length === 1 ? "" : "s"}`}</b>
            <span className="small" style={{ display: "block", marginTop: 4 }}>Skin-to-Shelf coverage</span>
          </span>
          <Ring value={coverage.percent} size={68} stroke={7} label={<span style={{ fontSize: 15 }}>{coverage.percent}%</span>} />
        </button>
      </div>

      {/* FOR YOU */}
      <div className="stack">
        <div className="between">
          <h2 className="h2" style={{ fontSize: 22 }}>For you</h2>
          <button className="link" onClick={() => s.go(coverage.missing.length ? "smart-shelf" : "my-products")}>View more <ChevronRight size={15} /></button>
        </div>
        <div className="carousel">
          {coverage.missing.map((n) => { const pick = s.picksFor(n.category)[0]; return (
            <button key={n.category} className="foryou" onClick={() => s.go("smart-shelf")}>
              <span>
                <span className="icon-bubble grad sm" style={{ marginBottom: 12 }}><ShoppingBag size={15} /></span>
                <b>{n.role}</b>
                <small>{pick ? `AI pick from ₹${pick.price.toLocaleString("en-IN")}` : n.source === "assessment" ? "From your AI scan" : n.source === "goal" ? "From your goals" : "Core step"}</small>
              </span>
              {pick ? <ProductImage src={pick.image} alt={pick.name} bubbles /> : <span className="fab-plus"><ArrowRight size={16} /></span>}
            </button>
          ); })}
          {shelf.slice(0, 6).map((p) => (
            <button key={p.id} className="foryou" onClick={() => s.go("my-products")}>
              <span>
                <span className="badge good" style={{ marginBottom: 10 }}><Check size={11} /> Owned</span>
                <b style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.name}</b>
                <small>{categorize(p)} · {p.brand}</small>
              </span>
              <ProductImage src={p.imageUrl} alt={p.name} bubbles />
            </button>
          ))}
          {coverage.missing.length === 0 && shelf.length === 0 && (
            <button className="foryou" onClick={() => s.go("my-products")}>
              <span><span className="icon-bubble grad sm" style={{ marginBottom: 12 }}><Package size={15} /></span><b>Add what you own</b><small>Barcode-verified shelf</small></span>
              <span className="fab-plus"><ArrowRight size={16} /></span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
