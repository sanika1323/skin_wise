import { useState } from "react";
import { BadgePercent, Check, ExternalLink, Loader2, RefreshCw, ShoppingCart, Sparkles, Store, Wallet } from "lucide-react";
import { useStore } from "../store";
import type { Recommendation } from "../types";
import { ProductImage, Ring } from "./ui";

export const inr = (v: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
const BUDGETS: (number | null)[] = [null, 300, 500, 1000, 2000];

/** Max-price-per-product selector, saved to the user's profile. */
export function BudgetBar({ dark }: { dark?: boolean }) {
  const s = useStore();
  const opts = s.budget !== null && !BUDGETS.includes(s.budget) ? [...BUDGETS, s.budget] : BUDGETS;
  return (
    <div className={`budget-bar ${dark ? "dark" : ""}`}>
      <span className="bb-label"><Wallet size={14} /> Max per product</span>
      {opts.map((b) => (
        <button key={String(b)} className={`chip ${s.budget === b ? "on" : ""}`} onClick={() => s.setBudget(b)}>{b === null ? "Any" : inr(b)}</button>
      ))}
      {s.recsLoading && <Loader2 size={15} className="spin" />}
    </div>
  );
}

/** A real retailer listing — never added to My Products automatically. */
export function RecCard({ p, rank = 0, compact }: { p: Recommendation; rank?: number; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const save = p.mrp && p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
  return (
    <article className={`pcard rec3 ${compact ? "compact" : ""}`}>
      <ProductImage src={p.image} alt={p.fullTitle}>
        <div className="corner">
          <span className="ai-badge"><Sparkles size={11} /> {rank === 0 ? "Top AI pick" : "AI pick"}</span>
          {save > 0 && <span className="badge" style={{ background: "#DDF7EA", color: "#0F8A58" }}><BadgePercent size={11} /> {save}% off</span>}
        </div>
        <div className="score-orb" title={`AI match — suitability ${p.breakdown.suitability}, value ${p.breakdown.affordability}, trusted brand ${p.breakdown.trustedBrand}`}><Ring value={p.score} size={54} stroke={6} label={<span style={{ fontSize: 14 }}>{p.score}</span>} /></div>
      </ProductImage>
      <div className="pbody">
        <span className="pbrand">{p.brand}</span>
        <h4 className="pname" title={p.fullTitle}>{p.name}</h4>
        <div className="price-row">
          <b>{inr(p.price)}</b>
          {save > 0 && p.mrp && <s>{inr(p.mrp)}</s>}
          {p.size && <span className="mchip">{p.size}</span>}
        </div>
        <div className="meta-chips">
          <span className="mchip ok"><Store size={11} /> Lowest on {p.retailer}</span>
          {p.storesCompared > 1 && <button className="mchip opt" onClick={() => setOpen((o) => !o)}>{p.storesCompared} stores compared</button>}
          {!compact && p.why.slice(0, 2).map((w) => <span key={w} className="mchip"><Check size={11} /> {w}</span>)}
        </div>
        {open && (
          <div className="offer-list">
            {p.offers.map((o) => <a key={o.retailer} href={o.link || "#"} target="_blank" rel="noopener noreferrer"><span>{o.retailer}</span><b>{inr(o.price)}</b><ExternalLink size={12} /></a>)}
          </div>
        )}
      </div>
      <div className="pfoot">
        {p.link ? <a className="btn btn-primary btn-sm" href={p.link} target="_blank" rel="noopener noreferrer"><ShoppingCart size={14} /> Buy on {p.retailer}</a> : <span className="badge na">Link unavailable</span>}
      </div>
      <p className="tiny price-src">Price via Pricee{p.priceCheckedAt ? ` · checked ${new Date(p.priceCheckedAt.replace(" ", "T")).toLocaleDateString(undefined, { day: "numeric", month: "short" })}` : ""} · not in My Products</p>
    </article>
  );
}

/** Total estimated cost of the top pick for every step the user doesn't already own. */
export function CostSummary() {
  const s = useStore();
  const results = Object.values(s.recs?.results || {});
  const picks = results.map((r) => r?.products[0]).filter(Boolean) as Recommendation[];
  const total = picks.reduce((a, p) => a + p.price, 0);
  const ownedSteps = s.coverage.covered.length;
  const missingPicks = results.filter((r) => r && !r.products.length).length;
  return (
    <div className="cost-card">
      <div className="row" style={{ gap: 14 }}>
        <span className="cost-ico"><ShoppingCart size={22} /></span>
        <div style={{ flex: 1 }}>
          <span className="tiny" style={{ fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>Estimated routine cost</span>
          <div className="cost-total">{picks.length ? inr(total) : "—"}</div>
        </div>
        <button className="icon-btn sm" onClick={s.refreshRecs} aria-label="Refresh prices" title="Refresh prices">{s.recsLoading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}</button>
      </div>
      <div className="cost-lines">
        {picks.map((p) => <div key={p.id}><span>{p.category}</span><b>{inr(p.price)}</b></div>)}
        {ownedSteps > 0 && <div className="owned"><span><Check size={12} /> {ownedSteps} step{ownedSteps > 1 ? "s" : ""} already owned</span><b>{inr(0)}</b></div>}
        {missingPicks > 0 && <div className="na"><span>{missingPicks} step{missingPicks > 1 ? "s" : ""} with no match in budget</span><b>—</b></div>}
      </div>
    </div>
  );
}
