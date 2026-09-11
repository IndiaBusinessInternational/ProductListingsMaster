/* /api/admin — owner console, guarded by env.ADMIN_TOKEN (header x-admin-token).
 * GET  ?email=  → user + usage;  GET ?list=1 → up to 1000 accounts (id, email, plan)
 * POST {email, plan, months}  → set / extend a plan by hand (UPI payments, trials, goodwill) */
import { json, err, notConfigured, adminOk, getUserByEmail, getUserById, putUser, planOf, PLANS, aiUsed, publicUser, handle } from './_lib.js';
import { extendPlan } from './billing/webhook.js';
export const onRequest = handle(async ({ request, env }) => {
  if (!env.ADMIN_TOKEN || !env.PLM_KV) return notConfigured('Admin');
  if (!adminOk(request, env)) return err('Forbidden', 403);
  const url = new URL(request.url);
  if (request.method === 'GET') {
    if (url.searchParams.get('list')) {
      const l = await env.PLM_KV.list({ prefix: 'uid:', limit: 1000 }); const out = [];
      for (const k of l.keys) { const u = await getUserById(env, k.name.slice(4)); if (u) out.push({ id: u.id, email: u.email, name: u.name, plan: planOf(u), planUntil: u.planUntil, createdAt: u.createdAt }); }
      return json({ users: out.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')), count: out.length });
    }
    const u = await getUserByEmail(env, url.searchParams.get('email') || ''); if (!u) return err('No such user', 404);
    const ws = await env.PLM_KV.get('ws:' + u.id);
    return json({ user: publicUser(u, await aiUsed(env, u.id)), rawPlan: u.plan, workspaceBytes: ws ? ws.length : 0, products: ws ? (JSON.parse(ws).products || []).filter(p => !p.deleted).length : 0 });
  }
  if (request.method === 'POST') {
    const b = await request.json().catch(() => ({}));
    const u = await getUserByEmail(env, b.email || ''); if (!u) return err('No such user', 404);
    if (b.plan === 'free') { u.plan = 'free'; u.planUntil = null; }
    else { if (!PLANS[b.plan]) return err('Unknown plan'); extendPlan(u, b.plan, Math.max(1, Math.min(36, +b.months || 1))); }
    await putUser(env, u);
    return json({ ok: true, user: publicUser(u, await aiUsed(env, u.id)) });
  }
  return err('Method not allowed', 405);
});
