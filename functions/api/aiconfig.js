/* /api/aiconfig — the hidden CEO panel (v1.3.0). POST {token, action:'get'|'set', engine}.
 * token = a CEO Auth token (the PIN never reaches this app); every call re-checks it with CEO Auth.
 * get → {engine, engines:[{id,label,ready}]};  set → saves KV 'cfg:ai_engine'. */
import { json, err, notConfigured, handle, readJson, rateLimit, clientIp, AI_ENGINES, activeEngine, engineReady, ceoTokenOk } from './_lib.js';
export const onRequestPost = handle(async ({ request, env }) => {
  if (!env.PLM_KV) return notConfigured('Storage');
  if (!await rateLimit(env, 'ceo:' + clientIp(request), 20, 600)) return err('Too many attempts; wait ten minutes.', 429);
  const b = await readJson(request) || {};
  if (!await ceoTokenOk(env, b.token)) return err('CEO access expired or not valid. Enter the PIN again.', 403, { code: 'ceo_denied' });
  if (b.action === 'set') {
    if (!AI_ENGINES.some(e => e.id === b.engine)) return err('Unknown engine');
    await env.PLM_KV.put('cfg:ai_engine', b.engine);
  }
  const engine = await activeEngine(env);
  return json({ ok: true, engine, engines: AI_ENGINES.map(e => ({ id: e.id, label: e.label, ready: e.id === 'off' || engineReady(env, e.id), needs: e.needs })) });
});
