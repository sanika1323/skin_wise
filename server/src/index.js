import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) }); // works from any working directory
const app = express();
const PORT = Number(process.env.PORT || 4000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(process.env.DATA_DIR || path.join(__dirname, '../data'));
const BEAUTY_FACTS = 'https://world.openbeautyfacts.org';
const YOUCAM_BASE_URL = (process.env.YOUCAM_BASE_URL || process.env.YOUCAM_API_BASE_URL || 'https://yce-api-01.makeupar.com').replace(/\/$/, '');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
// SD concern set only — YouCam does not allow mixing SD and HD actions in one task.
const ALLOWED_SKIN_ACTIONS = new Set(['acne', 'pore', 'texture', 'moisture', 'oiliness', 'redness', 'radiance', 'wrinkle', 'age_spot', 'firmness', 'eye_bag', 'dark_circle_v2', 'skin_type']);
const ROUTINE_CATEGORIES = new Set(['Cleanser', 'Toner', 'Serum', 'Treatment', 'Moisturizer', 'Sunscreen', 'Eye care', 'Mask', 'Exfoliant', 'Other']);

/* ----------------------------------------------------------------------------
 * JSON persistence (prototype). Each file has a serialised write queue so that
 * concurrent requests never interleave writes. Swap these helpers for a DB later.
 * -------------------------------------------------------------------------- */
const queues = new Map();
async function readJson(name, fallback) {
  await mkdir(dataDir, { recursive: true });
  const file = path.join(dataDir, name);
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') { await writeFile(file, JSON.stringify(fallback, null, 2), 'utf8'); return structuredClone(fallback); }
    throw error;
  }
}
function updateJson(name, fallback, mutate) {
  const prev = queues.get(name) || Promise.resolve();
  const next = prev.catch(() => {}).then(async () => {
    const current = await readJson(name, fallback);
    const result = await mutate(current);
    const value = result?.value !== undefined ? result.value : current;
    await writeFile(path.join(dataDir, name), JSON.stringify(value, null, 2), 'utf8');
    return result?.returns !== undefined ? result.returns : value;
  });
  queues.set(name, next);
  return next;
}

const readShelf = () => readJson('shelf.json', []);
const DEFAULT_PROFILE = {
  name: '', skinType: '', sensitivity: '', goals: [], concerns: [],
  preferences: { fragranceFree: false, nonComedogenic: false, minimalRoutine: false },
  avoidIngredients: [], budget: null, currency: 'INR', updatedAt: null,
};
const DEFAULT_ROUTINE = { AM: { steps: [], updatedAt: null }, PM: { steps: [], updatedAt: null }, logs: {} };

/* ---------------------------------------------------------------------------- */
function youcamHeaders() {
  if (!process.env.YOUCAM_API_KEY || /replace_with/i.test(process.env.YOUCAM_API_KEY)) {
    const error = new Error('Skin analysis is not configured on the server yet. Add YOUCAM_API_KEY to server/.env and restart the backend.');
    error.status = 503; error.code = 'PROVIDER_NOT_CONFIGURED';
    throw error;
  }
  return { Authorization: `Bearer ${process.env.YOUCAM_API_KEY}`, 'Content-Type': 'application/json' };
}

// Map provider error identifiers to safe, actionable copy (never leak raw provider payloads).
const PROVIDER_ERRORS = {
  error_below_min_image_size: 'The photo is too small. Use an image whose shorter side is at least 480 px.',
  error_exceed_max_image_size: 'The photo is too large. Use a JPG or PNG under 10 MB.',
  error_src_face_too_small: 'Your face is too small in the frame. Move closer so your face fills most of the photo.',
  error_src_face_out_of_bound: 'Part of your face is outside the frame. Centre your face and keep it fully visible.',
  error_lighting_dark: 'The photo is too dark. Try again facing a window or in even, bright light.',
  error_no_face: 'No face was detected. Use a clear, front-facing selfie.',
};
function providerCode(raw) {
  const t = typeof raw === 'string' ? raw : JSON.stringify(raw || '');
  return t.replace(/[^\w .:-]/g, '').trim().slice(0, 80);
}
function safeProviderMessage(raw, fallback) {
  const text = providerCode(raw).toLowerCase();
  for (const [key, message] of Object.entries(PROVIDER_ERRORS)) if (text.includes(key)) return message;
  if (/no[_ ]?face|face[_ ]not/.test(text)) return 'We could not detect a clear face. Use a well-lit, front-facing selfie without filters.';
  if (/insufficient|not enough|credit|out of unit|unit[s]? (?:exhaust|insufficient)|balance|quota/.test(text))
    return `Your YouCam account has no API units available (provider: "${providerCode(raw)}"). Redeem your hackathon code in the YouCam API Console → Account → Redeem Code, then retry.`;
  const code = providerCode(raw);
  return code ? `${fallback} (provider: "${code}")` : fallback;
}

