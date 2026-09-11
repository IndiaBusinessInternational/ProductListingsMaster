/* POST /api/billing/order {plan} → Razorpay order. Amount is set HERE from PLANS, never trusted from the client. */
import { json, err, notConfigured, requireUser, PLANS, configured, handle, randomHex } from '../_lib.js';
export const onRequestPost = handle(async ({ request, env }) => {
  if (!configured(env).billing) return notConfigured('Online payment');
  const u = await requireUser(request, env);
  const b = await request.json().catch(() => ({})); const plan = PLANS[b.plan];
  if (!plan || !plan.price) return err('Unknown plan');
  const receipt = `plm_${u.id}_${Date.now().toString(36)}`;
  const r = await fetch('https://api.razorpay.com/v1/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`) }, body: JSON.stringify({ amount: plan.price * 100, currency: 'INR', receipt, notes: { uid: u.id, plan: b.plan, email: u.email } }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return err('Payment gateway error: ' + ((j.error && j.error.description) || r.status), 502);
  await env.PLM_KV.put('ord:' + j.id, JSON.stringify({ uid: u.id, plan: b.plan, amount: plan.price * 100, status: 'created', createdAt: new Date().toISOString(), nonce: randomHex(4) }), { expirationTtl: 7 * 86400 });
  return json({ orderId: j.id, amount: j.amount, currency: 'INR', keyId: env.RAZORPAY_KEY_ID, plan: b.plan });
});
