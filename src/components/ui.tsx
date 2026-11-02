import { useEffect, useId, useState, type ReactNode } from "react";
import { CircleDot, Droplets, ExternalLink, Eye, Flame, Gem, Grid3x3, Layers, Package, ScanFace, Sparkles, Sun, Target, ThumbsUp, TrendingUp, Waves, X, Zap, type LucideIcon } from "lucide-react";
import type { SkinMetric } from "../types";
import { band, displayScore, metricMeta } from "../lib/engine";

const METRIC_ICONS: Record<string, LucideIcon> = {
  moisture: Droplets, redness: Flame, acne: CircleDot, pore: Grid3x3, oiliness: Zap, texture: Waves,
  radiance: Sparkles, age_spot: Sun, wrinkle: Layers, firmness: Gem, eye_bag: Eye, dark_circle_v2: Eye, skin_type: ScanFace,
};
export function MetricIcon({ type, size = 16 }: { type: string; size?: number }) {
  const I = METRIC_ICONS[type.replace(/^hd_/, "")] || Sparkles;
  return <I size={size} strokeWidth={2} />;
}
export const TONE_COLOR: Record<string, string> = { good: "linear-gradient(90deg,#A78BFA,#7C3AED)", mid: "linear-gradient(90deg,#FBBF24,#F97316)", focus: "linear-gradient(90deg,#F472B6,#DB2777)", na: "#C4B5FD" };

const TILE_BAND: Record<string, { label: string; icon: LucideIcon }> = {
  good: { label: "Great", icon: ThumbsUp }, mid: { label: "Fair", icon: TrendingUp }, focus: { label: "Focus", icon: Target }, na: { label: "N/A", icon: Sparkles },
};
/** Lighter companion shade for a hex colour (for gradients). */
export const tint = (hex: string, amt = 0.45) => {
  const n = parseInt(hex.slice(1), 16); const mix = (c: number) => Math.round(c + (255 - c) * amt);
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => mix(c).toString(16).padStart(2, "0")).join("")}`;
};

/** Compact circular gauge tile — each metric in its own colour, with an icon verdict pill. */
export function RingTile({ m, onClick }: { m: SkinMetric; onClick?: () => void }) {
  const meta = metricMeta(m.type); const v = displayScore(m); const b = band(v);
  const tb = TILE_BAND[b.tone]; const BI = tb.icon;
  return (
    <button className="ring-tile v3" onClick={onClick} type="button" style={{ ["--hue" as string]: meta.hue, ["--hue-soft" as string]: `${meta.hue}1f` }}>
      <span className="rt-head"><span className="rt-ico"><MetricIcon type={m.type} size={16} /></span><span className="rt-label">{meta.label}</span></span>
      <Ring value={v} size={96} stroke={9} grad={[tint(meta.hue, 0.5), meta.hue]} label={<span className="rt-num">{v ?? "—"}</span>} />
      <span className={`rt-pill t-${b.tone}`}><BI size={12} strokeWidth={2.5} />{tb.label}</span>
    </button>
  );
}

export function Ring({ value, size = 132, stroke = 10, label, sub, color, grad }: { value: number | null; size?: number; stroke?: number; label?: ReactNode; sub?: string; color?: string; grad?: [string, string] }) {
  const gid = `rg${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [shown, setShown] = useState(0);
  useEffect(() => { const t = requestAnimationFrame(() => setShown(value ?? 0)); return () => cancelAnimationFrame(t); }, [value]);
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={grad ? grad[0] : "#F0ABFC"} />
            {!grad && <stop offset="50%" stopColor="#A78BFA" />}
            <stop offset="100%" stopColor={grad ? grad[1] : "#7C3AED"} />
          </linearGradient>
        </defs>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        {value !== null && (
          <circle className="ring-bar" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color || `url(#${gid})`} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * Math.max(0, Math.min(100, shown))) / 100} />
        )}
      </svg>
      <div className="ring-label">
        <div>
          <b style={{ fontSize: size * 0.3 }}>{label ?? (value === null ? "—" : value)}</b>
          {sub && <small>{sub}</small>}
        </div>
      </div>
    </div>
  );
}