async function youcamJson(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(45000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const raw = body.error_code || body.error || body.message || body.error_message || body.status || '';
    console.error(`YouCam HTTP ${response.status} ${url.replace(/\?.*$/, '')}:`, JSON.stringify(body).slice(0, 500));
    const error = new Error(response.status === 401 || response.status === 403
      ? 'The skin analysis provider rejected the server credentials. Check YOUCAM_API_KEY.'
      : safeProviderMessage(raw, 'The skin analysis provider could not process this request. Please try again.'));
    error.status = response.status === 401 || response.status === 403 ? 502 : (response.status >= 500 ? 502 : 422);
    throw error;
  }
  return body;
}

function normalizeProviderOutput(data) {
  const rawOutput = data?.results?.output || data?.results?.results?.output || [];
  if (!Array.isArray(rawOutput)) return [];
  return rawOutput.map((item) => {
    const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
    const extra = {};
    // Preserve any additional scalar provider fields (e.g. skin type labels) without inventing anything.
    for (const [k, v] of Object.entries(item || {})) {
      if (['type', 'name', 'ui_score', 'raw_score', 'mask_urls'].includes(k)) continue;
      if (['string', 'number', 'boolean'].includes(typeof v)) extra[k] = v;
    }
    return {
      type: String(item?.type || item?.name || 'skin_metric'),
      uiScore: num(item?.ui_score),
      rawScore: num(item?.raw_score),
      maskUrls: Array.isArray(item?.mask_urls) ? item.mask_urls.filter((u) => typeof u === 'string' && /^https:\/\//i.test(u)) : [],
      extra,
    };
  });
}

app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '1mb' }));

function normalizeProduct(p) {
  const code = String(p.code || '').trim();
  const name = String(p.product_name || p.product_name_en || '').trim();
  const brand = String(p.brands || '').split(',')[0].trim();
  const sel = p.selected_images?.front?.display || {};
  const imageUrl = p.image_front_url || p.image_url || p.image_front_small_url || p.image_small_url || sel.en || Object.values(sel)[0] || null;
  return {
    code,
    name,
    brand,
    category: String(p.categories || '').split(',')[0].trim() || 'Skincare',
    imageUrl: imageUrl && /^https:\/\//i.test(imageUrl) ? imageUrl : null,
    productUrl: code ? `${BEAUTY_FACTS}/product/${encodeURIComponent(code)}` : null,
    ingredients: p.ingredients_text || p.ingredients_text_en || '',
    quantity: p.quantity || '',
    source: 'Open Beauty Facts'
  };
}

app.get('/api/health', (_req, res) => {
  const key = process.env.YOUCAM_API_KEY;
  res.json({ ok: true, service: 'skinwise-api', youcamConfigured: Boolean(key && !/replace_with/i.test(key)) });
});

