/**
 * SkinWise AI product recommendations with live Indian prices.
 *
 * Source of products + prices: Pricee.com's public search API (the same JSON its own
 * search page uses). Every product returned here is a real retailer listing with its own
 * image, title and current price as reported by Pricee. Nothing is invented: if Pricee is
 * unreachable or returns nothing suitable, the step comes back empty with an explanation.
 *
 * Note: YouCam's Skin Analysis API returns skin scores, not products. The *need* for each
 * step (and its ingredient keywords) is derived from the YouCam result + the user's goals;
 * this module only finds and ranks real products for those needs.
 */

const PRICEE = (process.env.PRICEE_BASE_URL || 'https://pricee.com').replace(/\/$/, '');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const TTL = 6 * 60 * 60 * 1000; // 6h cache — prices refresh several times a day
const cache = new Map();

async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return value;
}

export async function priceeSearch(q, size = 30) {
  return cached(`s:${q}:${size}`, async () => {
    const url = `${PRICEE}/api/v1/search.php?q=${encodeURIComponent(q)}&size=${size}&lang=en&vuid=0&platform=2`;
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json, text/plain, */*', Referer: `${PRICEE}/?q=${encodeURIComponent(q)}` }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`Pricee search returned HTTP ${r.status}`);
    const j = await r.json();
    return Array.isArray(j?.data) ? j.data.map(parseListing).filter(Boolean) : [];
  });
}

/* ------------------------------------------------------------- parsing */
const num = (v) => { const n = Number(String(v ?? '').replace(/[,₹\s]/g, '')); return Number.isFinite(n) && n > 0 ? n : null; };
const titleCase = (s) => String(s || '').replace(/\b\w/g, (c) => c.toUpperCase());

export function extractSize(title) {
  const m = String(title).match(/(\d+(?:\.\d+)?)\s?(fl\.? ?oz|ml|gms?|grams?|g|oz|l)\b/i);
  if (!m) return null;
  let unit = m[2].toLowerCase().replace(/\s|\./g, '');
  if (['gm', 'gms', 'gram', 'grams'].includes(unit)) unit = 'g';
  if (unit === 'floz') unit = 'fl oz';
  return `${Number(m[1])} ${unit}`;
}

function parseListing(d) {
  const price = num(d?.source_price);
  if (!d?.id || !d?.title || !price) return null;
  const image = typeof d.image === 'string' && /^https:\/\//.test(d.image) ? d.image.replace(/\._SL\d+_\./, '._SL500_.') : null;
  return {
    offerId: String(d.id),
    title: String(d.title_variant || d.title).replace(/\s+/g, ' ').trim(),
    brand: titleCase(d.brand && d.brand.length < 40 ? d.brand : String(d.title).split(/\s+/)[0]),
    image,
    price,
    mrp: num(d.source_mrp),
    retailer: d.source_display_name || titleCase(d.source_name) || 'Retailer',
    retailerId: Number(d.source_id) || null,
    priceeLink: typeof d.url === 'string' ? d.url.split('&utm_term')[0] : null,
    inStock: Number(d.stock) === 1,
    updatedAt: d.es_updated_at || null,
    category: d.main_category || '',
    size: extractSize(d.title_variant || d.title),
  };
}

/** Direct retailer URL for the exact listing. Amazon ASINs are built directly; others follow Pricee's redirect. */
async function directLink(offer) {
  const [src, ...rest] = offer.offerId.split('-');
  const pid = rest.join('-');
  if (src === '2' && /^[a-z0-9]{10}$/i.test(pid)) return `https://www.amazon.in/dp/${pid.toUpperCase()}`;
  if (!offer.priceeLink) return null;
  return cached(`l:${offer.offerId}`, async () => {
    try {
      const r = await fetch(offer.priceeLink, { redirect: 'manual', headers: { 'User-Agent': UA, Referer: PRICEE }, signal: AbortSignal.timeout(8000) });
      const loc = r.headers.get('location');
      if (loc && /^https:\/\//.test(loc) && !/pricee\.com/.test(new URL(loc).hostname)) return loc;
    } catch { /* fall back to Pricee's tracked redirect, which still opens the exact listing */ }
    return offer.priceeLink;
  });
}

/* ------------------------------------------------------------- matching rules per routine step */
const JUNK_WORDS = /\b(combo|kit|pack of|set of|gift|bundle|trial|sample|baby|babies|kids?|infant|toddler|hair|shampoo|conditioner|lip|lipstick|nail|perfume|deo|deodorant|soap bar|bar soap|body wash|hand wash|razor|beard|men|mens|men's|mosquito|repellent|tinted|foundation|bb cream|cc cream|refill)\b|\b\d+\s?x\s?\d+\s?(ml|g)\b/i;
const PRODUCT_TYPES = [/face ?wash|cleanser/i, /\bserum\b/i, /sunscreen|sun ?block|\bspf\b/i, /moisturi[sz]|\bcream\b|\blotion\b/i, /\btoner\b/i, /\bmask\b|face pack/i, /\bscrub\b/i];
/** Rejects multi-product combos ("Serum + Sunscreen") but keeps single products like "Hyaluronic Acid 2% + B5". */
const JUNK = { test: (t) => JUNK_WORDS.test(t) || (/\+|&| and | with /i.test(t) && PRODUCT_TYPES.filter((r) => r.test(t)).length >= 2 && !/moisturi[sz]\w* (cream|lotion)|(cream|lotion) moisturi|spf/i.test(t)) };
const STEP = {
  Cleanser: { include: /\b(face ?wash|facewash|cleanser|cleansing (gel|foam|lotion))\b/i, exclude: /\b(scrub|makeup remover|micellar)\b/i, base: ['gentle face wash', 'cetaphil gentle skin cleanser', 'cerave cleanser', 'minimalist face wash'] },
  Toner: { include: /\btoner\b/i, exclude: /\bhair\b/i, base: ['face toner'] },
  Serum: { include: /\bserum\b/i, exclude: /\b(hair|eye|lash|brow)\b/i, base: ['minimalist face serum', 'the derma co serum', 'face serum'] },
  Treatment: { include: /\b(serum|gel|treatment|spot|cream)\b/i, exclude: /\b(hair|eye|sunscreen|spf)\b/i, base: ['face serum treatment'] },
  Exfoliant: { include: /\b(exfoliat|aha|bha|peel|scrub)\w*/i, exclude: /\b(body|foot|lip)\b/i, base: ['face exfoliant aha bha'] },
  Moisturizer: { include: /\b(moisturi[sz]er|moisturi[sz]ing|face cream|gel cream|face gel|day cream|night cream)\b/i, exclude: /\b(sunscreen|spf|body lotion|hand cream|foot|eye)\b/i, base: ['face moisturizer', 'cetaphil moisturiser', 'cerave moisturizing cream', 'minimalist moisturizer', 'simple light moisturiser'] },
  Sunscreen: { include: /\b(sunscreen|sun ?screen|sun ?block|spf ?\d{2})\b/i, exclude: /\b(body lotion|lip|spray tan|kids)\b/i, base: ['sunscreen spf 50 face', 'minimalist sunscreen spf 50', 'la roche posay anthelios', 'the derma co sunscreen', 'aqualogica sunscreen'] },
  'Eye care': { include: /\beye\b.*\b(cream|gel|serum)\b|\bunder ?eye\b/i, exclude: /\b(liner|shadow|mascara|lash|brow)\b/i, base: ['under eye cream'] },
  Mask: { include: /\b(face mask|sheet mask|clay mask|face pack)\b/i, exclude: /\bhair\b/i, base: ['face mask'] },
  Other: { include: /./, exclude: /^$/, base: ['skincare'] },
};
// Widely available dermatologist-favoured brands in India — a small trust boost, never a requirement.
const TRUSTED = /\b(cetaphil|cerave|la roche|bioderma|neutrogena|minimalist|the derma co|simple|re'?equil|aqualogica|dot ?& ?key|deconstruct|foxtale|plum|sebamed|avene|eucerin|nivea|pond'?s|garnier|himalaya|lakme|mamaearth|the ordinary|aveeno|olay|clinique|cosrx|beauty of joseon|innisfree|derma co|fixderma|uv doux|lotus herbals|biotique|wow skin|pilgrim|conscious chemist)\b/i;
const SKIN_WORDS = { Dry: /\b(dry|hydrat|ceramide|moistur)/i, Oily: /\b(oily|oil[- ]free|mattif|acne|salicylic|gel)\b/i, Combination: /\b(combination|all skin|balanc)/i, Sensitive: /\b(sensitive|gentle|soothing|fragrance[- ]free|calm)/i, Normal: /\b(all skin|normal)/i };

const tokens = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => (w.length > 2 || /\d/.test(w)) && !['for', 'and', 'with', 'the', 'skin', 'face', 'all', 'types', 'women', 'men'].includes(w));
const similarity = (a, b) => { const A = new Set(tokens(a)), B = new Set(tokens(b)); if (!A.size || !B.size) return 0; let i = 0; A.forEach((t) => B.has(t) && i++); return i / Math.min(A.size, B.size); };
/** Clean, short display name: first segment before marketplace keyword-stuffing separators. */
export const shortName = (t) => { const first = String(t).split(/\s[|–—]\s|\s-\s|\s\|\s?|,\s(?=[A-Z])/)[0].trim(); return first.length > 80 ? `${first.slice(0, 77).trim()}…` : first; };
/** Strict identity check for price comparison: same brand, same size, and mostly the same words. */
function sameProduct(a, b) {
  const brand = tokens(a.brand)[0] || tokens(a.title)[0];
  if (!brand || !tokens(b.title).includes(brand)) return false;
  if (a.size && b.size && sizeNum(a.size) !== sizeNum(b.size)) return false;
  if (!a.size !== !b.size) return false;
  const A = new Set(tokens(a.title)), B = new Set(tokens(b.title));
  let i = 0; A.forEach((t) => B.has(t) && i++);
  const jaccard = i / (A.size + B.size - i);
  const nums = (S) => [...S].filter((t) => /\d/.test(t)).sort().join(',');
  return jaccard >= 0.55 || (i / Math.min(A.size, B.size) >= 0.9 && nums(A) === nums(B));
}
const sizeNum = (s) => (s ? Number(s.split(' ')[0]) : null);
const toMl = (s) => { if (!s) return null; const [n, u] = [Number(s.split(' ')[0]), s.split(' ').slice(1).join(' ')]; return u === 'l' ? n * 1000 : /oz/.test(u) ? n * 29.57 : n; };
// Skip travel/trial minis so "cheap" never means "tiny".
const MIN_SIZE = { Cleanser: 50, Moisturizer: 25, Sunscreen: 30, Serum: 10, Treatment: 10, Toner: 50, Exfoliant: 20, 'Eye care': 10, Mask: 20 };

function queriesFor(need, profile) {
  const rule = STEP[need.category] || STEP.Other;
  const qs = [];
  const kw = (need.keywords || []).slice(0, 2);
  const noun = { Cleanser: 'face wash', Moisturizer: 'face moisturizer', Sunscreen: 'sunscreen spf 50', Serum: 'face serum', Treatment: 'face serum', Exfoliant: 'face exfoliant', Toner: 'face toner', 'Eye care': 'under eye cream', Mask: 'face mask' }[need.category] || 'skincare';
  for (const k of kw) qs.push(`${k} ${noun}`);
  const st = (profile?.skinType || '').toLowerCase();
  if (st && !/not sure/.test(st)) qs.push(`${noun} for ${st} skin`);
  qs.push(...rule.base);
  return [...new Set(qs)].slice(0, 6);
}

function score(offer, need, profile, budget, priceSpan) {
  const t = offer.title;
  const why = [];
  const kwHits = (need.keywords || []).filter((k) => t.toLowerCase().includes(k.toLowerCase()));
  if (kwHits.length) why.push(`Contains ${kwHits.slice(0, 3).join(', ')}`);
  let suit = need.keywords?.length ? Math.min(1, kwHits.length / 2) : 0.6;
  const st = profile?.skinType && SKIN_WORDS[profile.skinType];
  if (st && st.test(t)) { suit = Math.min(1, suit + 0.25); why.push(`Suits ${profile.skinType.toLowerCase()} skin`); }
  if (profile?.preferences?.fragranceFree && /fragrance[- ]free|unscented/i.test(t)) { suit = Math.min(1, suit + 0.15); why.push('Fragrance-free'); }
  if (profile?.preferences?.nonComedogenic && /non[- ]comedogenic|oil[- ]free/i.test(t)) { suit = Math.min(1, suit + 0.15); why.push('Non-comedogenic'); }
  if (profile?.sensitivity === 'High' && /\b(gentle|sensitive|soothing)\b/i.test(t)) suit = Math.min(1, suit + 0.15);
  const trust = TRUSTED.test(t) || TRUSTED.test(offer.brand) ? 1 : 0;
  if (trust) why.push('Trusted brand');
  // Value for money: price per ml/g against the pool median when sizes are known, else absolute price.
  const unit = offer.size ? offer.price / toMl(offer.size) : null;
  const afford = unit && priceSpan.medianUnit
    ? Math.max(0, Math.min(1, 1 - unit / (2 * priceSpan.medianUnit)))
    : Math.max(0, Math.min(1, 1 - offer.price / ((budget || priceSpan.max || offer.price) * 1.05)));
  if (unit && priceSpan.medianUnit && unit < priceSpan.medianUnit * 0.8) why.push('Good value per ml/g');
  if (budget && offer.price <= budget * 0.6) why.push('Well within budget');
  const total = Math.round((0.5 * suit + 0.25 * afford + 0.25 * trust) * 100);
  return { total, suit: Math.round(suit * 100), afford: Math.round(afford * 100), trust: trust * 100, why };
}

/** Lowest live price for the exact product: search its own title and keep near-identical listings of the same size. */
async function compareOffers(offer) {
  const q = tokens(offer.title).slice(0, 7).join(' ') + (offer.size ? ` ${offer.size.replace(' ', '')}` : '');
  let listings = [];
  try { listings = await priceeSearch(q, 20); } catch { listings = []; }
  const same = [offer, ...listings.filter((l) => l.offerId !== offer.offerId && l.inStock && !JUNK.test(l.title) && sameProduct(offer, l))];
  const byRetailer = new Map();
  for (const l of same) { const k = l.retailer; if (!byRetailer.has(k) || byRetailer.get(k).price > l.price) byRetailer.set(k, l); }
  const offers = [...byRetailer.values()].sort((a, b) => a.price - b.price);
  return Promise.all(offers.slice(0, 4).map(async (o) => ({ retailer: o.retailer, price: o.price, mrp: o.mrp, link: await directLink(o), priceeLink: o.priceeLink, title: o.title, image: o.image, size: o.size, updatedAt: o.updatedAt })));
}

export async function recommendForNeed(need, profile, budget, exclude = []) {
  const rule = STEP[need.category] || STEP.Other;
  const queries = queriesFor(need, profile);
  const settled = await Promise.allSettled(queries.map((q) => priceeSearch(q, 30)));
  if (settled.every((s) => s.status === 'rejected')) throw new Error('Live prices are unavailable right now (Pricee did not respond).');
  const seen = new Map();
  for (const s of settled) if (s.status === 'fulfilled') for (const l of s.value) {
    if (!l.inStock || !l.image || JUNK.test(l.title) || !rule.include.test(l.title) || rule.exclude.test(l.title)) continue;
    if (l.size && toMl(l.size) < (MIN_SIZE[need.category] || 0)) continue;
    if (exclude.some((x) => similarity(x, l.title) >= 0.75)) continue; // already owned
    const key = tokens(l.title).slice(0, 6).join(' ') + '|' + (l.size || '');
    if (!seen.has(key) || seen.get(key).price > l.price) seen.set(key, l);
  }
  let pool = [...seen.values()];
  const totalFound = pool.length;
  if (budget) pool = pool.filter((l) => l.price <= budget);
  const units = pool.filter((l) => l.size).map((l) => l.price / toMl(l.size)).sort((a, b) => a - b);
  const priceSpan = { max: Math.max(0, ...pool.map((l) => l.price)), medianUnit: units.length ? units[Math.floor(units.length / 2)] : null };
  const ranked = pool.map((l) => ({ l, s: score(l, need, profile, budget, priceSpan) })).sort((a, b) => b.s.total - a.s.total).slice(0, 3);
  const products = [];
  for (const { l, s } of ranked) {
    const offers = await compareOffers(l);
    const best = offers[0] || { retailer: l.retailer, price: l.price, mrp: l.mrp, link: await directLink(l), priceeLink: l.priceeLink, updatedAt: l.updatedAt };
    if (budget && best.price > budget) continue;
    products.push({
      id: l.offerId, name: shortName(l.title), fullTitle: l.title, brand: l.brand, image: best.image || l.image, size: l.size,
      price: best.price, mrp: best.mrp, retailer: best.retailer, link: best.link, priceeLink: best.priceeLink,
      priceCheckedAt: best.updatedAt || l.updatedAt, storesCompared: offers.length || 1,
      offers: offers.map((o) => ({ retailer: o.retailer, price: o.price, link: o.link })),
      score: s.total, breakdown: { suitability: s.suit, affordability: s.afford, trustedBrand: s.trust }, why: s.why, category: need.category,
    });
  }
  return { products, totalFound, afterBudget: pool.length };
}

export const IMAGE_HOSTS = /^https:\/\/((images|static|world)\.openbeautyfacts\.org|m\.media-amazon\.com|images-[a-z]+\.ssl-images-amazon\.com|rukminim\d*\.flixcart\.com|images-static\.nykaa\.com|[a-z0-9.-]*gadgets360cdn\.com|cdn\.gadgets360\.com)\//i;
