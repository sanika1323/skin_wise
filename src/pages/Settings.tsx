import { useState } from "react";
import { Database, Eye, KeyRound, Lock, RefreshCw, Settings as SettingsIcon, ShieldCheck, Trash2 } from "lucide-react";
import { useStore } from "../store";
import * as api from "../services/api";

export default function SettingsPage() {
  const s = useStore();
  const [busy, setBusy] = useState(false);

  async function deleteAll() {
    if (!window.confirm(`Delete all ${s.assessments.length} saved analysis records? This can't be undone.`)) return;
    setBusy(true);
    try { for (const a of s.assessments) await api.deleteAssessment(a.id); s.setAssessments(() => []); s.toast("All analysis records deleted"); }
    catch (e) { s.toast((e as Error).message, true); }
    finally { setBusy(false); }
  }

  const rows = [
    { icon: <Eye size={18} />, title: "Selfies are never stored", body: "Your photo is held in server memory only long enough to upload it to YouCam. SkinWise never writes it to disk. YouCam keeps task results for 24 hours under its own terms." },
    { icon: <KeyRound size={18} />, title: "API key stays on the server", body: "The YouCam key is read from server environment variables only and is never sent to the browser." },
    { icon: <ShieldCheck size={18} />, title: "Consent before every upload", body: "Analysis can't start until you confirm consent for that specific photo." },
    { icon: <Database size={18} />, title: "What we save", body: "Analysis results (scores, labels, mask links), your profile, routine, routine logs and shelf — as JSON on the SkinWise server. Notes stay separate from AI results." },
  ];

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow"><SettingsIcon size={13} /> Privacy & settings</span>
          <h1 className="h1" style={{ marginTop: 10 }}>Privacy & <span className="grad-text">settings.</span></h1>
          <p className="lead">No fake scores. No stored selfies.</p>
        </div>
      </div>
      <div className="grid-2">
        {rows.map((r) => (
          <div key={r.title} className="card row" style={{ alignItems: "flex-start", gap: 16 }}>
            <span className="dz-icon" style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0 }}>{r.icon}</span>
            <div><h3 className="h4">{r.title}</h3><p className="small" style={{ marginTop: 6 }}>{r.body}</p></div>
          </div>
        ))}
      </div>
      <div className="card pad-lg stack">
        <h3 className="h3">Connections</h3>
        <div className="kv"><span>Express API</span><b className="row" style={{ gap: 8 }}><span className={`dot ${s.offline ? "warn" : "ok"}`} />{s.offline ? "Offline" : "Connected"}</b></div>
        <div className="kv"><span>YouCam Skin Analysis API</span><b className="row" style={{ gap: 8 }}><span className={`dot ${s.providerReady ? "ok" : "warn"}`} />{s.providerReady ? "Key configured on server" : "Key missing — add YOUCAM_API_KEY to server/.env"}</b></div>
        <div className="kv"><span>Product catalog</span><b>Open Beauty Facts (community-maintained)</b></div>
        <div><button className="btn btn-ghost btn-sm" onClick={() => s.reload().then(() => s.toast("Refreshed"))}><RefreshCw size={13} /> Re-check connections</button></div>
      </div>
      <div className="card pad-lg stack">
        <h3 className="h3">Delete data</h3>
        <p className="body">Remove every saved analysis record. Your profile, routine and shelf are kept. Individual records can be deleted from Skin Journey.</p>
        <div><button className="btn btn-danger" disabled={busy || !s.assessments.length} onClick={deleteAll}><Trash2 size={14} /> Delete {s.assessments.length} analysis record{s.assessments.length === 1 ? "" : "s"}</button></div>
        <p className="tiny row" style={{ gap: 6 }}><Lock size={12} /> This is a single-user prototype without accounts. Add authentication before deploying for multiple users.</p>
      </div>
    </section>
  );
}
