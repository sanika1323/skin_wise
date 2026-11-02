/**
 * Small disk cache for third-party lookups (Pricee search, catalog search, product images).
 * Makes repeat visits instant, survives server restarts and keeps load on Pricee low.
 * Delete server/data/cache at any time to force fresh data.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(path.resolve(process.env.DATA_DIR || path.join(here, '../data')), 'cache');
const hours = Number(process.env.CACHE_TTL_HOURS || 6);
export const DEFAULT_TTL = (Number.isFinite(hours) && hours > 0 ? hours : 6) * 3600e3;
const file = (key, ext) => path.join(dir, `${createHash('sha1').update(key).digest('hex')}.${ext}`);

async function fresh(f, ttl) {
  try { const s = await stat(f); return Date.now() - s.mtimeMs < ttl; } catch { return false; }
}
export async function getJson(key, ttl = DEFAULT_TTL) {
  const f = file(key, 'json');
  if (!(await fresh(f, ttl))) return undefined;
  try { return JSON.parse(await readFile(f, 'utf8')); } catch { return undefined; }
}
export async function setJson(key, value) {
  try { await mkdir(dir, { recursive: true }); await writeFile(file(key, 'json'), JSON.stringify(value)); } catch { /* cache is best-effort */ }
}
export async function getBin(key, ttl = 7 * 24 * 3600e3) {
  const f = file(key, 'bin');
  if (!(await fresh(f, ttl))) return undefined;
  try { return { body: await readFile(f), type: (await readFile(file(key, 'type'), 'utf8')) || 'image/jpeg' }; } catch { return undefined; }
}
export async function setBin(key, body, type) {
  try { await mkdir(dir, { recursive: true }); await writeFile(file(key, 'bin'), body); await writeFile(file(key, 'type'), type); } catch { /* best-effort */ }
}
