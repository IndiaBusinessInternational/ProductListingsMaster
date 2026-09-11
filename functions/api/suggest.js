/* /api/suggest?q=seed — live search suggestions for the dynamic-SEO keyword pool.
 * Google autocomplete (India, English) + Amazon.in completion, merged, deduped, cached 24 h in KV. No auth. */
import { json, err, handle, rateLimit, clientIp, sha256 } from './_lib.js';

async function google(q) {
  const r = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&hl=en-IN&gl=in&q=${encodeURIComponent(q)}`, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IBI-ListingsMaster/1.0)' } });
  if (!r.ok) return [];
  const j = await r.json().catch(() => null);
  return Array.isArray(j) && Array.isArray(j[1]) ? j[1].map(String) : [];
}
async function amazonIn(q) {
  const r = await fetch(`https://completion.amazon.in/api/2017/suggestions?limit=11&prefix=${encodeURIComponent(q)}&suggestion-type=KEYWORD&alias=aps&mid=A21TJRUUN4KGV&lop=en_IN&fb=1`, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IBI-ListingsMaster/1.0)', Accept: 'application/json' } });
  if (!r.ok) return [];
  const j = await r.json().catch(() => null);
  return j && Array.isArray(j.suggestions) ? j.suggestions.map(s => String(s.value || '')).filter(Boolean) : [];
}

export const onRequestGet = handle(async ({ request, env }) => {
  const q = (new URL(request.url).searchParams.get('q') || '').trim().slice(0, 80);
  if (q.length < 2) return err('q must be at least 2 characters');
  if (!await rateLimit(env, 'sug:' + clientIp(request), 120, 3600)) return err('Too many suggestion requests; try in an hour', 429);
  const ck = 'sug:' + await sha256(q.toLowerCase());
  if (env.PLM_KV) { const hit = await env.PLM_KV.get(ck); if (hit) return json({ q, cached: true, ...JSON.parse(hit) }); }
  const [g, a] = await Promise.all([google(q).catch(() => []), amazonIn(q).catch(() => [])]);
  const seen = new Set(), suggestions = [];
  const push = (term, source) => { const k = term.toLowerCase().replace(/\s+/g, ' ').trim(); if (!k || seen.has(k) || k === q.toLowerCase()) return; seen.add(k); suggestions.push({ term: k, source }); };
  // interleave so both engines contribute to the top of the list
  for (let i = 0; i < Math.max(g.length, a.length); i++) { if (a[i]) push(a[i], 'amazon.in'); if (g[i]) push(g[i], 'google'); }
  const out = { suggestions: suggestions.slice(0, 20), sources: { google: g.length, amazon: a.length }, fetchedAt: new Date().toISOString() };
  if (env.PLM_KV && suggestions.length) await env.PLM_KV.put(ck, JSON.stringify(out), { expirationTtl: 86400 });
  return json({ q, cached: false, ...out });
});