/* ------------------------------- Catalog ---------------------------------- */
// Search is a catalog lookup only. It does not add anything to the user's shelf.
app.get('/api/products/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.status(400).json({ error: 'Enter at least 2 characters to search.' });
  try {
    const url = new URL(`${BEAUTY_FACTS}/cgi/search.pl`);
    url.searchParams.set('search_terms', q);
    url.searchParams.set('search_simple', '1');
    url.searchParams.set('action', 'process');
    url.searchParams.set('json', '1');
    url.searchParams.set('page_size', '24');
    url.searchParams.set('fields', 'code,product_name,product_name_en,brands,categories,image_front_url,image_url,ingredients_text,ingredients_text_en,quantity,image_front_small_url,image_small_url,selected_images');
    const response = await fetch(url, {
      headers: { 'User-Agent': 'SkinWiseAI/1.0 (skincare product catalog lookup)' },
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`Catalog returned ${response.status}`);
    const payload = await response.json();
    const products = (payload.products || [])
      .map(normalizeProduct)
      .filter(p => p.code && p.name && p.brand)
      .sort((a, b) => Number(Boolean(b.imageUrl)) - Number(Boolean(a.imageUrl)))
      .slice(0, 24);
    return res.json({ source: 'Open Beauty Facts', count: products.length, products });
  } catch (error) {
    console.error('Product search failed:', error.message);
    return res.status(502).json({ error: 'The product catalog is temporarily unavailable. Try again shortly.' });
  }
});

// Same-origin image proxy for catalog photos (avoids hot-link / referrer / mixed-origin issues).
const IMG_HOSTS = /^https:\/\/(images|static|world)\.openbeautyfacts\.org\//i;
app.get('/api/img', async (req, res) => {
  const u = String(req.query.u || '');
  if (!IMG_HOSTS.test(u)) return res.status(400).end();
  try {
    const r = await fetch(u, { headers: { 'User-Agent': 'SkinWiseAI/1.0 (catalog image)' }, signal: AbortSignal.timeout(12000) });
    const type = r.headers.get('content-type') || '';
    if (!r.ok || !type.startsWith('image/')) return res.status(404).end();
    res.set({ 'Content-Type': type, 'Cache-Control': 'public, max-age=86400' });
    res.send(Buffer.from(await r.arrayBuffer()));
  } catch { res.status(504).end(); }
});

/* -------------------------------- Shelf ----------------------------------- */
app.get('/api/shelf', async (_req, res) => {
  try { res.json({ products: await readShelf() }); }
  catch (error) { console.error(error); res.status(500).json({ error: 'Could not read your product shelf.' }); }
});

function shelfExtras(body) {
  const out = {};
  if (body?.routineCategory !== undefined) {
    const c = String(body.routineCategory || '');
    if (c && !ROUTINE_CATEGORIES.has(c)) throw Object.assign(new Error('Unknown routine category.'), { status: 400 });
    out.routineCategory = c || null;
  }
  if (body?.expiryDate !== undefined) {
    const d = String(body.expiryDate || '');
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw Object.assign(new Error('Expiry date must be YYYY-MM-DD.'), { status: 400 });
    out.expiryDate = d || null;
  }
  if (body?.notes !== undefined) out.notes = String(body.notes || '').slice(0, 500);
  if (body?.routineUsage !== undefined) {
    const u = Array.isArray(body.routineUsage) ? body.routineUsage.filter((x) => x === 'AM' || x === 'PM') : [];
    out.routineUsage = [...new Set(u)];
  }
  if (body?.remaining !== undefined) {
    const r = Number(body.remaining);
    if (!Number.isFinite(r) || r < 0 || r > 100) throw Object.assign(new Error('Remaining quantity must be between 0 and 100.'), { status: 400 });
    out.remaining = r;
  }
  if (body?.price !== undefined) {
    if (body.price === null || body.price === '') out.price = null;
    else {
      const p = Number(body.price);
      if (!Number.isFinite(p) || p < 0) throw Object.assign(new Error('Price must be zero or greater.'), { status: 400 });
      out.price = p;
    }
  }
  return out;
}

