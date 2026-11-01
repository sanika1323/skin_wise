import { useEffect, useRef, useState } from "react";
import { ArrowUp, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { useStore } from "../store";
import { categorize, displayScore, fmtDate, focusAreas, metricMeta, scoredMetrics, todayKey } from "../lib/engine";

type Msg = { from: "ai" | "me"; text: string; facts?: string[] };
const PROMPTS = ["What is my current skincare priority?", "Do I need to buy anything?", "Why is each step in my routine?", "Do I already own a sunscreen?", "What changed between my last two analyses?", "Show me a lower-cost alternative"];
const CATS: [RegExp, string][] = [[/sunscreen|spf/i, "Sunscreen"], [/cleans/i, "Cleanser"], [/moistur|cream/i, "Moisturizer"], [/serum/i, "Serum"], [/treat|retinol|acid/i, "Treatment"], [/exfol/i, "Exfoliant"], [/eye/i, "Eye care"], [/toner/i, "Toner"]];

export default function Assistant() {
  const s = useStore();
  const name = (s.profile?.name || "").split(" ")[0];
  const [msgs, setMsgs] = useState<Msg[]>(() => [{
    from: "ai",
    text: `Hi${name ? ` ${name}` : ""}. I answer using only what SkinWise has saved for you — your YouCam analyses, your goals, your routine and your shelf. I won't guess scores or diagnose anything.\n\nWhat would you like to know?`,
  }]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, typing]);

  function answer(q: string): Msg {
    const { latest, coverage, routine, shelf, profile, assessments } = s;
    const t = q.toLowerCase();
    if (/(diagnos|rash|infect|pain|bleed|prescri|is (this|it) (acne|rosacea|eczema|psoriasis|melasma)|medical|doctor)/.test(t))
      return { from: "ai", text: "That's a medical question, and I can't diagnose conditions or recommend treatments. SkinWise's analysis is a cosmetic aid. For anything painful, persistent or worrying, please see a dermatologist or doctor." };
    if (/priorit|focus|what should i (work|focus)/.test(t)) {
      const f = focusAreas(latest);
      if (!latest) return { from: "ai", text: "You don't have a completed analysis yet, so I can't point to a measured priority. Your core routine (cleanser, moisturiser, sunscreen) is the right foundation in the meantime.", facts: [profile?.goals.length ? `Your goals: ${profile.goals.join(", ")}` : "No goals set"] };
      return {
        from: "ai",
        text: f.length ? `Your current priority is ${f.map((m) => `${metricMeta(m.type).label.toLowerCase()} (${displayScore(m)}/100)`).join(" and ")} — the lowest scores in your latest analysis.${profile?.goals.length ? ` That lines up with your goal${profile.goals.length > 1 ? "s" : ""}: ${profile.goals.slice(0, 3).join(", ")}.` : ""}` : `Nothing in your latest analysis landed in the focus band (below 65), so there's no stand-out priority. Keep your routine simple and consistent.`,
        facts: [`Analysis · ${fmtDate(latest.completedAt)}`, `${scoredMetrics(latest).length} YouCam metrics`],
      };
    }
    if (/cheap|lower.cost|afford|budget|price/.test(t))
      return { from: "ai", text: `I can't compare prices honestly: Open Beauty Facts doesn't provide reliable prices, and I won't estimate them.${profile?.budget != null ? ` Your stated budget is ₹${profile.budget} per product — check retailer prices against it.` : ""} The cheapest option is often what you already own: your shelf covers ${coverage.percent}% of your routine.`, facts: [`${shelf.length} products on shelf`] };
    const cat = CATS.find(([re]) => re.test(t))?.[1];
    if (cat && /(own|have|already|got)/.test(t)) {
      const owned = shelf.filter((p) => categorize(p) === cat);
      return { from: "ai", text: owned.length ? `Yes — you own ${owned.length} ${cat.toLowerCase()} product${owned.length > 1 ? "s" : ""}: ${owned.map((p) => `${p.brand} ${p.name}`).join("; ")}. No need to buy another for this step.` : `No ${cat.toLowerCase()} on your shelf yet. If your routine calls for one, Skin-to-Shelf will show catalog options for that gap.`, facts: [`Shelf · ${shelf.length} products`] };
    }
    if (/buy|need|purchase|shop|missing|gap/.test(t)) {
      if (!shelf.length) return { from: "ai", text: "Your shelf is empty, so I can't tell what you're missing yet. Add the products you already use first — you may be fully covered." };
      return { from: "ai", text: coverage.noPurchaseNeeded ? `You may not need to buy anything. Your shelf covers all ${coverage.needs.length} steps your routine calls for.` : `You have ${coverage.missing.length} genuine gap${coverage.missing.length > 1 ? "s" : ""}: ${coverage.missing.map((m) => m.role.toLowerCase()).join(", ")}. Everything else (${coverage.covered.map((c) => c.need.role.toLowerCase()).join(", ")}) is already covered by what you own.`, facts: [`Coverage ${coverage.percent}%`, latest ? `Analysis · ${fmtDate(latest.completedAt)}` : "No analysis yet", `${profile?.goals.length || 0} goals`] };
    }
    if (/why|reason|step|routine/.test(t)) {
      const steps = [...(routine?.AM.steps || []).map((x) => ({ ...x, t: "AM" })), ...(routine?.PM.steps || []).map((x) => ({ ...x, t: "PM" }))];
      if (!steps.length) return { from: "ai", text: "You haven't built a routine yet. Open My Routine and generate one — each step will come with its reason." };
      const focus = cat ? steps.filter((x) => x.category === cat) : steps;
      const list = (focus.length ? focus : steps).slice(0, 6).map((x) => `• ${x.t} ${x.category}: ${x.reason || "added by you"}`).join("\n");
      const day = routine?.logs?.[todayKey()];
      return { from: "ai", text: `Here's why each step is there:\n${list}`, facts: [`${steps.length} steps total`, `Today: ${(day?.AM.length || 0) + (day?.PM.length || 0)} logged`] };
    }
    if (/chang|compar|progress|last two|differen|improv/.test(t)) {
      const done = assessments.filter((a) => a.status === "completed");
      if (done.length < 2) return { from: "ai", text: `You have ${done.length} completed analysis${done.length === 1 ? "" : "es"}. I need two to compare — and I'll only compare metrics both readings returned.` };
      const [a, b] = done;
      const rows = scoredMetrics(a).flatMap((m) => { const p = b.results.find((x) => x.type === m.type); const pv = p ? displayScore(p) : null; const cv = displayScore(m); return pv !== null && cv !== null ? [`• ${metricMeta(m.type).label}: ${pv} → ${cv} (${cv - pv >= 0 ? "+" : ""}${cv - pv})`] : []; });
      return { from: "ai", text: rows.length ? `Between ${fmtDate(b.completedAt)} and ${fmtDate(a.completedAt)}:\n${rows.join("\n")}\n\nLighting and camera differences can explain small shifts, and I can't say any product caused them.` : "Your last two analyses don't share any metrics, so there's no fair comparison.", facts: ["Compatible metrics only"] };
    }
    if (/shelf|products|own/.test(t))
      return { from: "ai", text: shelf.length ? `You have ${shelf.length} product${shelf.length > 1 ? "s" : ""}: ${shelf.slice(0, 6).map((p) => `${p.brand} ${p.name} (${categorize(p)})`).join("; ")}${shelf.length > 6 ? "…" : ""}.` : "Your shelf is empty right now." };
    return { from: "ai", text: "I can help with your current priority, whether you need to buy anything, why a routine step exists, whether you already own a product type, or what changed between analyses. Try one of the suggestions below." };
  }

  function send(text = input) {
    const q = text.trim(); if (!q) return;
    setMsgs((m) => [...m, { from: "me", text: q }]); setInput(""); setTyping(true);
    window.setTimeout(() => { setMsgs((m) => [...m, answer(q)]); setTyping(false); }, 650);
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow"><MessageCircle size={13} /> SkinWise assistant</span>
          <h1 className="h1" style={{ marginTop: 10 }}>Ask your <span className="grad-text">skin coach.</span></h1>
          <p className="lead">Answers from your own scans, routine and shelf.</p>
        </div>
      </div>
      <div className="split">
        <div className="card flush chat">
          <div className="chat-scroll">
            {msgs.map((m, i) => (
              <div key={i} className={`bubble-row ${m.from === "me" ? "me" : ""}`}>
                {m.from === "ai" && <span className="ai-avatar"><Sparkles size={14} /></span>}
                <div className={`bubble ${m.from}`}>{m.text}{m.facts && <div className="facts">{m.facts.map((f) => <span key={f}>✦ Based on: {f}</span>)}</div>}</div>
              </div>
            ))}
            {typing && <div className="bubble-row"><span className="ai-avatar"><Sparkles size={14} /></span><div className="bubble ai"><span className="typing"><i /><i /><i /></span></div></div>}
            <div ref={end} />
          </div>
          <div className="composer">
            <div className="filters">{PROMPTS.map((p) => <button key={p} className="chip" style={{ flexShrink: 0 }} onClick={() => send(p)}>{p}</button>)}</div>
            <form className="composer-box" onSubmit={(e) => { e.preventDefault(); send(); }}>
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about your routine, shelf or analysis…" aria-label="Message" />
              <button className="icon-btn" style={{ background: "var(--plum)", color: "#fff", borderColor: "var(--plum)" }} type="submit" aria-label="Send"><ArrowUp size={17} /></button>
            </form>
          </div>
        </div>
        <div className="stack">
          <div className="card tint-lav">
            <span className="eyebrow">Context in use</span>
            <div className="stack-sm" style={{ marginTop: 14 }}>
              <div className="kv"><span>Latest analysis</span><b>{s.latest ? fmtDate(s.latest.completedAt) : "None"}</b></div>
              <div className="kv"><span>Goals</span><b>{s.profile?.goals.length ? s.profile.goals.slice(0, 3).join(", ") : "None set"}</b></div>
              <div className="kv"><span>Routine steps</span><b>{(s.routine?.AM.steps.length || 0) + (s.routine?.PM.steps.length || 0)}</b></div>
              <div className="kv"><span>Shelf</span><b>{s.shelf.length} products · {s.coverage.percent}% coverage</b></div>
            </div>
          </div>
          <div className="callout"><ShieldCheck size={18} /><div>This assistant is rule-based and runs on SkinWise's saved data only — no external model, no invented metrics, no efficacy claims.</div></div>
        </div>
      </div>
    </section>
  );
}