export function Meter({ value, color }: { value: number; color?: string }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = requestAnimationFrame(() => setW(value)); return () => cancelAnimationFrame(t); }, [value]);
  return <div className="meter" role="presentation"><i style={{ width: `${Math.max(0, Math.min(100, w))}%`, ...(color ? { background: color } : {}) }} /></div>;
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
/** Catalog photos go through the same-origin proxy first, then the direct URL, then a neutral placeholder. */
export const imgSources = (src?: string | null) => (src ? [`${API_BASE}/api/img?u=${encodeURIComponent(src)}`, src] : []);

export function ProductImage({ src, alt, children, bubbles = true }: { src?: string | null; alt: string; children?: ReactNode; bubbles?: boolean }) {
  const sources = imgSources(src);
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [src]);
  const current = sources[i];
  return (
    <div className={`pimg ${bubbles ? "bubbles" : ""}`}>
      {current ? <img src={current} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setI((x) => x + 1)} /> : (
        <div className="ph"><Package size={28} strokeWidth={1.5} /><span>No photo in catalog</span></div>
      )}
      {children}
    </div>
  );
}

export function Thumb({ src }: { src?: string | null }) {
  const sources = imgSources(src);
  const [i, setI] = useState(0);
  return sources[i] ? <img src={sources[i]} alt="" referrerPolicy="no-referrer" onError={() => setI((x) => x + 1)} /> : <Package size={20} strokeWidth={1.5} />;
}

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="card empty">
      <div className="em-icon">{icon}</div>
      <h3 className="h3">{title}</h3>
      <p className="body">{body}</p>
      {action}
    </div>
  );
}

export function Source({ kind }: { kind: "ai" | "user" | "derived" }) {
  const text = kind === "ai" ? "AI-assessed · YouCam" : kind === "user" ? "Self-reported · You" : "Derived · SkinWise rules";
  return <span className={`source-tag source-${kind}`}><i />{text}</span>;
}

export function MetricCard({ m }: { m: SkinMetric }) {
  const meta = metricMeta(m.type);
  const score = displayScore(m);
  const b = band(score);
  const extras = Object.entries(m.extra || {}).filter(([, v]) => typeof v === "string" || typeof v === "number").slice(0, 3);
  return (
    <article className="card metric-card lift">
      <div className="row-top">
        <span className="metric-name"><span className="icon-bubble sm" style={{ background: `${meta.hue}22`, color: meta.hue }}><MetricIcon type={m.type} /></span>{meta.label}</span>
        <span className={`badge ${b.tone}`}>{b.label}</span>
      </div>
      <div className="metric-value">
        <b>{score ?? "—"}</b>
        {score !== null && <small>/ 100 · ui_score</small>}
      </div>
      {score !== null && <Meter value={score} color={({ good: "#10A363", mid: "#F08A24", focus: "#D9367A", na: "#C4B5FD" } as Record<string, string>)[b.tone]} />}
      <p className="small">{meta.blurb}</p>
      <div className="between">
        <span className="tiny">{m.rawScore !== null ? `Raw score ${m.rawScore.toFixed(1)}` : "Raw score not returned"}{extras.map(([k, v]) => ` · ${k}: ${v}`).join("")}</span>
        {m.maskUrls[0] && <a className="mask-link" href={m.maskUrls[0]} target="_blank" rel="noreferrer">Mask <ExternalLink size={12} /></a>}
      </div>
    </article>
  );
}

export function Modal({ onClose, children, wide }: { onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" style={wide ? { width: "min(980px, 100%)" } : undefined}>
        <button className="icon-btn sm modal-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        {children}
      </div>
    </div>
  );
}

export function Skeleton({ h = 16, w = "100%", r }: { h?: number; w?: number | string; r?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} />;
}

export function highlight(text: string, words: string[]): ReactNode {
  if (!words.length || !text) return text;
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}