// Confirm the selected barcode against Open Beauty Facts before saving it.
app.post('/api/shelf', async (req, res) => {
  const code = String(req.body?.code || '').trim();
  const purchasedAt = req.body?.purchasedAt ? String(req.body.purchasedAt) : null;
  if (!/^\d{8,14}$/.test(code)) return res.status(400).json({ error: 'Choose a valid catalog product before adding it.' });
  let extras;
  try { extras = shelfExtras({ remaining: 100, price: null, ...req.body }); }
  catch (error) { return res.status(error.status || 400).json({ error: error.message }); }
  try {
    const url = `${BEAUTY_FACTS}/api/v2/product/${encodeURIComponent(code)}.json?fields=code,product_name,product_name_en,brands,categories,image_front_url,image_url,ingredients_text,ingredients_text_en,quantity,image_front_small_url,image_small_url,selected_images`;
    const response = await fetch(url, { headers: { 'User-Agent': 'SkinWiseAI/1.0 (skincare product catalog lookup)' }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Catalog returned ${response.status}`);
    const payload = await response.json();
    if (payload.status !== 1 || !payload.product) return res.status(404).json({ error: 'That product could not be verified in Open Beauty Facts. Search for another entry.' });
    const verified = normalizeProduct({ ...payload.product, code });
    if (!verified.name || !verified.brand) return res.status(422).json({ error: 'The catalog entry is missing its product name or brand, so it cannot be added safely.' });
    const item = await updateJson('shelf.json', [], (shelf) => {
      if (shelf.some(p => p.code === code)) throw Object.assign(new Error('This product is already on your shelf.'), { status: 409 });
      const entry = { id: randomUUID(), ...verified, purchasedAt, addedAt: new Date().toISOString(), notes: '', expiryDate: null, routineUsage: [], routineCategory: null, ...extras };
      shelf.unshift(entry);
      return { value: shelf, returns: entry };
    });
    return res.status(201).json({ product: item });
  } catch (error) {
    if (error.status === 409) return res.status(409).json({ error: error.message });
    console.error('Add product failed:', error.message);
    return res.status(502).json({ error: 'Could not verify the product right now. Nothing was added; please retry.' });
  }
});

app.patch('/api/shelf/:id', async (req, res) => {
  try {
    const extras = shelfExtras(req.body || {});
    const product = await updateJson('shelf.json', [], (shelf) => {
      const idx = shelf.findIndex((p) => p.id === req.params.id);
      if (idx < 0) throw Object.assign(new Error('Product not found on your shelf.'), { status: 404 });
      shelf[idx] = { ...shelf[idx], ...extras, updatedAt: new Date().toISOString() };
      return { value: shelf, returns: shelf[idx] };
    });
    res.json({ product });
  } catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : 'Could not update the product.' }); }
});

app.delete('/api/shelf/:id', async (req, res) => {
  try {
    await updateJson('shelf.json', [], (shelf) => {
      const next = shelf.filter(p => p.id !== req.params.id);
      if (next.length === shelf.length) throw Object.assign(new Error('Product not found on your shelf.'), { status: 404 });
      return { value: next };
    });
    // Detach the product from routine steps so nothing points at a removed item.
    await updateJson('routine.json', DEFAULT_ROUTINE, (r) => {
      for (const t of ['AM', 'PM']) r[t].steps = (r[t].steps || []).map((s) => (s.productId === req.params.id ? { ...s, productId: null } : s));
      return { value: r };
    });
    res.json({ ok: true });
  } catch (error) { if (!error.status) console.error(error); res.status(error.status || 500).json({ error: error.status ? error.message : 'Could not remove the product.' }); }
});

/* ------------------------------- Profile ---------------------------------- */
app.get('/api/profile', async (_req, res) => {
  try { res.json({ profile: { ...DEFAULT_PROFILE, ...(await readJson('profile.json', DEFAULT_PROFILE)) } }); }
  catch (error) { console.error(error); res.status(500).json({ error: 'Could not load your profile.' }); }
});

app.put('/api/profile', async (req, res) => {
  const b = req.body || {};
  const strList = (v, max = 12) => (Array.isArray(v) ? v.map((x) => String(x).trim().slice(0, 60)).filter(Boolean).slice(0, max) : undefined);
  const patch = {};
  if (b.name !== undefined) patch.name = String(b.name || '').slice(0, 60);
  if (b.skinType !== undefined) patch.skinType = String(b.skinType || '').slice(0, 40);
  if (b.sensitivity !== undefined) patch.sensitivity = String(b.sensitivity || '').slice(0, 40);
  if (b.goals !== undefined) patch.goals = strList(b.goals) || [];
  if (b.concerns !== undefined) patch.concerns = strList(b.concerns) || [];
  if (b.avoidIngredients !== undefined) patch.avoidIngredients = strList(b.avoidIngredients, 20) || [];
  if (b.preferences !== undefined && typeof b.preferences === 'object') {
    patch.preferences = Object.fromEntries(Object.entries(b.preferences).filter(([, v]) => typeof v === 'boolean').slice(0, 10));
  }
  if (b.budget !== undefined) {
    if (b.budget === null || b.budget === '') patch.budget = null;
    else if (!Number.isFinite(Number(b.budget)) || Number(b.budget) < 0) return res.status(400).json({ error: 'Budget must be zero or greater.' });
    else patch.budget = Number(b.budget);
  }
  try {
    const profile = await updateJson('profile.json', DEFAULT_PROFILE, (p) => ({ value: { ...DEFAULT_PROFILE, ...p, ...patch, preferences: { ...DEFAULT_PROFILE.preferences, ...(p.preferences || {}), ...(patch.preferences || {}) }, updatedAt: new Date().toISOString() } }));
    res.json({ profile });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Could not save your profile.' }); }
});

/* ------------------------------- Routine ---------------------------------- */
function sanitizeSteps(steps) {
  if (!Array.isArray(steps)) return [];
  return steps.slice(0, 12).map((s, i) => ({
    id: String(s.id || randomUUID()).slice(0, 64),
    productId: s.productId ? String(s.productId).slice(0, 64) : null,
    category: ROUTINE_CATEGORIES.has(String(s.category)) ? String(s.category) : 'Other',
    name: String(s.name || s.category || 'Step').slice(0, 80),
    instructions: String(s.instructions || '').slice(0, 300),
    frequency: String(s.frequency || 'Daily').slice(0, 40),
    reason: String(s.reason || '').slice(0, 300),
    optional: Boolean(s.optional),
    sortOrder: i,
  }));
}

app.get('/api/routine', async (_req, res) => {
  try { res.json({ routine: await readJson('routine.json', DEFAULT_ROUTINE) }); }
  catch (error) { console.error(error); res.status(500).json({ error: 'Could not load your routine.' }); }
});

app.put('/api/routine', async (req, res) => {
  try {
    const routine = await updateJson('routine.json', DEFAULT_ROUTINE, (r) => {
      const now = new Date().toISOString();
      for (const t of ['AM', 'PM']) if (req.body?.[t] !== undefined) r[t] = { steps: sanitizeSteps(req.body[t]?.steps ?? req.body[t]), updatedAt: now };
      return { value: r };
    });
    res.json({ routine });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Could not save your routine.' }); }
});

app.post('/api/routine/log', async (req, res) => {
  const date = String(req.body?.date || '');
  const type = req.body?.type;
  const stepId = String(req.body?.stepId || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !['AM', 'PM'].includes(type) || !stepId) return res.status(400).json({ error: 'Invalid routine log entry.' });
  try {
    const routine = await updateJson('routine.json', DEFAULT_ROUTINE, (r) => {
      r.logs = r.logs || {};
      const day = r.logs[date] || { AM: [], PM: [] };
      const set = new Set(day[type] || []);
      if (req.body?.done === false) set.delete(stepId); else set.add(stepId);
      day[type] = [...set];
      r.logs[date] = day;
      // keep the last 120 days only
      const keys = Object.keys(r.logs).sort();
      for (const k of keys.slice(0, Math.max(0, keys.length - 120))) delete r.logs[k];
      return { value: r };
    });
    res.json({ routine });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Could not record this step.' }); }
});

/* ---------------------------- Skin analysis ------------------------------- */
// Lifecycle: processing -> completed | failed. Selfie bytes stay in memory and are never written to disk.
app.post('/api/skin-analysis', upload.single('image'), async (req, res) => {
  let record = null;
  try {
    const apiHeaders = youcamHeaders(); // fail fast if not configured
    if (!req.file || !req.file.size) return res.status(400).json({ error: 'Choose a selfie image before starting an assessment.' });
    const supportedTypes = new Set(['image/jpeg', 'image/png']);
    if (!supportedTypes.has(req.file.mimetype)) return res.status(415).json({ error: 'Use a JPG or PNG image.' });
    if (req.body.consent !== 'true') return res.status(400).json({ error: 'Please confirm consent before uploading your selfie.' });
    let actions;
    try { actions = JSON.parse(String(req.body.actions || '[]')); }
    catch { return res.status(400).json({ error: 'Invalid skin analysis options.' }); }
    if (!Array.isArray(actions) || actions.length === 0 || actions.some((a) => !ALLOWED_SKIN_ACTIONS.has(a))) {
      return res.status(400).json({ error: 'Choose one or more supported skin concerns.' });
    }
    actions = [...new Set(actions)];

    const now = new Date().toISOString();
    record = { id: randomUUID(), providerTaskId: null, status: 'processing', stage: 'UPLOADING_IMAGE', actions, createdAt: now, updatedAt: now, completedAt: null, error: null, results: [], note: '', consentAcceptedAt: now };
    await updateJson('assessments.json', [], (list) => { list.unshift(record); return { value: list }; });

    const contentType = req.file.mimetype;
    const ext = contentType === 'image/jpeg' ? 'jpg' : 'png';
    const fileInit = await youcamJson(`${YOUCAM_BASE_URL}/s2s/v2.0/file`, {
      method: 'POST', headers: apiHeaders,
      body: JSON.stringify({ files: [{ content_type: contentType, file_name: `skinwise-selfie-${Date.now()}.${ext}`, file_size: req.file.size }] })
    });
    const fileInfo = fileInit?.data?.files?.[0];
    const uploadRequest = fileInfo?.requests?.[0];
    if (!fileInfo?.file_id || !uploadRequest?.url) throw Object.assign(new Error('The analysis provider did not accept the image upload. Please try again.'), { status: 502 });

    const putResponse = await fetch(uploadRequest.url, { method: uploadRequest.method || 'PUT', headers: { ...(uploadRequest.headers || {}), 'Content-Type': contentType }, body: req.file.buffer, signal: AbortSignal.timeout(45000) });
    if (!putResponse.ok) throw Object.assign(new Error('Uploading the image failed. Try a smaller JPG or PNG.'), { status: 502 });

    const task = await youcamJson(`${YOUCAM_BASE_URL}/s2s/v2.0/task/skin-analysis`, {
      method: 'POST', headers: apiHeaders,
      body: JSON.stringify({ src_file_id: fileInfo.file_id, dst_actions: actions, format: 'json' })
    });
    const taskId = task?.data?.task_id;
    if (!taskId) throw Object.assign(new Error('The analysis provider did not create a task. Please try again.'), { status: 502 });

    const saved = await updateJson('assessments.json', [], (list) => {
      const r = list.find((x) => x.id === record.id);
      Object.assign(r, { providerTaskId: taskId, stage: 'PROCESSING', updatedAt: new Date().toISOString() });
      return { value: list, returns: r };
    });
    return res.status(202).json({ assessment: saved, id: saved.id, taskId, status: 'processing', message: 'Your assessment is processing.' });
  } catch (error) {
    console.error('Skin analysis start failed:', error.message);
    if (record) await updateJson('assessments.json', [], (list) => {
      const r = list.find((x) => x.id === record.id);
      if (r) Object.assign(r, { status: 'failed', stage: 'FAILED', error: error.message, updatedAt: new Date().toISOString() });
      return { value: list };
    }).catch(() => {});
    return res.status(error.status || 502).json({ error: error.message || 'Could not start the skin assessment.', code: error.code });
  }
});

app.get('/api/skin-analysis/history', async (_req, res) => {
  try { res.json({ assessments: await readJson('assessments.json', []) }); }
  catch (error) { console.error(error); res.status(500).json({ error: 'Could not load assessment history.' }); }
});

const TIMEOUT_MS = 10 * 60 * 1000;
async function refreshAssessment(id) {
  const list = await readJson('assessments.json', []);
  const record = list.find((x) => x.id === id || x.providerTaskId === id);
  if (!record) throw Object.assign(new Error('Assessment not found.'), { status: 404 });
  if (record.status !== 'processing' || !record.providerTaskId) return record;
  if (Date.now() - Date.parse(record.createdAt) > TIMEOUT_MS) {
    return updateJson('assessments.json', [], (l) => { const r = l.find((x) => x.id === record.id); Object.assign(r, { status: 'failed', stage: 'FAILED', error: 'The analysis took too long. Please try again.', updatedAt: new Date().toISOString() }); return { value: l, returns: r }; });
  }
  const result = await youcamJson(`${YOUCAM_BASE_URL}/s2s/v2.0/task/skin-analysis/${encodeURIComponent(record.providerTaskId)}`, { method: 'GET', headers: youcamHeaders() });
  const data = result?.data || {};
  const status = String(data.task_status || data.status || 'running').toLowerCase();
  if (status === 'success' || status === 'completed') {
    const results = normalizeProviderOutput(data);
    return updateJson('assessments.json', [], (l) => { const r = l.find((x) => x.id === record.id); const now = new Date().toISOString(); Object.assign(r, { status: 'completed', stage: 'COMPLETED', results, completedAt: now, updatedAt: now }); return { value: l, returns: r }; });
  }
  if (status === 'error' || status === 'failed') {
    const message = safeProviderMessage(data.error || data.error_message, 'The provider could not analyse this image. Try a clear, front-facing, well-lit selfie.');
    return updateJson('assessments.json', [], (l) => { const r = l.find((x) => x.id === record.id); Object.assign(r, { status: 'failed', stage: 'FAILED', error: message, updatedAt: new Date().toISOString() }); return { value: l, returns: r }; });
  }
  return record;
}

app.get('/api/skin-analysis/:id', async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id || id.length > 256 || !/^[A-Za-z0-9_-]+$/.test(id)) return res.status(400).json({ error: 'Invalid assessment ID.' });
  try {
    const assessment = await refreshAssessment(id);
    // `status` / `results` kept at top level for older clients.
    res.json({ assessment, taskId: assessment.providerTaskId, status: assessment.status, results: assessment.results, message: assessment.error || undefined });
  } catch (error) {
    console.error('Skin analysis poll failed:', error.message);
    res.status(error.status || 502).json({ error: error.message || 'Could not retrieve the assessment.' });
  }
});

app.get('/api/skin-analysis/:id/result', async (req, res) => {
  const list = await readJson('assessments.json', []).catch(() => []);
  const r = list.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'Assessment not found.' });
  if (r.status !== 'completed') return res.status(409).json({ error: 'This assessment has not completed.', status: r.status });
  res.json({ assessment: r });
});

app.patch('/api/skin-analysis/:id', async (req, res) => {
  try {
    const assessment = await updateJson('assessments.json', [], (l) => {
      const r = l.find((x) => x.id === req.params.id);
      if (!r) throw Object.assign(new Error('Assessment not found.'), { status: 404 });
      if (req.body?.note !== undefined) r.note = String(req.body.note || '').slice(0, 500);
      r.updatedAt = new Date().toISOString();
      return { value: l, returns: r };
    });
    res.json({ assessment });
  } catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : 'Could not update the assessment.' }); }
});

app.delete('/api/skin-analysis/:id', async (req, res) => {
  try {
    await updateJson('assessments.json', [], (l) => {
      const next = l.filter((x) => x.id !== req.params.id);
      if (next.length === l.length) throw Object.assign(new Error('Assessment not found.'), { status: 404 });
      return { value: next };
    });
    res.json({ ok: true });
  } catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : 'Could not delete the assessment.' }); }
});

app.use((error, _req, res, _next) => {
  if (error?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Image must be 10 MB or smaller.' });
  console.error(error);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

app.listen(PORT, () => console.log(`SkinWise API running at http://localhost:${PORT}`));
