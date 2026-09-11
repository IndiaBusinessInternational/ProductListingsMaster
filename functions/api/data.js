/* /api/data — the signed-in user's workspace document (products, listings, perf, custom channels, settings). */
import { json, err, notConfigured, requireUser, planOf, PLANS, handle } from './_lib.js';
const MAX_BYTES = 20 * 1024 * 1024; // KV value cap is 25 MiB

export const onRequestGet = handle(async ({ request, env }) => {
  if (!env.PLM_KV || !env.SESSION_SECRET) return notConfigured('Cloud sync');
  const u = await requireUser(request, env);
  const raw = await env.PLM_KV.get('ws:' + u.id);
  return json(raw ? JSON.parse(raw) : { products: [], listings: [], perf: [], channels: [], settings: null, empty: true });
});

export const onRequestPut = handle(async ({ request, env }) => {
  if (!env.PLM_KV || !env.SESSION_SECRET) return notConfigured('Cloud sync');
  const u = await requireUser(request, env);
  const text = await request.text();
  if (text.length > MAX_BYTES) return err('Workspace is too large to sync (20 MB cap). Remove local image previews from products.', 413);
  let body; try { body = JSON.parse(text); } catch { return err('Bad JSON'); }
  const plan = planOf(u), lim = PLANS[plan];
  const live = (body.products || []).filter(p => p && !p.deleted).length;
  if (live > lim.products) return err(`Your ${lim.name} plan syncs up to ${lim.products} products (you have ${live}). Upgrade to sync everything; local use is unlimited.`, 402, { code: 'plan_limit' });
  const doc = { products: body.products || [], listings: body.listings || [], perf: body.perf || [], channels: body.channels || [], settings: body.settings || null, pushedAt: new Date().toISOString(), appVersion: body.appVersion || null };
  // strip local image previews (data URLs) from the cloud copy — they are device-only by design
  for (const p of doc.products) if (p && Array.isArray(p.images)) p.images = p.images.filter(i => i && i.url);
  await env.PLM_KV.put('ws:' + u.id, JSON.stringify(doc));
  return json({ ok: true, pushedAt: doc.pushedAt, products: live, limit: lim.products });
});
