import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowRight, Camera, Check, Glasses, ImagePlus, Info, Lightbulb, Loader2, Lock, RotateCcw, ScanFace, Sparkles, Sun, Trash2, UserRound, X } from "lucide-react";
import { useStore } from "../store";
import * as api from "../services/api";
import type { Assessment } from "../types";
import { ANALYSIS_OPTIONS, SUMMARY_TYPES, averageScore, fmtDate, focusAreas, metricMeta, providerOverall, scoredMetrics, skinAge } from "../lib/engine";
import { MetricCard, MetricIcon, Ring } from "../components/ui";

const ACTIVE_KEY = "skinwise.activeAnalysis";
const STAGES = ["Validating image", "Uploading securely", "Creating YouCam task", "YouCam is analysing", "Saving your results"];
const unitsFor = (n: number) => (n <= 4 ? 9 : n <= 8 ? 12 : n <= 12 ? 14 : 16);
const store = { get: () => { try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; } }, set: (v: string | null) => { try { v ? localStorage.setItem(ACTIVE_KEY, v) : localStorage.removeItem(ACTIVE_KEY); } catch { /* ignore */ } } };

export default function Analysis() {
  const s = useStore();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [actions, setActions] = useState<string[]>(ANALYSIS_OPTIONS.filter((o) => o.recommended).map((o) => o.id));
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [stage, setStage] = useState(0);
  const [record, setRecord] = useState<Assessment | null>(null);
  const [drag, setDrag] = useState(false);
  const polling = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camOn, setCamOn] = useState(false);
  const [flash, setFlash] = useState(false);

  async function startCamera() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) { setError("This browser can't open the camera here — use Upload photo instead."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1440 }, height: { ideal: 1440 } }, audio: false });
      streamRef.current = stream;
      setCamOn(true);
      requestAnimationFrame(() => { if (videoRef.current) videoRef.current.srcObject = stream; });
    } catch { setError("Camera permission was blocked or no camera was found. Allow camera access, or use Upload photo."); }
  }
  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
  }
  // Crop the frame to the face oval so the face fills ~70% of the photo width
  // (YouCam rejects images where the face is under ~60% of the width).
  function snap() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const vw = v.videoWidth, vh = v.videoHeight;
    const cw = v.clientWidth || vw, ch = v.clientHeight || vh;
    const scale = Math.max(cw / vw, ch / vh); // object-fit: cover
    const ox = (cw - vw * scale) / 2, oy = (ch - vh * scale) / 2;
    const ovalW = Math.min(cw * 0.58, 300);
    let cropW = (ovalW * 1.3) / scale; // oval + a little margin, in video pixels
    let cropH = cropW * (4 / 3);
    if (cropH > vh) { cropH = vh; cropW = cropH * 0.75; }
    if (cropW > vw) { cropW = vw; cropH = Math.min(vh, cropW * (4 / 3)); }
    const cxV = (cw / 2 - ox) / scale; // horizontally centred, so mirroring doesn't matter
    const cyV = (ch * 0.46 - oy) / scale;
    const sx = Math.max(0, Math.min(vw - cropW, cxV - cropW / 2));
    const sy = Math.max(0, Math.min(vh - cropH, cyV - cropH / 2));
    const outW = Math.round(Math.min(1440, Math.max(720, cropW)));
    const outH = Math.round(outW * (cropH / cropW));
    const c = document.createElement("canvas");
    c.width = outW; c.height = outH;
    const ctx = c.getContext("2d");
    if (ctx) { ctx.imageSmoothingQuality = "high"; ctx.drawImage(v, sx, sy, cropW, cropH, 0, 0, outW, outH); }
    setFlash(true); window.setTimeout(() => setFlash(false), 350);
    c.toBlob((b) => { if (b) { pick(new File([b], `selfie-${Date.now()}.jpg`, { type: "image/jpeg" })); stopCamera(); } }, "image/jpeg", 0.92);
  }
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  useEffect(() => {
    if (!file) { setPreview(""); setDims(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    const img = new Image();
    img.onload = () => setDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Recover an in-flight analysis after a refresh.
  useEffect(() => {
    const id = store.get() || s.assessments.find((a) => a.status === "processing")?.id;
    if (id) { setStep(2); setStage(3); void poll(id); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pick(f: File | null | undefined) {
    setError("");
    if (!f) return;
    if (!["image/jpeg", "image/png"].includes(f.type)) return setError("Please choose a JPG or PNG photo.");
    if (f.size > 10 * 1024 * 1024) return setError("That photo is over 10 MB. Choose a smaller image.");
    setFile(f);
  }

  const tooSmall = dims ? Math.min(dims.w, dims.h) < 480 : false;
  const landscape = dims ? dims.w > dims.h * 1.15 : false;

  async function poll(id: string) {
    if (polling.current) return;
    polling.current = true;
    store.set(id);
    try {
      for (let i = 0; i < 120; i++) {
        const a = await api.getAssessment(id);
        setRecord(a);
        if (a.status === "completed") {
          setStage(4);
          s.setAssessments((list) => [a, ...list.filter((x) => x.id !== a.id)]);
          await new Promise((r) => setTimeout(r, 600));
          setStep(3); store.set(null);
          s.toast("Analysis complete — results saved to your Skin Journey");
          return;
        }
        if (a.status === "failed") {
          s.setAssessments((list) => [a, ...list.filter((x) => x.id !== a.id)]);
          setError(a.error || "YouCam could not analyse this photo. Try a clear, front-facing, well-lit selfie.");
          setStep(1); store.set(null);
          return;
        }
        await new Promise((r) => setTimeout(r, 2500));
      }
      setError("This is taking longer than usual. Your task is saved — come back to this page in a minute to resume.");
    } catch (e) {
      setError((e as Error).message);
      if ((e as api.ApiError).status === 404) store.set(null);
      setStep(1);
    } finally { polling.current = false; }
  }

  async function submit() {
    if (!file || !consent || !actions.length) return;
    setError(""); setStep(2); setStage(0); setRecord(null);
    const ticker = window.setInterval(() => setStage((x) => Math.min(x + 1, 2)), 900);
    try {
      const a = await api.startSkinAnalysis(file, actions);
      window.clearInterval(ticker);
      setStage(3); setRecord(a);
      s.setAssessments((list) => [a, ...list]);
      await poll(a.id);
    } catch (e) {
      window.clearInterval(ticker);
      setError((e as Error).message);
      setStep(1);
    }
  }

  const result = step === 3 ? record : null;

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow"><ScanFace size={13} /> AI Skin Analysis · YouCam API</span>
          <h1 className="h1" style={{ marginTop: 10 }}>{step === 3 ? <>Your skin, <span className="grad-text">read clearly.</span></> : <>Scan your <span className="grad-text">skin.</span></>}</h1>
          <p className="lead">{step === 3 ? "Only what YouCam returned is shown — nothing is estimated or filled in." : "Selfie or photo → real YouCam scores."}</p>
        </div>
        <div className="stepper" aria-label="Progress">
          {["Capture & consent", "Analysing", "Results"].map((t, i) => (
            <div key={t} style={{ display: "contents" }}>
              {i > 0 && <span className="sep" />}
              <div className={`st ${step === i + 1 ? "on" : step > i + 1 ? "done" : ""}`}><i>{step > i + 1 ? <Check size={13} /> : i + 1}</i><span>{t}</span></div>
            </div>
          ))}
        </div>
      </div>

      {s.providerReady === false && step === 1 && (
        <div className="callout amber"><AlertCircle size={18} /><div><b>The YouCam API key isn't configured on the server.</b> Add <code>YOUCAM_API_KEY</code> to <code>server/.env</code> and restart the backend. SkinWise never substitutes simulated results.</div></div>
      )}
      {error && <div className="callout rose" role="alert"><AlertCircle size={18} /><div><b>We couldn't complete that analysis.</b> {error}</div></div>}

      {step === 1 && (
        <div className="capture">
          <div>
            {preview ? (
              <div className="preview">
                <img src={preview} alt="Your selected selfie" />
                <div className="preview-bar">
                  <span className="row" style={{ gap: 8 }}>{tooSmall ? <AlertCircle size={14} /> : <Check size={14} />}{dims ? `${dims.w} × ${dims.h}px` : "Reading…"}</span>
                  <span className="row" style={{ gap: 6 }}>
                    <button className="btn btn-sm btn-light" onClick={() => { setFile(null); void startCamera(); }}><Camera size={13} /> Retake</button>
                    <button className="btn btn-sm" style={{ color: "#fff", border: "1px solid rgba(255,255,255,.3)" }} onClick={() => { setFile(null); setConsent(false); }}><Trash2 size={13} /></button>
                  </span>
                </div>
              </div>
            ) : camOn ? (
              <div className="cam-wrap">
                <video ref={videoRef} autoPlay playsInline muted />
                <div className="oval" />
                <span className="cam-hint"><ScanFace size={13} style={{ verticalAlign: "-2px" }} /> Fill the oval with your face</span>
                {flash && <div className="flash" />}
                <div className="cam-bar">
                  <button className="icon-btn" style={{ background: "rgba(255,255,255,.2)", color: "#fff", borderColor: "transparent" }} onClick={stopCamera} aria-label="Close camera"><X size={18} /></button>
                  <button className="shutter" onClick={snap} aria-label="Take photo" />
                  <label className="icon-btn" style={{ background: "rgba(255,255,255,.2)", color: "#fff", borderColor: "transparent", cursor: "pointer" }} aria-label="Upload instead"><ImagePlus size={18} /><input hidden type="file" accept="image/jpeg,image/png" onChange={(e) => { stopCamera(); pick(e.target.files?.[0]); }} /></label>
                </div>
              </div>
            ) : (
              <div className={`capture-stage ${drag ? "drag" : ""}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}>
                <span className="oval" />
                <Sparkles className="sparkle" size={22} style={{ left: "16%", top: "14%", color: "#C4B5FD" }} />
                <Sparkles className="sparkle" size={16} style={{ right: "18%", bottom: "20%", color: "#F0ABFC", animationDelay: "1.4s" }} />
                <div className="stack" style={{ position: "relative", width: "min(460px, 90%)", gap: 18, justifyItems: "center" }}>
                  <div className="choice-grid" style={{ width: "100%" }}>
                    <button className="choice" onClick={startCamera} type="button">
                      <span className="ci-big"><Camera size={32} /></span>
                      <b>Take a selfie</b><small>Live camera</small>
                    </button>
                    <label className="choice alt">
                      <span className="ci-big"><ImagePlus size={32} /></span>
                      <b>Upload photo</b><small>JPG / PNG</small>
                      <input type="file" accept="image/jpeg,image/png" onChange={(e) => pick(e.target.files?.[0])} aria-label="Choose a selfie" />
                    </label>
                  </div>
                  <span className="tiny">or drop an image here · max 10 MB · ≥ 480px</span>
                </div>
              </div>
            )}
            {tooSmall && <p className="small" style={{ color: "var(--rose)", marginTop: 10 }}>Too small — YouCam needs ≥ 480px on the shorter side.</p>}
          </div>

          <div className="card stack" style={{ gap: 20, alignContent: "start" }}>
            <div className="row-wrap" style={{ gap: 10 }}>
              {[{ i: <UserRound size={16} />, t: "Face forward" }, { i: <Sun size={16} />, t: "Soft light" }, { i: <Glasses size={16} />, t: "No filters" }].map((x) => (
                <span key={x.t} className="chip static" style={{ height: 40 }}><span className="icon-bubble sm" style={{ width: 26, height: 26, borderRadius: 9 }}>{x.i}</span>{x.t}</span>
              ))}
            </div>
            <div className="stack-sm">
              <div className="between"><b className="h4">Measure</b><span className="tiny">{actions.length} · ~{unitsFor(actions.length)} units</span></div>
              <div className="row-wrap">
                {ANALYSIS_OPTIONS.map((o) => {
                  const on = actions.includes(o.id);
                  return <button key={o.id} type="button" className={`chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => setActions((a) => (on ? a.filter((x) => x !== o.id) : [...a, o.id]))}><MetricIcon type={o.id} size={14} />{o.label}</button>;
                })}
              </div>
            </div>
            <label className="check" style={{ padding: 14, borderRadius: 16, background: "var(--lavender-2)" }}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>Send this photo to <b>YouCam AI</b> for a cosmetic skin read. Never stored by SkinWise.</span>
            </label>
            <button className="btn btn-primary btn-lg btn-block" disabled={!file || !consent || !actions.length || tooSmall} onClick={submit}><ScanFace size={18} /> Analyse my skin</button>
            <p className="tiny row" style={{ gap: 6, justifyContent: "center" }}><Lock size={12} /> Key stays on server · photo never saved</p>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card pad-lg">
          <div className="grid-2" style={{ alignItems: "center", gap: 40 }}>
            <div className="scan-stage">
              {preview ? <img src={preview} alt="" /> : <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 40%, #6D527D, #1E1A24)" }} />}
              <div className="scan-mesh" /><div className="scan-line" />
              <i className="scan-corner tl" /><i className="scan-corner tr" /><i className="scan-corner bl" /><i className="scan-corner br" />
            </div>
            <div className="stack" style={{ gap: 22 }}>
              <div>
                <span className="eyebrow">Live status</span>
                <h2 className="h2" style={{ marginTop: 8 }}>Reading your skin…</h2>
                <p className="body" style={{ marginTop: 8 }}>This usually takes 10–40 seconds. You can leave this page — the task is saved and will resume.</p>
              </div>
              <div className="stage-list">
                {STAGES.map((t, i) => (
                  <div key={t} className={`stage-item ${i < stage ? "done" : i === stage ? "on" : ""}`}>
                    <span className="si">{i < stage ? <Check size={13} /> : i === stage ? <Loader2 size={13} className="spin" /> : null}</span>{t}
                  </div>
                ))}
              </div>
              {record?.providerTaskId && <p className="tiny">YouCam task · <code>{record.providerTaskId.slice(0, 18)}…</code></p>}
            </div>
          </div>
        </div>
      )}

      {result && <Results a={result} preview={preview} onRetake={() => { setStep(1); setFile(null); setConsent(false); setRecord(null); }} />}

      {step === 1 && s.latest && (
        <button className="card lift" style={{ display: "flex", alignItems: "center", gap: 16, textAlign: "left" }} onClick={() => { setRecord(s.latest); setStep(3); }}>
          <Ring value={averageScore(s.latest)} size={56} stroke={6} />
          <span style={{ flex: 1 }}><b className="h4">View your latest result</b><span className="small" style={{ display: "block" }}>{fmtDate(s.latest.completedAt)} · {scoredMetrics(s.latest).length} measurements</span></span>
          <ArrowRight size={16} color="var(--plum)" />
        </button>
      )}
    </section>
  );
}

function Results({ a, preview, onRetake }: { a: Assessment; preview: string; onRetake: () => void }) {
  const s = useStore();
  const avg = averageScore(a);
  const focus = focusAreas(a);
  const metrics = a.results.filter((m) => !SUMMARY_TYPES.has(m.type));
  const age = skinAge(a);
  const missing = a.actions.filter((x) => !metrics.some((m) => m.type.replace(/^hd_/, "") === x));
  return (
    <>
      <div className="result-hero">
        <div className="result-thumb">{preview ? <img src={preview} alt="Analysed selfie" /> : <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--plum)" }}><ScanFace size={36} /></div>}</div>
        <div>
          <span className="eyebrow">Analysis complete · {fmtDate(a.completedAt, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
          <h2 className="h2" style={{ marginTop: 8, fontSize: 30 }}>{focus.length ? <>Focus on <em className="grad-text" style={{ fontStyle: "normal" }}>{focus.map((f) => metricMeta(f.type).label.toLowerCase()).join(" & ")}</em></> : "A steady, balanced read"}</h2>
          <p className="body" style={{ marginTop: 8, maxWidth: 560 }}>{focus.length ? `${focus.length > 1 ? "These were" : "This was"} the lowest of the ${scoredMetrics(a).length} scores YouCam returned, in SkinWise's focus band. It now shapes your routine and shelf check.` : `None of the ${scoredMetrics(a).length} returned scores fell into the focus band (below 65). Your routine can stay simple.`}</p>
        </div>
        <div style={{ display: "grid", justifyItems: "center", gap: 10 }}><Ring value={avg} size={128} sub={providerOverall(a) !== null ? "YouCam overall" : "avg ui_score"} />{age !== null && <span className="badge" style={{ height: 28, fontSize: 12.5 }}>Skin age · {age}</span>}</div>
      </div>

      {metrics.length ? <div className="grid-3">{metrics.map((m, i) => <MetricCard key={`${m.type}-${i}`} m={m} />)}</div> : <div className="callout amber"><Info size={18} /><div>YouCam completed the task but returned no measurements for the selected concerns.</div></div>}
      {missing.length > 0 && <p className="small">Requested but not returned: {missing.map((x) => metricMeta(x).label).join(", ")} — shown as unavailable rather than estimated.</p>}

      <div className="callout"><Lightbulb size={18} /><div><b>How to read this.</b> Scores are YouCam's 0–100 <code>ui_score</code>, where higher indicates a better-looking condition. Bands (Focus / Steady / Looking good) are SkinWise's plain-language reading. Lighting, camera and angle can shift results — this is a cosmetic aid, not a medical assessment.</div></div>

      <div className="row-wrap">
        <button className="btn btn-primary btn-lg" onClick={() => s.go("routine")}>Build my routine <ArrowRight size={16} /></button>
        <button className="btn btn-ghost btn-lg" onClick={() => s.go("smart-shelf")}>Check my shelf</button>
        <button className="btn btn-ghost btn-lg" onClick={() => s.go("profile")}>View profile</button>
        <button className="btn btn-lg" style={{ color: "var(--ink-3)" }} onClick={onRetake}><RotateCcw size={15} /> New analysis</button>
      </div>
    </>
  );
}
