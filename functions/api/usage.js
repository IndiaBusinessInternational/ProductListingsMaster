import { json, notConfigured, requireUser, planOf, PLANS, aiUsed, handle } from './_lib.js';
export const onRequestGet = handle(async ({ request, env }) => {
  if (!env.PLM_KV || !env.SESSION_SECRET) return notConfigured('Accounts');
  const u = await requireUser(request, env); const plan = planOf(u);
  return json({ plan, used: await aiUsed(env, u.id), limit: PLANS[plan].ai, products: PLANS[plan].products, planUntil: u.planUntil || null });
});
