import { VERSION, json, configured, activeEngine, engineReady, googleClientId } from './_lib.js';
export const onRequestGet = async ({ env }) => {
  const c = configured(env);
  const engine = await activeEngine(env);
  c.ai = engineReady(env, engine);   // v1.3.0: AI is "on" only when the engine the CEO chose can run
  return json({ app: 'IBI Product Listings Master', version: VERSION, features: Object.keys(c).filter(k => c[k]), ai: c.ai, billing: c.billing, suggest: c.suggest, auth: c.auth, google: !!c.google, googleClientId: c.google ? googleClientId(env) : null, time: new Date().toISOString() });
};
