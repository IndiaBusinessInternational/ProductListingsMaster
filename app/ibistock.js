/* IBI Product Listings Master — live stock from IBI Stock Availability.
 *
 * ⚠ THIS IS AN IBI-ONLY FEATURE inside a product other sellers pay for. It reads India
 * Business International's own stock sheet, so it must stay behind `isIbiWorkspace()`
 * and the Settings switch: a paying customer must never see it, call it, or have their
 * stock silently replaced by IBI's numbers. Keep both gates.
 *
 * Source: the IBI Stock Availability Apps Script web app (stock.indiabusinessinternational.online).
 * `action=getAll` is ungated and read-only — nothing here can write to that sheet.
 * Stock on hand = packed + loose. Damage is deliberately NOT counted as sellable.
 */
export const STOCK_GAS_URL = 'https://script.google.com/macros/s/AKfycbzXTGd4PyjkGKoMr64VAYFKxKN23yZEzaMsUViOCJ8xEIvN9c8XgY00VF1VB6uBvslvOg/exec';
const TTL_MS = 5 * 60 * 1000;
let cache = { at: 0, items: null, err: null };

/* Only IBI's own workspace may use this. Brand is the signal the CEO named:
 * India Business International and its brand iINTELLIGENCEi. */
export function isIbiWorkspace(settings) {
  const b = ((settings && settings.business) || {});
  const hay = `${b.brand || ''} ${b.manufacturerName || ''}`.toLowerCase().replace(/[^a-z]/g, '');
  return hay.includes('iintelligencei') || hay.includes('indiabusinessinternational');
}

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = s => norm(s).split(' ').filter(w => w.length > 1);

export async function fetchStock({ force = false } = {}) {
  if (!force && cache.items && Date.now() - cache.at < TTL_MS) return cache.items;
  const r = await fetch(`${STOCK_GAS_URL}?action=getAll&t=${Date.now()}`, { method: 'GET' });
  if (!r.ok) throw new Error(`Stock Availability returned HTTP ${r.status}`);
  const j = await r.json().catch(() => null);
  if (!j || j.status !== 'ok' || !Array.isArray(j.items)) throw new Error('Stock Availability sent an unexpected reply');
  const items = j.items.filter(x => x && x.product).map(x => {
    const packed = parseFloat(x.packed) || 0, loose = parseFloat(x.loose) || 0;
    return { product: String(x.product), packed, loose, total: packed + loose, hsn: String(x.hsn || ''), gst: x.gst === '' || x.gst == null ? '' : parseFloat(x.gst), keywords: String(x.keywords || ''), n: norm(x.product), t: tokens(x.product) };
  });
  cache = { at: Date.now(), items, err: null };
  return items;
}

/* Match a product name to a sheet row.
 * exact → the whole name, punctuation-insensitive;
 * strong → every token of the shorter name is in the longer one;
 * weak  → best token overlap, only offered as a candidate, never auto-filled. */
export function matchStock(items, name) {
  const n = norm(name), t = tokens(name);
  if (!n || !items || !items.length) return { kind: 'none', candidates: [] };
  const exact = items.find(x => x.n === n);
  if (exact) return { kind: 'exact', row: exact, candidates: [] };
  const scored = items.map(x => {
    const overlap = t.filter(w => x.t.includes(w)).length;
    return { x, score: overlap / Math.max(1, Math.min(t.length, x.t.length)), overlap };
  }).filter(s => s.overlap > 0).sort((a, b) => b.score - a.score || b.overlap - a.overlap);
  if (!scored.length) return { kind: 'none', candidates: [] };
  const top = scored[0], runnerUp = scored[1];
  /* "strong" means we are willing to set the stock figure WITHOUT asking, so it has to
     be earned: a real overlap of at least three words, a high score, and a clear lead
     over the next row. One word in common is not a match — "Aluminium" alone would
     otherwise pick whichever aluminium product happened to sort first. */
  const strong = top.overlap >= 3 && top.score >= 0.95 && (!runnerUp || runnerUp.score < top.score);
  return strong
    ? { kind: 'strong', row: top.x, candidates: scored.slice(1, 4).map(s => s.x) }
    : { kind: 'weak', row: null, candidates: scored.slice(0, 5).map(s => s.x) };
}

export const stockCacheAge = () => (cache.items ? Date.now() - cache.at : null);
