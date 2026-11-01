import { useMemo, useState } from "react";
import { AlertCircle, CalendarClock, ExternalLink, Loader2, Package, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useStore } from "../store";
import * as api from "../services/api";
import type { CatalogProduct, RoutineCategory, ShelfProduct } from "../types";
import { ROUTINE_CATEGORIES, categorize, fmtDate, money } from "../lib/engine";
import { Empty, Meter, Modal, ProductImage } from "../components/ui";
import { ProductModal } from "../components/ProductModal";

export default function MyProducts() {
  const s = useStore();
  const [filter, setFilter] = useState("All");
  const [adding, setAdding] = useState(s.shelf.length === 0);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [pick, setPick] = useState<CatalogProduct | null>(null);
  const [edit, setEdit] = useState<ShelfProduct | null>(null);

  const cats = useMemo(() => ["All", ...new Set(s.shelf.map((p) => categorize(p)))], [s.shelf]);
  const shown = s.shelf.filter((p) => filter === "All" || categorize(p) === filter);
  const owned = new Set(s.shelf.map((p) => p.code));
  const inRoutine = (id: string) => (s.routine ? [...s.routine.AM.steps.map((x) => ({ ...x, t: "AM" })), ...s.routine.PM.steps.map((x) => ({ ...x, t: "PM" }))].filter((x) => x.productId === id).map((x) => x.t) : []);

  async function search() {
    if (q.trim().length < 2) return setErr("Enter at least 2 characters.");
    setLoading(true); setErr("");
    try { setResults(await api.searchCatalog(q.trim())); }
    catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow"><Package size={13} /> Your vanity shelf</span>
          <h1 className="h1" style={{ marginTop: 10 }}>My <span className="grad-text">shelf.</span></h1>
          <p className="lead">What you own, barcode-verified.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding((a) => !a)}>{adding ? <X size={15} /> : <Plus size={15} />} {adding ? "Close" : "Add a product"}</button>
      </div>

      {adding && (
        <div className="card tint-lav">
          <h3 className="h3">Find the exact product you own</h3>
          <p className="small" style={{ margin: "4px 0 14px" }}>Search by brand or name, then confirm. Duplicates are blocked by barcode.</p>
          <form className="input-group" onSubmit={(e) => { e.preventDefault(); void search(); }}>
            <input className="input" style={{ height: 48, background: "#fff" }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. CeraVe Hydrating Cleanser" aria-label="Search catalog" />
            <button className="btn btn-primary btn-lg" type="submit" disabled={loading}>{loading ? <Loader2 size={16} className="spin" /> : <Search size={16} />} Search</button>
          </form>
          {err && <p className="small" style={{ color: "var(--rose)", marginTop: 10 }}>{err}</p>}
          {results.length > 0 && (
            <div className="stack-sm" style={{ marginTop: 14, maxHeight: 360, overflowY: "auto" }}>
              {results.map((r) => (
                <button key={r.code} className="cov-item" style={{ textAlign: "left", gridTemplateColumns: "48px minmax(0,1fr) auto" }} onClick={() => setPick(r)} disabled={owned.has(r.code)}>
                  <span style={{ width: 48, height: 48, borderRadius: 12, overflow: "hidden", border: "1px solid var(--line-2)" }}><ProductImage src={r.imageUrl} alt="" /></span>
                  <span style={{ minWidth: 0 }}><b>{r.name}</b><small>{r.brand} · {categorize(r)} · {r.code}</small></span>
                  {owned.has(r.code) ? <span className="badge good">On shelf</span> : <span className="link">Select</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {s.shelf.length > 0 && <div className="filters">{cats.map((c) => <button key={c} className={`chip ${filter === c ? "on" : ""}`} onClick={() => setFilter(c)}>{c} {c === "All" ? s.shelf.length : s.shelf.filter((p) => categorize(p) === c).length}</button>)}</div>}

      {!s.ready ? null : s.shelf.length === 0 ? (
        <Empty icon={<Package size={28} />} title="Your shelf starts with what you already own" body="Add the cleanser, moisturiser and sunscreen you use today. SkinWise will never seed fake products or recommend duplicates of what's here." action={!adding ? <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={15} /> Add my first product</button> : undefined} />
      ) : (
        <div className="product-grid">
          {shown.map((p) => {
            const uses = inRoutine(p.id);
            const exp = p.expiryDate ? Date.parse(p.expiryDate) : null;
            const soon = exp !== null && exp - Date.now() < 30 * 864e5;
            return (
              <article key={p.id} className="pcard">
                <ProductImage src={p.imageUrl} alt={`${p.brand} ${p.name} packaging`}>
                  <div className="corner">
                    <span className="badge" style={{ background: "rgba(255,255,255,.92)" }}>{categorize(p)}</span>
                    <button className="icon-btn sm" onClick={() => setEdit(p)} aria-label={`Edit ${p.name}`}><Pencil size={13} /></button>
                  </div>
                </ProductImage>
                <div className="pbody">
                  <span className="pbrand">{p.brand}</span>
                  <h3 className="pname">{p.name}</h3>
                  <div className="row-wrap" style={{ gap: 6, margin: "4px 0" }}>
                    {uses.length ? [...new Set(uses)].map((t) => <span key={t} className="badge good">{t} routine</span>) : <span className="badge na">Not in routine</span>}
                    {p.expiryDate && <span className={`badge ${soon ? "amber" : "na"}`}><CalendarClock size={11} /> {exp! < Date.now() ? "Expired" : `Exp ${fmtDate(p.expiryDate, { month: "short", year: "numeric" })}`}</span>}
                  </div>
                  <div className="between tiny" style={{ marginTop: 6 }}><span>Remaining</span><b style={{ color: "var(--ink-2)" }}>{p.remaining}%</b></div>
                  <Meter value={p.remaining} />
                  <div className="between tiny" style={{ marginTop: 8 }}><span>{p.price !== null && p.price !== undefined ? `Paid ${money(p.price)}` : "Price not recorded"}</span>{p.productUrl && <a href={p.productUrl} target="_blank" rel="noreferrer" className="link" style={{ fontSize: 11 }}>Source <ExternalLink size={11} /></a>}</div>
                  {p.notes && <p className="tiny italic" style={{ marginTop: 4 }}>“{p.notes}”</p>}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {pick && <ProductModal product={pick} onClose={() => { setPick(null); setResults([]); setQ(""); }} />}
      {edit && <EditProduct p={edit} onClose={() => setEdit(null)} used={inRoutine(edit.id).length} />}
    </section>
  );
}

function EditProduct({ p, onClose, used }: { p: ShelfProduct; onClose: () => void; used: number }) {
  const s = useStore();
  const [f, setF] = useState({ routineCategory: categorize(p) as RoutineCategory, routineUsage: p.routineUsage || [], expiryDate: p.expiryDate || "", notes: p.notes || "", remaining: p.remaining, price: p.price ?? "" as number | "" });
  const [confirm, setConfirm] = useState(false);
  async function save() {
    try {
      const saved = await api.updateShelfProduct(p.id, { ...f, expiryDate: f.expiryDate || null, price: f.price === "" ? null : Number(f.price) });
      s.setShelf((list) => list.map((x) => (x.id === p.id ? saved : x)));
      s.toast("Product updated"); onClose();
    } catch (e) { s.toast((e as Error).message, true); }
  }
  return (
    <Modal onClose={onClose}>
      <div className="modal-grid">
        <ProductImage src={p.imageUrl} alt={p.name} />
        <div className="stack" style={{ padding: 28, gap: 14 }}>
          <div><span className="pbrand">{p.brand}</span><h2 className="h3" style={{ marginTop: 6, paddingRight: 30 }}>{p.name}</h2><p className="tiny" style={{ marginTop: 4 }}>Added {fmtDate(p.addedAt)} · Barcode {p.code}</p></div>
          <div className="grid-2" style={{ gap: 10 }}>
            <label className="field"><span>Routine role</span><select className="select" value={f.routineCategory} onChange={(e) => setF({ ...f, routineCategory: e.target.value as RoutineCategory })}>{ROUTINE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="field"><span>Expiry date</span><input className="input" type="date" value={f.expiryDate} onChange={(e) => setF({ ...f, expiryDate: e.target.value })} /></label>
            <label className="field"><span>Remaining · {f.remaining}%</span><input type="range" min={0} max={100} step={5} value={f.remaining} onChange={(e) => setF({ ...f, remaining: Number(e.target.value) })} style={{ accentColor: "var(--plum)" }} /></label>
            <label className="field"><span>Price paid (₹)</span><input className="input" type="number" min={0} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value === "" ? "" : Number(e.target.value) })} /></label>
          </div>
          <div className="row" style={{ gap: 8 }}>{(["AM", "PM"] as const).map((t) => { const on = f.routineUsage.includes(t); return <button key={t} className={`chip ${on ? "on" : ""}`} onClick={() => setF({ ...f, routineUsage: on ? f.routineUsage.filter((x) => x !== t) : [...f.routineUsage, t] })}>{t === "AM" ? "Morning" : "Evening"}</button>; })}</div>
          <label className="field"><span>Notes</span><textarea className="textarea" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="How does it feel on your skin?" /></label>
          {confirm ? (
            <div className="callout rose"><AlertCircle size={18} /><div><b>Remove from shelf?</b> {used ? `It's assigned to ${used} routine step${used > 1 ? "s" : ""}; they'll become unassigned.` : ""}<div className="row" style={{ marginTop: 10 }}><button className="btn btn-danger btn-sm" onClick={async () => { await s.removeProduct(p); onClose(); }}>Yes, remove</button><button className="btn btn-ghost btn-sm" onClick={() => setConfirm(false)}>Keep</button></div></div></div>
          ) : (
            <div className="between"><button className="btn btn-danger btn-sm" onClick={() => setConfirm(true)}><Trash2 size={13} /> Remove</button><button className="btn btn-primary" onClick={save}>Save changes</button></div>
          )}
        </div>
      </div>
    </Modal>
  );
}
