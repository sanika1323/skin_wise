/**
 * SkinWise intelligence layer — transparent, rule-based, and data-honest.
 * Nothing here invents a metric, price or product. Every output can be traced
 * to (a) a YouCam-returned metric, (b) a user-entered profile field, or
 * (c) a catalog record from Open Beauty Facts.
 */
import type { Assessment, CatalogProduct, Profile, RoutineCategory, RoutineStep, ShelfProduct, SkinMetric } from "../types";

/* ------------------------------------------------------------------ metrics */
export type MetricMeta = { label: string; blurb: string; hue: string; focus: RoutineCategory; keywords: string[]; role: string; query: string };

export const METRICS: Record<string, MetricMeta> = {
  moisture:       { label: "Moisture",        blurb: "How hydrated the skin surface appears.",              hue: "#8B5CF6", focus: "Serum",     role: "Hydrating serum",       query: "hyaluronic serum",   keywords: ["hyaluronic", "glycerin", "ceramide", "squalane", "panthenol", "urea"] },
  redness:        { label: "Redness",         blurb: "Visible redness and uneven tone.",                     hue: "#EC4899", focus: "Treatment", role: "Soothing treatment",    query: "centella",           keywords: ["centella", "madecassoside", "allantoin", "panthenol", "bisabolol", "oat", "niacinamide"] },
  acne:           { label: "Blemishes",       blurb: "Visible breakouts and blemish appearance.",            hue: "#F97316", focus: "Treatment", role: "Clarifying treatment",  query: "salicylic acid",     keywords: ["salicylic", "niacinamide", "zinc", "azelaic"] },
  pore:           { label: "Pores",           blurb: "How visible pores appear.",                            hue: "#A855F7", focus: "Serum",     role: "Pore-refining serum",   query: "niacinamide serum",  keywords: ["niacinamide", "salicylic", "zinc"] },
  oiliness:       { label: "Oil balance",     blurb: "Shine and visible surface oil.",                       hue: "#EAB308", focus: "Serum",     role: "Balancing serum",       query: "niacinamide",        keywords: ["niacinamide", "zinc", "salicylic"] },
  texture:        { label: "Texture",         blurb: "Smoothness and evenness of the skin surface.",         hue: "#14B8A6", focus: "Exfoliant", role: "Gentle exfoliant",      query: "exfoliating toner",  keywords: ["lactic", "gluconolactone", "mandelic", "salicylic", "glycolic"] },
  radiance:       { label: "Radiance",        blurb: "Overall luminosity of the complexion.",                hue: "#F59E0B", focus: "Serum",     role: "Brightening serum",     query: "vitamin c serum",    keywords: ["ascorbic", "vitamin c", "niacinamide", "licorice", "tranexamic"] },
  age_spot:       { label: "Spots",           blurb: "Visible spots and uneven pigmentation.",               hue: "#D97706", focus: "Serum",     role: "Tone-evening serum",    query: "vitamin c serum",    keywords: ["ascorbic", "niacinamide", "tranexamic", "arbutin", "azelaic"] },
  wrinkle:        { label: "Fine lines",      blurb: "Visibility of lines and wrinkles.",                    hue: "#7C3AED", focus: "Treatment", role: "Renewal treatment",     query: "retinol",            keywords: ["retinol", "retinal", "peptide", "bakuchiol"] },
  firmness:       { label: "Firmness",        blurb: "Apparent elasticity and firmness.",                    hue: "#0EA5E9", focus: "Treatment", role: "Firming treatment",     query: "peptide serum",      keywords: ["peptide", "retinol", "bakuchiol"] },
  eye_bag:        { label: "Eye bags",        blurb: "Puffiness around the under-eye area.",                 hue: "#6366F1", focus: "Eye care",  role: "Eye cream",             query: "eye cream",          keywords: ["caffeine", "peptide"] },
  dark_circle_v2: { label: "Dark circles",    blurb: "Under-eye darkness.",                                  hue: "#8B5CF6", focus: "Eye care",  role: "Eye cream",             query: "eye cream",          keywords: ["caffeine", "niacinamide", "vitamin c", "peptide"] },
  skin_type:      { label: "Skin type",       blurb: "Provider's skin-type classification.",                 hue: "#A78BFA", focus: "Moisturizer", role: "Moisturizer",        query: "face moisturizer",   keywords: [] },
};

export const ANALYSIS_OPTIONS: { id: string; label: string; recommended?: boolean }[] = [
  { id: "moisture", label: "Moisture", recommended: true },
  { id: "redness", label: "Redness", recommended: true },
  { id: "texture", label: "Texture", recommended: true },
  { id: "pore", label: "Pores", recommended: true },
  { id: "acne", label: "Blemishes" },
  { id: "oiliness", label: "Oil balance" },
  { id: "radiance", label: "Radiance" },
  { id: "wrinkle", label: "Fine lines" },
  { id: "age_spot", label: "Spots" },
  { id: "dark_circle_v2", label: "Dark circles" },
  { id: "eye_bag", label: "Eye bags" },
  { id: "firmness", label: "Firmness" },
];

