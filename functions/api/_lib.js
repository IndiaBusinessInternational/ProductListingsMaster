/* IBI Product Listings Master — shared backend helpers (Cloudflare Pages Functions).
 * Files starting with "_" are not routed. KV binding: PLM_KV. Env vars: see README.
 * VERSION moves with the app badge every release (frontend-backend-same-version). */
export const VERSION = '1.4.1';
export const PLANS = {
  free: { name: 'Free', price: 0, products: 25, ai: 10, custom: 1, seats: 1 },
  starter: { name: 'Starter', price: 1499, products: 300, ai: 150, custom: 3, seats: 1 },
  pro: { name: 'Pro', price: 4499, products: 3000, ai: 600, custom: 99, seats: 3 },
  business: { name: 'Business', price: 11999, products: 25000, ai: 2500, custom: 99, seats: 10 },
};
export const SESSION_COOKIE = 'plm_session';
export const SESSION_DAYS = 30;

export const json = (obj, status = 200, headers = {}) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
export const err = (message, status = 400, extra = {}) => json({ error: message, ...extra }, status);
export const notConfigured = what => json({ error: `${what} is not configured on this deployment`, code: 'not_configured' }, 503);

const enc = new TextEncoder();
export const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
export async function sha256(s) { return hex(await crypto.subtle.digest('SHA-256', enc.encode(s))); }
export function randomHex(n = 16) { const a = new Uint8Array(n); crypto.getRandomValues(a); return hex(a); }
export async function hmac(secret, data) { const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return b64u(await crypto.subtle.sign('HMAC', k, enc.encode(data))); }
export async function hashPassword(pw, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100000 }, key, 256);
  return hex(bits);
}
export function safeEq(a, b) { a = String(a || ''); b = String(b || ''); if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

/* ── KV user model ── user:<sha256(email)> = {id,email,name,pwHash,salt,sessionSalt,plan,planUntil,createdAt}; uid:<id> = email */
export const userKey = async email => 'user:' + await sha256(email.trim().toLowerCase());
export async function getUserByEmail(env, email) { const raw = await env.PLM_KV.get(await userKey(email)); return raw ? JSON.parse(raw) : null; }
export async function getUserById(env, id) { const email = await env.PLM_KV.get('uid:' + id); return email ? getUserByEmail(env, email) : null; }
export async function putUser(env, u) { await env.PLM_KV.put(await userKey(u.email), JSON.stringify(u)); await env.PLM_KV.put('uid:' + u.id, u.email); }
export function planOf(u) { if (!u) return 'free'; if (u.plan && u.plan !== 'free' && u.planUntil && u.planUntil < new Date().toISOString()) return 'free'; return PLANS[u.plan] ? u.plan : 'free'; }
export const monthKey = () => new Date().toISOString().slice(0, 7);
export async function aiUsed(env, uid) { return +(await env.PLM_KV.get(`usage:${uid}:${monthKey()}`)) || 0; }
export function publicUser(u, used) { return { id: u.id, email: u.email, name: u.name || '', plan: planOf(u), planUntil: u.planUntil || null, aiUsed: used || 0, createdAt: u.createdAt }; }

/* ── sessions: cookie = uid.exp.sig, sig = HMAC(SESSION_SECRET + user.sessionSalt, uid.exp) ── */
export async function makeSession(env, u) { const exp = Date.now() + SESSION_DAYS * 864e5; const sig = await hmac(env.SESSION_SECRET + u.sessionSalt, `${u.id}.${exp}`); return `${u.id}.${exp}.${sig}`; }
export function cookieHeader(value, maxAge) { return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`; }
export function readCookie(request, name) { const c = request.headers.get('Cookie') || ''; const m = c.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)')); return m ? m[1] : ''; }
export async function sessionUser(request, env) {
  if (!env.SESSION_SECRET || !env.PLM_KV) return null;
  const tok = readCookie(request, SESSION_COOKIE); if (!tok) return null;
  const [id, exp, sig] = tok.split('.'); if (!id || !exp || !sig || +exp < Date.now()) return null;
  const u = await getUserById(env, id); if (!u) return null;
  const want = await hmac(env.SESSION_SECRET + u.sessionSalt, `${id}.${exp}`);
  return safeEq(want, sig) ? u : null;
}
export async function requireUser(request, env) { const u = await sessionUser(request, env); if (!u) throw json({ error: 'Sign in required', code: 'unauthenticated' }, 401); return u; }

/* ── rate limiting (KV counter, eventually consistent — a brake, not a wall) ── */
export async function rateLimit(env, key, limit, windowSec) {
  if (!env.PLM_KV) return true;
  const k = `rl:${key}:${Math.floor(Date.now() / 1000 / windowSec)}`;
  const n = (+(await env.PLM_KV.get(k)) || 0) + 1;
  await env.PLM_KV.put(k, String(n), { expirationTtl: windowSec + 60 });
  return n <= limit;
}
export const clientIp = request => request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
export async function readJson(request) { try { return await request.json(); } catch { return null; } }
export const isEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || ''));
export const configured = env => ({
  kv: !!env.PLM_KV, auth: !!(env.PLM_KV && env.SESSION_SECRET),
  ai: AI_ENGINES.some(e => engineReady(env, e.id)),   // any engine usable; /api/version reports the ACTIVE one
  billing: !!(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET && env.RAZORPAY_WEBHOOK_SECRET && env.PLM_KV), suggest: true, admin: !!env.ADMIN_TOKEN,
});
export function adminOk(request, env) { if (!env.ADMIN_TOKEN) return false; return safeEq(request.headers.get('x-admin-token') || '', env.ADMIN_TOKEN); }
/* Wrap a handler so a thrown Response is returned and any other error becomes a clean 500. */
export const handle = fn => async ctx => { try { return await fn(ctx); } catch (e) { if (e instanceof Response) return e; console.error(e); return err('Server error: ' + (e && e.message ? e.message : String(e)), 500); } };

/* ── AI engines (v1.3.0) ──
 * The CEO picks ONE engine from a hidden panel (5 taps on the version badge + the CEO PIN,
 * checked by IBI CEO Auth). The choice lives in KV 'cfg:ai_engine'; with none saved the
 * default is the office laptop's local Qwen (CEO decision, 24 Sep 2026; the laptop's one model is Qwen 3.8 27B
 * since 7 Oct 2026). Only the chosen engine runs — there is never a fallback to another one. */
export const DEFAULT_ENGINE = 'local';
export const DEFAULT_LOCAL_AI_URL = 'https://ai-local.indiabusinessinternational.online';
export const AI_ENGINES = [
  { id: 'local',     label: 'Laptop server — Qwen 3.8 27B (free, streams, ~15–20 min per listing, laptop off 10 PM–6 AM)', needs: 'LOCAL_AI_CODE' },
  { id: 'qwen',      label: 'Qwen 3.8 Flash — cloud via OpenRouter', needs: 'OPENROUTER_API_KEY' },
  { id: 'gemini',    label: 'Google Gemini 3.x Flash', needs: 'GEMINI_API_KEY' },
  { id: 'anthropic', label: 'Anthropic Claude', needs: 'ANTHROPIC_API_KEY' },
  { id: 'deepseek',  label: 'DeepSeek V4 Flash', needs: 'DEEPSEEK_API_KEY' },
  { id: 'off',       label: 'OFF — pause AI for every customer', needs: '' },
];
export function engineReady(env, id) { const e = AI_ENGINES.find(x => x.id === id); return !!e && id !== 'off' && !!env[e.needs]; }
export async function activeEngine(env) {
  let id = '';
  try { id = env.PLM_KV ? (await env.PLM_KV.get('cfg:ai_engine')) || '' : ''; } catch { /* KV hiccup: fall through to the default */ }
  if (!AI_ENGINES.some(e => e.id === id)) id = String(env.AI_PROVIDER || DEFAULT_ENGINE).toLowerCase();
  return AI_ENGINES.some(e => e.id === id) ? id : DEFAULT_ENGINE;
}

/* ── CEO check: the token comes from IBI CEO Auth (the one Apps Script that holds the CEO PIN);
 * only CEO Auth can validate its signature, so the server asks it. Apps Script sometimes
 * answers late or with its own HTML 404 when the Google account is busy, so try three times. */
export const CEO_AUTH_URL = 'https://script.google.com/macros/s/AKfycbxIW4j7m51JjX6yt38-a1X6XrDRyZp3czMYN8eXECfP9H2twjfrgLaozWCCl843AgWo0g/exec';
export async function ceoTokenOk(env, token) {
  if (!token || typeof token !== 'string' || !/^\d+\.[A-Za-z0-9_=-]+$/.test(token)) return false;
  if (+token.split('.')[0] < Date.now()) return false;
  const url = env.CEO_AUTH_URL || CEO_AUTH_URL;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'checkToken', token }) });
      const j = JSON.parse(await r.text());
      return j && j.ok === true;
    } catch { if (i < 2) await new Promise(res => setTimeout(res, 1500 * (i + 1))); }
  }
  throw json({ error: 'The CEO check service is busy; try again in a minute.', code: 'ceo_auth_busy' }, 503);
}
