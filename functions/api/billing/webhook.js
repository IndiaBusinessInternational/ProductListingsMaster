/* POST /api/billing/webhook — Razorpay `payment.captured`. Verifies the HMAC, re-checks the amount against the stored
 * order, activates the plan for one month (extends an active one) and is idempotent because Razorpay retries. */
import { json, err, notConfigured, configured, getUserById, putUser, planOf, handle } from '../_lib.js';
const enc = new TextEncoder();
async function hmacHex(secret, data) { const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return [...new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(data)))].map(b => b.toString(16).padStart(2, '0')).join(''); }
export function extendPlan(user, planKey, months = 1) {
  const now = new Date(); const base = planOf(user) === planKey && user.planUntil && new Date(user.planUntil) > now ? new Date(user.planUntil) : now;
  const until = new Date(base.getTime()); until.setUTCMonth(until.getUTCMonth() + months);
  user.plan = planKey; user.planUntil = until.toISOString(); return user;
}
export const onRequestPost = handle(async ({ request, env }) => {
  if (!configured(env).billing) return notConfigured('Online payment');
  const raw = await request.text(); const sig = request.headers.get('x-razorpay-signature') || '';
  const want = await hmacHex(env.RAZORPAY_WEBHOOK_SECRET, raw);
  if (want.length !== sig.length || [...want].some((c, i) => c !== sig[i])) return err('Bad signature', 401);
  let ev; try { ev = JSON.parse(raw); } catch { return err('Bad JSON'); }
  if (ev.event !== 'payment.captured') return json({ ok: true, ignored: ev.event });
  const pay = ev.payload && ev.payload.payment && ev.payload.payment.entity; if (!pay) return err('No payment entity');
  if (await env.PLM_KV.get('paid:' + pay.id)) return json({ ok: true, duplicate: true });
  const ordRaw = await env.PLM_KV.get('ord:' + pay.order_id); if (!ordRaw) return json({ ok: true, unknownOrder: pay.order_id });
  const ord = JSON.parse(ordRaw);
  if (pay.amount < ord.amount || pay.currency !== 'INR') return err('Amount mismatch', 400);
  const u = await getUserById(env, ord.uid); if (!u) return json({ ok: true, noUser: ord.uid });
  extendPlan(u, ord.plan, 1); await putUser(env, u);
  await env.PLM_KV.put('paid:' + pay.id, JSON.stringify({ uid: u.id, plan: ord.plan, at: new Date().toISOString() }));
  await env.PLM_KV.put('ord:' + pay.order_id, JSON.stringify({ ...ord, status: 'paid', paymentId: pay.id, paidAt: new Date().toISOString() }), { expirationTtl: 30 * 86400 });
  return json({ ok: true });
});
