import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Bookmark, BookmarkCheck, Check, Columns3, Compass, Loader2, Plus, Search, X } from "lucide-react";
import { useStore } from "../store";
import * as api from "../services/api";
import type { CatalogProduct } from "../types";
import { categorize } from "../lib/engine";
import { Empty, Modal, ProductImage } from "../components/ui";
import { ProductModal } from "../components/ProductModal";
import { useSaved } from "../lib/saved";

const QUICK = ["CeraVe", "La Roche-Posay", "The Ordinary", "Cetaphil", "Neutrogena", "sunscreen", "niacinamide", "hyaluronic"];

export default function Discover({ initialQuery = "" }: { initialQuery?: string }) {
  const s = useStore();
  const saved = useSaved();
  const [q, setQ] = useState(initialQuery);
  const [last, setLast] = useState("");
  const [items, setItems] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<"results" | "saved">("results");
  const [filter, setFilter] = useState("All");
  const [detail, setDetail] = useState<CatalogProduct | null>(null);
  const [compare, setCompare] = useState<CatalogProduct[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const owned = useMemo(() => new Set(s.shelf.map((p) => p.code)), [s.shelf]);

  async function run(term = q) {
    const t = term.trim();
    if (t.length < 2) { setErr("Enter at least 2 characters — a brand, product or ingredient."); return; }
    setQ(t); setLoading(true); setErr(""); setTab("results"); setFilter("All");
    try { setItems(await api.searchCatalog(t)); setLast(t); }
    catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (initialQuery.trim().length >= 2) void run(initialQuery); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const list = tab === "saved" ? saved.saved : items;
  const cats = ["All", ...new Set(list.map((p) => categorize(p)))];
  const shown = list.filter((p) => filter === "All" || categorize(p) === filter);
  const toggleCompare = (p: CatalogProduct) => setCompare((c) => (c.some((x) => x.code === p.code) ? c.filter((x) => x.code !== p.code) : c.length >= 3 ? c : [...c, p]));

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow"><Compass size={13} /> Discover · Open Beauty Facts</span>
          <h1 className="h1" style={{ marginTop: 10 }}>Discover <span className="grad-text">real products.</span></h1>
          <p className="lead">Live Open Beauty Facts catalog.</p>
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <form className="input-group" onSubmit={(e) => { e.preventDefault(); void run(); }}>
          <label className="search" style={{ width: "auto", flex: 1, height: 50, background: "var(--ivory-2)" }}>
            <Search size={17} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a brand, product or ingredient — e.g. CeraVe, sunscreen, niacinamide" style={{ fontSize: 14 }} aria-label="Search catalog" />
          </label>
          <button className="btn btn-primary btn-lg" type="submit" disabled={loading}>{loading ? <Loader2 size={16} className="spin" /> : <Search size={16} />} Search</button>
        </form>
        <div className="row-wrap" style={{ marginTop: 14 }}>
          <span className="tiny" style={{ alignSelf: "center", marginRight: 4 }}>Try</span>
          {QUICK.map((t) => <button key={t} className="chip" onClick={() => run(t)}>{t}</button>)}
        </div>
      </div>

      <div className="between" style={{ flexWrap: "wrap" }}>
        <div className="seg">
          <button className={tab === "results" ? "on" : ""} onClick={() => { setTab("results"); setFilter("All"); }}>Results{last ? ` · ${items.length}` : ""}</button>
          <button className={tab === "saved" ? "on" : ""} onClick={() => { setTab("saved"); setFilter("All"); }}><Bookmark size={13} /> Saved · {saved.saved.length}</button>
        </div>
        {cats.length > 2 && <div className="filters">{cats.map((c) => <button key={c} className={`chip ${filter === c ? "on" : ""}`} onClick={() => setFilter(c)}>{c}</button>)}</div>}
      </div>

      {err && <div className="callout rose"><AlertCircle size={18} /><div>{err}</div></div>}
      {loading ? (
        <div className="product-grid">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="pcard"><div className="skeleton" style={{ aspectRatio: "1", borderRadius: 0 }} /><div className="pbody"><div className="skeleton" style={{ height: 12, width: "40%" }} /><div className="skeleton" style={{ height: 16 }} /></div></div>)}</div>
      ) : shown.length ? (
        <div className="product-grid">
          {shown.map((p) => {
            const isOwned = owned.has(p.code); const inCmp = compare.some((x) => x.code === p.code);
            return (
              <article key={p.code} className="pcard">
                <ProductImage src={p.imageUrl} alt={`${p.brand} ${p.name}`}>
                  <div className="corner">
                    <span className="badge" style={{ background: "rgba(255,255,255,.92)" }}>{categorize(p)}</span>
                    {isOwned ? <span className="badge good"><Check size={11} /> Owned</span> : (
                      <button className="icon-btn sm" onClick={() => saved.toggle(p)} aria-label={saved.isSaved(p.code) ? "Unsave" : "Save"}>{saved.isSaved(p.code) ? <BookmarkCheck size={14} color="var(--plum)" /> : <Bookmark size={14} />}</button>
                    )}
                  </div>
                  {!isOwned && <button className="fab-plus" onClick={() => setDetail(p)} aria-label={`Add ${p.name}`}><Plus size={18} /></button>}
                </ProductImage>
                <div className="pbody">
                  <span className="pbrand">{p.brand}</span>
                  <h3 className="pname">{p.name}</h3>
                  <span className="pmeta">{p.quantity || "Size unavailable"} · {p.ingredients ? "Ingredients listed" : "No ingredient list"}</span>
                </div>
                <div className="pfoot">
                  <button className="btn btn-soft btn-sm" onClick={() => setDetail(p)}>Details</button>
                  <button className={`btn btn-sm ${inCmp ? "btn-dark" : "btn-ghost"}`} onClick={() => toggleCompare(p)} disabled={!inCmp && compare.length >= 3}>{inCmp ? <Check size={13} /> : <Columns3 size={13} />} Compare</button>
                </div>
              </article>
            );
          })}
        </div>
      ) : tab === "saved" ? (
        <Empty icon={<Bookmark size={26} />} title="Nothing saved yet" body="Save catalog products from search or Skin-to-Shelf recommendations to revisit them here." />
      ) : last ? (
        <Empty icon={<Search size={26} />} title={`No catalog match for “${last}”`} body="Try a brand name, a shorter product name, or an ingredient. Open Beauty Facts is community-maintained, so some products aren't listed yet." />
      ) : (
        <Empty icon={<Compass size={26} />} title="Start with a brand or ingredient" body="Search results show the real catalog photo when one exists — otherwise a neutral placeholder, never an unrelated stock image." />
      )}

      {compare.length > 0 && (
        <div className="compare-bar">
          <span>{compare.length} of 3 selected</span>
          <button className="btn btn-sm" style={{ color: "#fff" }} onClick={() => setCompare([])}><X size={13} /> Clear</button>
          <button className="btn btn-light btn-sm" disabled={compare.length < 2} onClick={() => setShowCompare(true)}><Columns3 size={13} /> Compare</button>
        </div>
      )}

      {detail && <ProductModal product={detail} onClose={() => setDetail(null)} />}
      {showCompare && (
        <Modal wide onClose={() => setShowCompare(false)}>
          <div style={{ padding: 28, overflowX: "auto" }}>
            <span className="eyebrow">Side by side</span>
            <h2 className="h2" style={{ margin: "6px 0 18px" }}>Compare products</h2>
            <table className="compare-table">
              <tbody>
                <tr><th></th>{compare.map((p) => <td key={p.code} style={{ width: `${90 / compare.length}%` }}><div style={{ width: 120, borderRadius: 14, overflow: "hidden", border: "1px solid var(--line-2)" }}><ProductImage src={p.imageUrl} alt={p.name} /></div></td>)}</tr>
                <tr><th>Product</th>{compare.map((p) => <td key={p.code}><span className="pbrand">{p.brand}</span><div style={{ fontWeight: 600, marginTop: 4 }}>{p.name}</div></td>)}</tr>
                <tr><th>Role</th>{compare.map((p) => <td key={p.code}>{categorize(p)}</td>)}</tr>
                <tr><th>Size</th>{compare.map((p) => <td key={p.code}>{p.quantity || <span className="muted">Unavailable</span>}</td>)}</tr>
                <tr><th>Price</th>{compare.map((p) => <td key={p.code}><span className="muted">Unavailable in catalog</span></td>)}</tr>
                <tr><th>Fragrance</th>{compare.map((p) => <td key={p.code}>{!p.ingredients ? <span className="muted">Unknown</span> : /parfum|fragrance/i.test(p.ingredients) ? "Listed" : "Not listed"}</td>)}</tr>
                <tr><th>On your shelf</th>{compare.map((p) => <td key={p.code}>{owned.has(p.code) ? <span className="badge good">Owned</span> : "No"}</td>)}</tr>
                <tr><th>Ingredients</th>{compare.map((p) => <td key={p.code}><div className="ingredients" style={{ maxHeight: 180, fontSize: 11.5 }}>{p.ingredients || "Unavailable"}</div></td>)}</tr>
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </section>
  );
}
