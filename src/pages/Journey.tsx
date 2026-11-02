import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, BarChart3, CalendarCheck, Camera, Info, Minus, NotebookPen, Radar, ScanFace, Sparkles, Target, Trash2, TrendingUp, Trophy } from "lucide-react";
import { Area, AreaChart, LabelList, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar as RechartsRadar, RadarChart, RadialBar, RadialBarChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useStore } from "../store";
import * as api from "../services/api";
import { averageScore, displayScore, fmtDate, metricMeta, scoredMetrics } from "../lib/engine";
import { Empty, MetricIcon, Ring } from "../components/ui";

export default function Journey() {
  const s = useStore();
  const completed = s.assessments.filter((a) => a.status === "completed");
  const [a, b] = completed; // a = latest, b = previous
  const [editing, setEditing] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const comparable = useMemo(() => {
    if (!a || !b) return [];
    return scoredMetrics(a).flatMap((m) => {
      const prev = b.results.find((x) => x.type === m.type);
      const pv = prev ? displayScore(prev) : null;
      const cv = displayScore(m);
      return pv !== null && cv !== null ? [{ type: m.type, now: cv, before: pv, d: cv - pv }] : [];
    });
  }, [a, b]);

  const chartTypes = useMemo(() => {
    const counts = new Map<string, number>();
    completed.forEach((x) => scoredMetrics(x).forEach((m) => counts.set(m.type, (counts.get(m.type) || 0) + 1)));
    return [...counts.entries()].filter(([, n]) => n >= 2).map(([t]) => t).slice(0, 5);
  }, [completed]);
  const chartData = useMemo(() => [...completed].reverse().map((x) => ({
    date: fmtDate(x.completedAt, { day: "numeric", month: "short" }),
    ...Object.fromEntries(scoredMetrics(x).map((m) => [m.type, displayScore(m)])),
  })), [completed]);

  const radarData = useMemo(() => (a ? scoredMetrics(a).map((m) => {
    const prev = b?.results.find((x) => x.type === m.type);
    return { label: metricMeta(m.type).label, now: displayScore(m), before: prev ? displayScore(prev) : null };
  }) : []), [a, b]);
  const orbitData = useMemo(() => (a ? scoredMetrics(a).map((m) => ({ type: m.type, label: metricMeta(m.type).label, value: displayScore(m) as number, fill: metricMeta(m.type).hue })) : []), [a]);
  const trendTypes = useMemo(() => [...new Set(completed.flatMap((x) => scoredMetrics(x).map((m) => m.type)))], [completed]);
  const [selPick, setSel] = useState<string>("");
  const sel = trendTypes.includes(selPick) ? selPick : trendTypes[0] || "moisture";
  const selHue = metricMeta(sel).hue;
  const trendData = useMemo(() => [...completed].reverse().map((x) => {
    const m = x.results.find((r) => r.type === sel);
    return { date: fmtDate(x.completedAt, { day: "numeric", month: "short" }), v: m ? displayScore(m) : null };
  }).filter((d) => d.v !== null), [completed, sel]);

  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (13 - i)); return d; });
  const total = (s.routine?.AM.steps.length || 0) + (s.routine?.PM.steps.length || 0);
  const level = (d: Date) => {
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const l = s.routine?.logs?.[k]; const n = (l?.AM.length || 0) + (l?.PM.length || 0);
    if (!total || !n) return 0; const r = n / total; return r >= 0.9 ? 3 : r >= 0.5 ? 2 : 1;
  };
  const active = days.filter((d) => level(d) > 0).length;

  async function saveNote(id: string) {
    try { const upd = await api.updateAssessmentNote(id, note); s.setAssessments((l) => l.map((x) => (x.id === id ? upd : x))); setEditing(null); s.toast("Note saved"); }
    catch (e) { s.toast((e as Error).message, true); }
  }
  async function remove(id: string) {
    if (!window.confirm("Delete this assessment record? This can't be undone.")) return;
    try { await api.deleteAssessment(id); s.setAssessments((l) => l.filter((x) => x.id !== id)); s.toast("Assessment deleted"); }
    catch (e) { s.toast((e as Error).message, true); }
  }

  const latestAvg = averageScore(a);
  const best = a ? [...scoredMetrics(a)].sort((x, y) => (displayScore(y) ?? 0) - (displayScore(x) ?? 0))[0] : null;
  const stats = [
    { icon: <ScanFace size={20} />, bg: "var(--grad)", glow: "rgba(167,139,250,.22)", value: completed.length, label: "AI scans" },
    { icon: <Sparkles size={20} />, bg: "linear-gradient(135deg,#F0ABFC,#C026D3)", glow: "rgba(240,171,252,.25)", value: latestAvg ?? "—", label: "Latest AI score" },
    { icon: best ? <MetricIcon type={best.type} size={20} /> : <Trophy size={20} />, bg: "linear-gradient(135deg,#FCD34D,#F97316)", glow: "rgba(252,211,77,.25)", value: best ? displayScore(best) : "—", label: best ? `Best · ${metricMeta(best.type).label}` : "Best metric" },
    { icon: <CalendarCheck size={20} />, bg: "linear-gradient(135deg,#5EEAD4,#0EA5E9)", glow: "rgba(94,234,212,.25)", value: active, label: "Active days / 14" },
  ];

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <span className="row" style={{ gap: 8 }}><span className="ai-badge"><Sparkles size={11} /> AI tracked</span><span className="eyebrow">Skin journey</span></span>
          <h1 className="h1" style={{ marginTop: 10 }}>Your skin <span className="grad-text">journey.</span></h1>
          <p className="lead">Every scan, side by side.</p>
        </div>
        <button className="btn btn-primary" onClick={() => s.go("analysis")}><Camera size={15} /> New analysis</button>
      </div>

      {completed.length === 0 ? (
        <Empty icon={<BarChart3 size={28} />} title="Your journey begins with one analysis" body="Once you complete a skin analysis, it appears here. A second one later unlocks a careful, like-for-like comparison." action={<button className="btn btn-primary" onClick={() => s.go("analysis")}><Camera size={15} /> Start skin analysis</button>} />
      ) : (
        <>
          <div className="stat-tiles">
            {stats.map((t) => (
              <div key={t.label} className="stat-tile" style={{ ["--glow" as string]: t.glow }}>
                <span className="si-ico" style={{ background: t.bg }}>{t.icon}</span>
                <div className="stat-num">{t.value}</div>
                <small>{t.label}</small>
              </div>
            ))}
          </div>
          <div className="viz-grid">
            {/* AI skin map — radar of the latest scan (and previous, when comparable) */}
            <div className="viz-card dark">
              <div className="viz-head">
                <div><span className="eyebrow"><Radar size={13} /> AI skin map</span><h3 className="h3" style={{ marginTop: 4 }}>{b ? "Now vs last scan" : "Latest scan"}</h3></div>
                <span className="ai-badge"><Sparkles size={11} /> AI</span>
              </div>
              <div className="radar-box">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} outerRadius="72%">
                    <defs>
                      <linearGradient id="radNow" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#F0ABFC" /><stop offset="100%" stopColor="#8B5CF6" /></linearGradient>
                    </defs>
                    <PolarGrid stroke="rgba(255,255,255,.16)" />
                    <PolarAngleAxis dataKey="label" tick={{ fill: "#E9D5FF", fontSize: 12, fontWeight: 700 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                    {b && <RechartsRadar name="Previous" dataKey="before" stroke="#94A3B8" strokeDasharray="4 4" fill="#94A3B8" fillOpacity={0.12} strokeWidth={2} />}
                    <RechartsRadar name="Now" dataKey="now" stroke="#F0ABFC" fill="url(#radNow)" fillOpacity={0.55} strokeWidth={3} dot={{ r: 4, fill: "#fff", strokeWidth: 0 }} />
                    <Tooltip contentStyle={{ borderRadius: 14, border: 0, fontSize: 12, fontWeight: 700 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="legend-row"><span><i style={{ background: "linear-gradient(90deg,#F0ABFC,#8B5CF6)" }} /> Now</span>{b && <span><i style={{ background: "#94A3B8" }} /> {fmtDate(b.completedAt, { day: "numeric", month: "short" })}</span>}</div>
            </div>

            {/* Score orbit — radial bars of the latest scan */}
            <div className="viz-card">
              <div className="viz-head">
                <div><span className="eyebrow"><Target size={13} /> Score orbit</span><h3 className="h3" style={{ marginTop: 4 }}>{fmtDate(a.completedAt, { day: "numeric", month: "short" })}</h3></div>
              </div>
              <div className="orbit-box">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart data={orbitData} innerRadius="28%" outerRadius="100%" startAngle={90} endAngle={-270} barSize={9}>
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar dataKey="value" cornerRadius={10} background={{ fill: "#F1ECFB" }} />
                    <Tooltip contentStyle={{ borderRadius: 14, border: 0, fontSize: 12, fontWeight: 700 }} formatter={(v: number, _n, item) => [v, (item?.payload as { label?: string })?.label || ""]} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="orbit-center"><div><b className="grad-text">{latestAvg ?? "—"}</b><small>AI score</small></div></div>
              </div>
              <div className="orbit-legend">
                {orbitData.slice().reverse().map((d) => <span key={d.type}><i style={{ background: d.fill }}><MetricIcon type={d.type} size={12} /></i>{d.label}<em>{d.value}</em></span>)}
              </div>
            </div>
          </div>

          {/* Trend with score zones */}
          <div className="viz-card">
            <div className="viz-head" style={{ flexWrap: "wrap" }}>
              <div><span className="eyebrow"><TrendingUp size={13} /> Trend</span><h3 className="h3" style={{ marginTop: 4 }}>{metricMeta(sel).label} over time</h3></div>
              <div className="zone-legend"><span><i style={{ background: "#EDE5FF" }} /> Great 80+</span><span><i style={{ background: "#FFEDD5" }} /> Fair 65–79</span><span><i style={{ background: "#FCE7F3" }} /> Focus &lt;65</span></div>
            </div>
            <div className="metric-switch" style={{ margin: "10px 0 4px" }}>
              {trendTypes.map((t) => { const m = metricMeta(t); return (
                <button key={t} className={sel === t ? "on" : ""} style={{ ["--hue" as string]: m.hue }} onClick={() => setSel(t)}><i style={{ background: m.hue }}><MetricIcon type={t} size={13} /></i>{m.label}</button>
              ); })}
            </div>
            <div className="trend-box">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 28, right: 24, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={selHue} stopOpacity={0.35} /><stop offset="100%" stopColor={selHue} stopOpacity={0} /></linearGradient>
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                  </defs>
                  <ReferenceArea y1={80} y2={100} fill="#EDE5FF" fillOpacity={0.8} />
                  <ReferenceArea y1={65} y2={80} fill="#FFEDD5" fillOpacity={0.55} />
                  <ReferenceArea y1={0} y2={65} fill="#FCE7F3" fillOpacity={0.45} />
                  <XAxis dataKey="date" padding={{ left: 30, right: 30 }} tickLine={false} axisLine={false} tick={{ fill: "#8C87A6", fontSize: 11, fontWeight: 700 }} />
                  <YAxis domain={[0, 100]} ticks={[0, 65, 80, 100]} tickLine={false} axisLine={false} tick={{ fill: "#8C87A6", fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 14, border: 0, boxShadow: "0 12px 30px -10px rgba(124,58,237,.35)", fontSize: 12, fontWeight: 700 }} />
                  <Area type="monotone" dataKey="v" name={metricMeta(sel).label} stroke={selHue} strokeWidth={4} fill="url(#trendFill)" isAnimationActive={false} dot={{ r: 7, strokeWidth: 4, stroke: "#fff", fill: selHue }} activeDot={{ r: 9 }} connectNulls>
                    <LabelList dataKey="v" position="top" offset={14} style={{ fill: "#1E1838", fontSize: 13, fontWeight: 800 }} />
                  </Area>
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="tiny row" style={{ marginTop: 10, gap: 6 }}><Info size={12} /> Lighting & camera affect scores — small changes are noise.</p>
          </div>

          <div className="split">
            {/* Before → after dumbbells */}
            <div className="viz-card">
              <div className="viz-head">
                <div><span className="eyebrow"><ArrowUpRight size={13} /> Since last time</span><h3 className="h3" style={{ marginTop: 4 }}>{b ? `${fmtDate(b.completedAt, { day: "numeric", month: "short" })} → ${fmtDate(a.completedAt, { day: "numeric", month: "short" })}` : "One scan so far"}</h3></div>
                {b && <span className="badge">{comparable.length} compared</span>}
              </div>
              {b && comparable.length ? (
                <div className="dumbbells" style={{ marginTop: 18 }}>
                  {comparable.map((c) => { const m = metricMeta(c.type); const lo = Math.min(c.before, c.now), hi = Math.max(c.before, c.now); return (
                    <div key={c.type} className="db-row">
                      <span className="db-label"><span className="rt-ico" style={{ background: m.hue, width: 26, height: 26, borderRadius: 9 }}><MetricIcon type={c.type} size={13} /></span>{m.label}</span>
                      <div className="db-track">
                        <span className="db-bar" style={{ left: `${lo}%`, width: `${Math.max(hi - lo, 0.5)}%`, background: `linear-gradient(90deg, ${m.hue}55, ${m.hue})` }} />
                        <span className="db-dot prev" style={{ left: `${c.before}%` }} title={`Before ${c.before}`} />
                        <span className="db-dot now" data-v={c.now} style={{ left: `${c.now}%`, background: m.hue }} title={`Now ${c.now}`} />
                      </div>
                      <span className={`dpill ${c.d > 0 ? "up" : c.d < 0 ? "down" : "flat"}`}>{c.d > 0 ? <ArrowUpRight size={13} /> : c.d < 0 ? <ArrowDownRight size={13} /> : <Minus size={13} />}{c.d > 0 ? "+" : ""}{c.d}</span>
                    </div>
                  ); })}
                  <div className="zone-legend" style={{ marginTop: 4 }}><span><i style={{ background: "#CBC3DD", borderRadius: "50%" }} /> Before</span><span><i style={{ background: "var(--plum)", borderRadius: "50%" }} /> Now</span></div>
                </div>
              ) : <div className="empty" style={{ padding: 28 }}><div className="em-icon"><Camera size={26} /></div><p className="body">{b ? "No shared metrics to compare." : "Scan again later to compare."}</p></div>}
            </div>

            <div className="viz-card">
              <div className="row" style={{ gap: 14, marginBottom: 18 }}>
                <Ring value={Math.round((active / 14) * 100)} size={64} stroke={7} label={<span style={{ fontSize: 15 }}>{active}</span>} />
                <div><span className="eyebrow"><CalendarCheck size={13} /> Consistency</span><h3 className="h3" style={{ marginTop: 4 }}>{total ? "Last 14 days" : "No routine yet"}</h3></div>
              </div>
              <div className="adherence">{days.map((d) => <div key={d.toISOString()} className={`l${level(d)}`} title={d.toDateString()}>{d.getDate()}</div>)}</div>
              <div className="row tiny" style={{ marginTop: 12, gap: 6 }}>Less <span style={{ width: 12, height: 12, borderRadius: 3, background: "#F1ECF3" }} /><span style={{ width: 12, height: 12, borderRadius: 3, background: "#DDD0FA" }} /><span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--violet-400)" }} /><span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--plum)" }} /> More</div>
            </div>
          </div>
        </>
      )}

      {s.assessments.length > 0 && (
        <div className="card pad-lg">
          <h3 className="h3 row" style={{ marginBottom: 20, gap: 10 }}><ScanFace size={20} color="var(--plum)" /> All AI scans</h3>
          <div className="timeline">
            {s.assessments.map((x) => {
              const avg = averageScore(x);
              return (
                <div key={x.id} className="tl-item">
                  <div className={`tl-dot v3 ${x.status}`} style={{ ["--p" as string]: avg ?? 0 }}><span>{x.status === "completed" ? (avg ?? "✓") : x.status === "failed" ? "!" : "…"}</span></div>
                  <div className="stack-sm">
                    <div className="between" style={{ flexWrap: "wrap" }}>
                      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                        <b className="h4">{fmtDate(x.completedAt || x.createdAt, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</b>
                        <span className={`badge ${x.status === "completed" ? "good" : x.status === "failed" ? "rose" : "amber"}`}>{x.status}</span>
                      </div>
                      <div className="row" style={{ gap: 4 }}>
                        <button className="icon-btn sm ghost" onClick={() => { setEditing(x.id); setNote(x.note || ""); }} aria-label="Add note"><NotebookPen size={14} /></button>
                        <button className="icon-btn sm ghost" onClick={() => remove(x.id)} aria-label="Delete"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    {x.status === "completed" ? (
                      <div className="metric-chips">{scoredMetrics(x).map((m) => <span key={m.type} className="mc" title={metricMeta(m.type).label}><i style={{ background: metricMeta(m.type).hue }}><MetricIcon type={m.type} size={11} /></i>{displayScore(m)}</span>)}</div>
                    ) : <p className="small">{x.status === "failed" ? x.error : `Processing · ${x.actions.length} metrics`}</p>}
                    {editing === x.id ? (
                      <div className="input-group"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Personal note (kept separate from AI results)" autoFocus onKeyDown={(e) => e.key === "Enter" && saveNote(x.id)} /><button className="btn btn-primary btn-sm" onClick={() => saveNote(x.id)}>Save</button></div>
                    ) : x.note ? <p className="small italic" style={{ color: "#9A5C46" }}>Your note: “{x.note}”</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
