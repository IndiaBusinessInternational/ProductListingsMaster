import { json, err, notConfigured, requireUser, configured, handle } from '../_lib.js';
export const onRequestGet = handle(async ({ request, env }) => {
  if (!configured(env).billing) return notConfigured('Online payment');
  const u = await requireUser(request, env);
  const id = new URL(request.url).searchParams.get('order') || '';
  const raw = await env.PLM_KV.get('ord:' + id); if (!raw) return err('Unknown order', 404);
  const ord = JSON.parse(raw); if (ord.uid !== u.id) return err('Not your order', 403);
  return json({ orderId: id, status: ord.status, plan: ord.plan, paidAt: ord.paidAt || null });
});