export const metricMeta = (type: string): MetricMeta =>
  METRICS[type.replace(/^hd_/, "")] || { label: titleCase(type.replace(/^hd_/, "").replaceAll("_", " ")), blurb: "Returned by YouCam.", hue: "#8B7AA8", focus: "Other", role: "", query: "", keywords: [] };

export const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/** Score shown to the user — ui_score only; raw scores stay visible as secondary detail. */
export const displayScore = (m: SkinMetric) => (m.uiScore !== null ? Math.round(m.uiScore) : null);

/** SkinWise's plain-language band for YouCam's 0–100 ui_score (higher = better condition). */
export function band(score: number | null): { label: string; tone: "good" | "mid" | "focus" | "na" } {
  if (score === null) return { label: "Not returned", tone: "na" };
  if (score >= 80) return { label: "Looking good", tone: "good" };
  if (score >= 65) return { label: "Steady", tone: "mid" };
  return { label: "Focus area", tone: "focus" };
}

export const scoredMetrics = (a?: Assessment | null) =>
  (a?.results || []).filter((m) => displayScore(m) !== null && m.type !== "skin_type");

/** Lowest returned scores in the "Focus area" band (< 65), at most two. */
export function focusAreas(a?: Assessment | null): SkinMetric[] {
  return scoredMetrics(a)
    .filter((m) => band(displayScore(m)).tone === "focus")
    .sort((x, y) => (displayScore(x) ?? 0) - (displayScore(y) ?? 0))
    .slice(0, 2);
}

export function averageScore(a?: Assessment | null): number | null {
  const s = scoredMetrics(a).map((m) => displayScore(m) as number);
  return s.length ? Math.round(s.reduce((x, y) => x + y, 0) / s.length) : null;
}

/* --------------------------------------------------------------- categories */
export const ROUTINE_CATEGORIES: RoutineCategory[] = ["Cleanser", "Toner", "Serum", "Treatment", "Exfoliant", "Moisturizer", "Sunscreen", "Eye care", "Mask", "Other"];

const CATEGORY_RULES: [RoutineCategory, RegExp][] = [
  ["Sunscreen", /\b(spf|sunscreen|sun ?screen|sun ?cream|solaire|sunblock|uv ?protect)/i],
  ["Eye care", /\b(eye|yeux|contour)/i],
  ["Cleanser", /(cleans|face ?wash|facial wash|nettoyant|micellar|démaquill|demaquill|foaming|wash gel)/i],
  ["Exfoliant", /(exfoli|peel|scrub|gommage|\baha\b|\bbha\b)/i],
  ["Mask", /\b(mask|masque)/i],
  ["Toner", /(toner|tonique|tonic|essence water)/i],
  ["Serum", /(serum|sérum|ampoule|essence|booster)/i],
  ["Treatment", /(retinol|spot treatment|acne|treatment|niacinamide)/i],
  ["Moisturizer", /(moistur|cream|crème|creme|lotion|hydrat|emulsion|balm|gel-cream|gel cream)/i],
];

export function categorize(p: Pick<ShelfProduct, "name" | "category"> & { routineCategory?: RoutineCategory | null }): RoutineCategory {
  if (p.routineCategory) return p.routineCategory;
  const hay = `${p.name} ${p.category}`;
  for (const [cat, re] of CATEGORY_RULES) if (re.test(hay)) return cat;
  return "Other";
}

const CATEGORY_QUERY: Record<RoutineCategory, string> = {
  Cleanser: "facial cleanser", Toner: "toner", Serum: "serum", Treatment: "niacinamide",
  Exfoliant: "exfoliant", Moisturizer: "face moisturizer", Sunscreen: "sunscreen spf 50",
  "Eye care": "eye cream", Mask: "face mask", Other: "skincare",
};

export const CATEGORY_HOWTO: Record<RoutineCategory, string> = {
  Cleanser: "Massage onto damp skin for 30–60 seconds, then rinse with lukewarm water.",
  Toner: "Pat a few drops into skin with clean hands after cleansing.",
  Serum: "Press 2–3 drops into slightly damp skin before moisturizer.",
  Treatment: "Apply a thin layer to dry skin. Introduce slowly and patch-test new actives.",
  Exfoliant: "Use 1–3 evenings a week only. Skip on nights you use other strong actives.",
  Moisturizer: "Warm a small amount between fingertips and press gently into skin.",
  Sunscreen: "Apply generously as the final morning step; reapply when outdoors.",
  "Eye care": "Tap a rice-grain amount around the orbital bone with your ring finger.",
  Mask: "Use as directed on the pack, typically 1–2 times a week.",
  Other: "Use as directed on the product packaging.",
};

