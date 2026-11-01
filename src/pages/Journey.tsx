import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, BarChart3, Camera, Info, Minus, NotebookPen, Trash2 } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useStore } from "../store";
import * as api from "../services/api";
import { averageScore, displayScore, fmtDate, metricMeta, scoredMetrics } from "../lib/engine";
import { Empty } from "../components/ui";

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

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow"><BarChart3 size={13} /> Skin journey</span>
          <h1 className="h1" style={{ marginTop: 10 }}>Your skin <span className="grad-text">journey.</span></h1>
          <p className="lead">Every scan, side by side.</p>
        </div>
        <button className="btn btn-primary" onClick={() => s.go("analysis")}><Camera size={15} /> New analysis</button>
      </div>

      {completed.length === 0 ? (
        <Empty icon={<BarChart3 size={28} />} title="Your journey begins with one analysis" body="Once you complete a skin analysis, it appears here. A second one later unlocks a careful, like-for-like comparison." action={<button className="btn btn-primary" onClick={() => s.go("analysis")}><Camera size={15} /> Start skin analysis</button>} />
      ) : (
        <>
          <div className="split">
            <div className="card pad-lg">
              <div className="card-head">
                <div><span className="eyebrow">Since last time</span><h2 className="h2" style={{ marginTop: 8 }}>{b ? `${fmtDate(b.completedAt, { day: "numeric", month: "short" })} → ${fmtDate(a.completedAt, { day: "numeric", month: "short" })}` : "One reading so far"}</h2></div>
                {b && <span className="badge">{comparable.length} comparable</span>}
              </div>
              {b ? comparable.length ? (
                <div className="grid-2" style={{ gap: 12 }}>
                  {comparable.map((c) => (
                    <div key={c.type} className="cov-item" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                      <span><b>{metricMeta(c.type).label}</b><small>{c.before} → {c.now}</small></span>
                      <span className={`delta ${c.d > 0 ? "up" : c.d < 0 ? "down" : "flat"}`}>{c.d > 0 ? <ArrowUpRight size={14} /> : c.d < 0 ? <ArrowDownRight size={14} /> : <Minus size={14} />}{c.d > 0 ? "+" : ""}{c.d}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="body">These two analyses don't share any metrics, so there's nothing fair to compare.</p> : <p className="body">Run another analysis in a few weeks, in similar lighting, to see a like-for-like comparison.</p>}
              {chartTypes.length > 0 && (
                <div className="chart-box" style={{ marginTop: 24 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                      <CartesianGrid stroke="#F0EAF2" vertical={false} />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#8A8499", fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: "#8A8499", fontSize: 11 }} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #ECE5DD", fontSize: 12 }} />
                      {chartTypes.map((t) => <Line key={t} type="monotone" dataKey={t} name={metricMeta(t).label} stroke={metricMeta(t).hue} strokeWidth={2.5} dot={{ r: 4, strokeWidth: 0, fill: metricMeta(t).hue }} connectNulls={false} />)}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="callout" style={{ marginTop: 20 }}><Info size={18} /><div>Lighting, camera, angle and image quality all affect results. Treat small differences as noise, and don't read changes as proof that any product worked.</div></div>
            </div>

            <div className="card">
              <span className="eyebrow">Routine consistency</span>
              <h3 className="h3" style={{ margin: "8px 0 4px" }}>{total ? `${active} of the last 14 days` : "No routine yet"}</h3>
              <p className="small" style={{ marginBottom: 16 }}>{total ? "Days with at least one step logged." : "Build a routine to start logging."}</p>
              <div className="adherence">{days.map((d) => <div key={d.toISOString()} className={`l${level(d)}`} title={d.toDateString()}>{d.getDate()}</div>)}</div>
              <div className="row tiny" style={{ marginTop: 12, gap: 6 }}>Less <span style={{ width: 12, height: 12, borderRadius: 3, background: "#F1ECF3" }} /><span style={{ width: 12, height: 12, borderRadius: 3, background: "#E1D6EA" }} /><span style={{ width: 12, height: 12, borderRadius: 3, background: "#BFA9CE" }} /><span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--plum)" }} /> More</div>
            </div>
          </div>
        </>
      )}

      {s.assessments.length > 0 && (
        <div className="card pad-lg">
          <h3 className="h3" style={{ marginBottom: 20 }}>All analyses</h3>
          <div className="timeline">
            {s.assessments.map((x) => {
              const avg = averageScore(x);
              return (
                <div key={x.id} className="tl-item">
                  <div className={`tl-dot ${x.status}`}>{x.status === "completed" ? (avg ?? "✓") : x.status === "failed" ? "!" : "…"}</div>
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
                    <p className="small">{x.status === "completed" ? `${scoredMetrics(x).length} metrics · ${scoredMetrics(x).map((m) => `${metricMeta(m.type).label} ${displayScore(m)}`).join(" · ")}` : x.status === "failed" ? x.error : `Processing · requested ${x.actions.length} metrics`}</p>
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
