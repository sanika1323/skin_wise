import { useState } from "react";
import { Check, ExternalLink, Plus } from "lucide-react";
import { useStore } from "../store";
import * as api from "../services/api";
import type { CatalogProduct, RoutineCategory } from "../types";
import { ROUTINE_CATEGORIES, categorize } from "../lib/engine";
import { Modal, ProductImage, highlight } from "./ui";

/** Catalog product detail + "I own this" save form. Only catalog-sourced fields are displayed. */
export function ProductModal({ product, onClose, keywords = [], defaultCategory, reason }: { product: CatalogProduct; onClose: () => void; keywords?: string[]; defaultCategory?: RoutineCategory; reason?: string }) {
  const s = useStore();
  const owned = s.shelf.some((p) => p.code === product.code);
  const [category, setCategory] = useState<RoutineCategory>(defaultCategory || categorize(product));
  const [usage, setUsage] = useState<("AM" | "PM")[]>(category === "Sunscreen" ? ["AM"] : ["AM", "PM"]);
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const saved = await api.addShelfProduct({ code: product.code, routineCategory: category, routineUsage: usage, price: price === "" ? null : Number(price) });
      s.setShelf((list) => [saved, ...list]);
      s.toast(`${saved.name} added to My Products — coverage refreshed`);
      onClose();
    } catch (e) { s.toast((e as Error).message, true); }
    finally { setSaving(false); }
  }

  return (
    <Modal onClose={onClose}>
      <div className="modal-grid">
        <ProductImage src={product.imageUrl} alt={`${product.brand} ${product.name}`} />
        <div className="stack" style={{ padding: 28, gap: 16 }}>
          <div>
            <span className="pbrand">{product.brand}</span>
            <h2 className="h2" style={{ marginTop: 6, paddingRight: 30 }}>{product.name}</h2>
            <p className="small" style={{ marginTop: 6 }}>{product.category || "Category unavailable"}{product.quantity ? ` · ${product.quantity}` : ""} · Barcode {product.code}</p>
          </div>
          {reason && <div className="callout" style={{ padding: "12px 14px" }}><span>{reason}</span></div>}
          <div className="stack-sm">
            <div className="between"><b className="h4">Ingredients</b><span className="tiny">Source: {product.source}</span></div>
            {product.ingredients ? <div className="ingredients">{highlight(product.ingredients, keywords)}</div> : <p className="small">Ingredients unavailable in the catalog record.</p>}
          </div>
          <div className="row-wrap" style={{ alignItems: "center" }}>
            <span className="badge na">Price unavailable in catalog</span>
            {product.productUrl && <a className="link" href={product.productUrl} target="_blank" rel="noreferrer">Open Beauty Facts <ExternalLink size={13} /></a>}
          </div>
          <hr className="divider" />
          {owned ? (
            <div className="callout sage"><Check size={18} /><div><b>Already on your shelf.</b> SkinWise won't recommend buying it again.</div></div>
          ) : (
            <div className="stack-sm">
              <b className="h4">Save to My Products</b>
              <div className="grid-2" style={{ gap: 10 }}>
                <label className="field"><span>Routine role</span><select className="select" value={category} onChange={(e) => setCategory(e.target.value as RoutineCategory)}>{ROUTINE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
                <label className="field"><span>Price paid (₹, optional)</span><input className="input" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="—" /></label>
              </div>
              <div className="row" style={{ gap: 8 }}>
                {(["AM", "PM"] as const).map((t) => { const on = usage.includes(t); return <button key={t} className={`chip ${on ? "on" : ""}`} onClick={() => setUsage((u) => (on ? u.filter((x) => x !== t) : [...u, t]))}>{on && <Check size={12} />}{t === "AM" ? "Morning" : "Evening"}</button>; })}
              </div>
              <button className="btn btn-primary btn-block" onClick={save} disabled={saving}><Plus size={15} /> {saving ? "Verifying barcode…" : "I own this — add to shelf"}</button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