/* ------------------------------------------------------------ needs/coverage */
export type Need = {
  category: RoutineCategory;
  role: string;
  reason: string;
  source: "core" | "assessment" | "goal";
  keywords: string[];
  query: string;
  times: ("AM" | "PM")[];
  optional: boolean;
};

const GOAL_HINTS: { re: RegExp; metric: string }[] = [
  { re: /hydrat|dry|dehydrat|barrier|moist/i, metric: "moisture" },
  { re: /red|calm|sooth|sensitiv/i, metric: "redness" },
  { re: /acne|breakout|blemish|clear/i, metric: "acne" },
  { re: /pore/i, metric: "pore" },
  { re: /oil|shine/i, metric: "oiliness" },
  { re: /texture|smooth/i, metric: "texture" },
  { re: /glow|radian|bright|dull/i, metric: "radiance" },
  { re: /spot|pigment|even tone|dark spot/i, metric: "age_spot" },
  { re: /line|wrinkle|aging|ageing|firm/i, metric: "wrinkle" },
  { re: /eye|dark circle|puff/i, metric: "dark_circle_v2" },
];

export function deriveNeeds(profile: Profile | null, assessment: Assessment | null): Need[] {
  const needs: Need[] = [
    { category: "Cleanser", role: "Cleanser", reason: "A gentle cleanse is the foundation of both routines.", source: "core", keywords: [], query: CATEGORY_QUERY.Cleanser, times: ["AM", "PM"], optional: false },
    { category: "Moisturizer", role: "Moisturizer", reason: "Supports the skin barrier morning and night.", source: "core", keywords: [], query: CATEGORY_QUERY.Moisturizer, times: ["AM", "PM"], optional: false },
    { category: "Sunscreen", role: "Daily sunscreen", reason: "Daytime UV protection belongs in every morning routine.", source: "core", keywords: [], query: CATEGORY_QUERY.Sunscreen, times: ["AM"], optional: false },
  ];
  const minimal = profile?.preferences?.minimalRoutine;
  const add = (metric: string, source: Need["source"], reason: string) => {
    const meta = METRICS[metric];
    if (!meta || meta.focus === "Moisturizer") return;
    if (needs.some((n) => n.category === meta.focus)) {
      const n = needs.find((x) => x.category === meta.focus)!;
      n.keywords = [...new Set([...n.keywords, ...meta.keywords])];
      return;
    }
    const pmOnly = ["Treatment", "Exfoliant"].includes(meta.focus);
    needs.push({ category: meta.focus, role: meta.role, reason, source, keywords: meta.keywords, query: meta.query, times: pmOnly ? ["PM"] : meta.focus === "Eye care" ? ["PM"] : ["AM", "PM"], optional: true });
  };
  for (const m of focusAreas(assessment)) {
    const key = m.type.replace(/^hd_/, "");
    add(key, "assessment", `Your ${metricMeta(key).label.toLowerCase()} score was ${displayScore(m)}/100 — one of the lowest in your latest YouCam assessment.`);
  }
  for (const g of profile?.goals || []) {
    const hit = GOAL_HINTS.find((h) => h.re.test(g));
    if (hit) add(hit.metric, "goal", `You set the goal “${g}”.`);
  }
  if (minimal) return needs.filter((n) => !n.optional).concat(needs.filter((n) => n.optional).slice(0, 1));
  return needs.filter((n) => !n.optional).concat(needs.filter((n) => n.optional).slice(0, 3));
}

export type Coverage = {
  needs: Need[];
  covered: { need: Need; products: ShelfProduct[] }[];
  missing: Need[];
  percent: number;
  noPurchaseNeeded: boolean;
};

export function computeCoverage(needs: Need[], shelf: ShelfProduct[]): Coverage {
  const covered: Coverage["covered"] = [];
  const missing: Need[] = [];
  for (const need of needs) {
    const products = shelf.filter((p) => categorize(p) === need.category && p.remaining > 0);
    if (products.length) covered.push({ need, products }); else missing.push(need);
  }
  const percent = needs.length ? Math.round((covered.length / needs.length) * 100) : 0;
  return { needs, covered, missing, percent, noPurchaseNeeded: missing.length === 0 };
}

