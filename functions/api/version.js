import { VERSION, json, configured } from './_lib.js';
export const onRequestGet = async ({ env }) => {
  const c = configured(env);
  return json({ app: 'IBI Product Listings Master', version: VERSION, features: Object.keys(c).filter(k => c[k]), ai: c.ai, billing: c.billing, suggest: c.suggest, auth: c.auth, time: new Date().toISOString() });
};