/* --------------------------------------------------------------- routines */
export function generateRoutine(needs: Need[], shelf: ShelfProduct[]): { AM: RoutineStep[]; PM: RoutineStep[] } {
  const order: RoutineCategory[] = ["Cleanser", "Toner", "Exfoliant", "Serum", "Treatment", "Eye care", "Moisturizer", "Sunscreen"];
  const build = (time: "AM" | "PM") =>
    needs
      .filter((n) => n.times.includes(time))
      .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category))
      .map((n, i): RoutineStep => {
        const candidates = shelf.filter((p) => categorize(p) === n.category && p.remaining > 0);
        const owned = candidates.find((p) => p.routineUsage?.includes(time)) || candidates[0];
        return {
          id: `${time}-${n.category}-${i}`.toLowerCase().replace(/\s+/g, "-"),
          productId: owned?.id ?? null,
          category: n.category,
          name: n.role,
          instructions: CATEGORY_HOWTO[n.category],
          frequency: n.category === "Exfoliant" ? "2–3× weekly" : "Daily",
          reason: n.reason,
          optional: n.optional,
          sortOrder: i,
        };
      });
  return { AM: build("AM"), PM: build("PM") };
}

/* ---------------------------------------------------------- recommendations */
const FRAGRANCE_RE = /\b(parfum|fragrance|perfume|linalool|limonene|citronellol|geraniol)\b/i;

export type Ranked = {
  product: CatalogProduct;
  score: number | null;
  components: { key: "G" | "P" | "B" | "I"; label: string; value: number | null; weight: number; note: string }[];
  matched: string[];
  flags: string[];
};

/** Score = 0.35G + 0.25P + 0.20B + 0.20I — components with no data are excluded and weights renormalised. */
export function rankCandidates(need: Need, items: CatalogProduct[], profile: Profile | null, ownedCodes: Set<string>): Ranked[] {
  const ranked = rankAll(need, items, profile, ownedCodes);
  // Only show products that actually belong to the missing step when any exist.
  const inCategory = ranked.filter((r) => r.components[3].value === 100);
  return inCategory.length ? inCategory : ranked;
}

function rankAll(need: Need, items: CatalogProduct[], profile: Profile | null, ownedCodes: Set<string>): Ranked[] {
  const avoid = (profile?.avoidIngredients || []).map((x) => x.toLowerCase()).filter(Boolean);
  const wantFF = Boolean(profile?.preferences?.fragranceFree);
  return items
    .filter((p) => !ownedCodes.has(p.code))
    .map((product): Ranked => {
      const ing = (product.ingredients || "").toLowerCase();
      const hasIng = ing.trim().length > 10;
      const matched = need.keywords.filter((k) => ing.includes(k));
      const cat = categorize({ name: product.name, category: product.category });
      const flags: string[] = [];
      let P: number | null = null;
      if (hasIng && (wantFF || avoid.length)) {
        let ok = 100;
        if (wantFF && FRAGRANCE_RE.test(ing)) { ok -= 60; flags.push("Lists fragrance components"); }
        const hit = avoid.filter((a) => ing.includes(a));
        if (hit.length) { ok -= 40; flags.push(`Contains ${hit.join(", ")}`); }
        P = Math.max(0, ok);
      }
      const G = !hasIng ? null : need.keywords.length ? Math.round((Math.min(matched.length, 3) / Math.min(need.keywords.length, 3)) * 100) : null;
      const I = cat === need.category ? 100 : 40;
      const components: Ranked["components"] = [
        { key: "G", label: "Goal match", value: G, weight: 0.35, note: G === null ? (hasIng ? "No goal keywords for this step" : "Ingredients unavailable") : matched.length ? `Lists ${matched.join(", ")}` : "No goal-linked ingredients found" },
        { key: "P", label: "Preferences", value: P, weight: 0.25, note: P === null ? (hasIng ? "No preferences set" : "Ingredients unavailable") : flags.length ? flags.join("; ") : "Meets your stated preferences" },
        { key: "B", label: "Budget fit", value: null, weight: 0.2, note: "Catalog has no reliable price" },
        { key: "I", label: "Fills the gap", value: I, weight: 0.2, note: cat === need.category ? `Catalogued as ${need.category.toLowerCase()}` : `Category unclear (${product.category || "unlabelled"})` },
      ];
      const present = components.filter((c) => c.value !== null);
      const wsum = present.reduce((s, c) => s + c.weight, 0);
      // Don't score when the goal component is unknown for a goal-driven step, or when only one input is available.
      const enough = present.length >= 2 && !(need.keywords.length && G === null);
      const score = enough && wsum ? Math.round(present.reduce((s, c) => s + (c.value as number) * c.weight, 0) / wsum) : null;
      return { product, score, components, matched, flags };
    })
    .sort((a, b) => (b.components[3].value! - a.components[3].value!) || ((b.score ?? -1) - (a.score ?? -1)) || (b.matched.length - a.matched.length));
}

/* ------------------------------------------------------------------ helpers */
export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const fmtDate = (iso?: string | null, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) =>
  iso ? new Date(iso).toLocaleDateString(undefined, opts) : "—";
export const money = (v: number | null | undefined, currency = "INR") =>
  v === null || v === undefined ? "Price unavailable" : new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
export const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };
export const latestCompleted = (list: Assessment[]) => list.find((a) => a.status === "completed") || null;
