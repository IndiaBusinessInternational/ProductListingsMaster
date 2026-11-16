/* IBI Product Listings Master — shared backend helpers (Cloudflare Pages Functions).
 * Files starting with "_" are not routed. KV binding: PLM_KV. Env vars: see README.
 * VERSION moves with the app badge every release (frontend-backend-same-version). */
export const VERSION = '1.5.0';
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
/* ── the IBI owner (v1.5.0, Founder 16 Nov 2026: one owner account across all IBI web apps = his Google account) ──
 * Business-level limits, free, no expiry — never sold, never on the pricing grid. Granted only when ALL hold:
 * the account email is OWNER_EMAIL, Google has verified it (u.googleVerified, written only by /api/auth/google),
 * and THIS session was started by Continue with Google (u.viaGoogle, set by sessionUser from a signed 'g' cookie,
 * non-enumerable so putUser never stores it). Typing the owner email into the password form can never grant it. */
export const OWNER_EMAIL = 'indiabusinessinternational@gmail.com';
export const normEmail = s => String(s || '').trim().toLowerCase();
export const isOwner = u => !!u && normEmail(u.email) === OWNER_EMAIL && !!u.googleVerified && normEmail(u.googleVerified.email) === OWNER_EMAIL && u.viaGoogle === true;
export function planOf(u) { if (!u) return 'free'; if (isOwner(u)) return 'business'; if (u.plan && u.plan !== 'free' && u.planUntil && u.planUntil < new Date().toISOString()) return 'free'; return PLANS[u.plan] ? u.plan : 'free'; }
export const monthKey = () => new Date().toISOString().slice(0, 7);
export async function aiUsed(env, uid) { return +(await env.PLM_KV.get(`usage:${uid}:${monthKey()}`)) || 0; }
export function publicUser(u, used) { const owner = isOwner(u); return { id: u.id, email: u.email, name: u.name || '', plan: planOf(u), planUntil: owner ? null : u.planUntil || null, owner, aiUsed: used || 0, createdAt: u.createdAt }; }

/* ── sessions: cookie = uid.exp.sig, sig = HMAC(SESSION_SECRET + user.sessionSalt, uid.exp);
 * a Google sign-in session is uid.exp.g.sig with the 'g' inside the signed text, so it cannot be added by hand ── */
export async function makeSession(env, u, via) {
  const exp = Date.now() + SESSION_DAYS * 864e5, body = via === 'google' ? `${u.id}.${exp}.g` : `${u.id}.${exp}`;
  return `${body}.${await hmac(env.SESSION_SECRET + u.sessionSalt, body)}`;
}
export function cookieHeader(value, maxAge) { return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`; }
export function readCookie(request, name) { const c = request.headers.get('Cookie') || ''; const m = c.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)')); return m ? m[1] : ''; }
export async function sessionUser(request, env) {
  if (!env.SESSION_SECRET || !env.PLM_KV) return null;
  const tok = readCookie(request, SESSION_COOKIE); if (!tok) return null;
  const parts = tok.split('.'); if (parts.length !== 3 && !(parts.length === 4 && parts[2] === 'g')) return null;
  const id = parts[0], exp = parts[1], sig = parts[parts.length - 1]; if (!id || !exp || !sig || +exp < Date.now()) return null;
  const u = await getUserById(env, id); if (!u) return null;
  const want = await hmac(env.SESSION_SECRET + u.sessionSalt, parts.slice(0, -1).join('.'));
  if (!safeEq(want, sig)) return null;
  Object.defineProperty(u, 'viaGoogle', { value: parts.length === 4, enumerable: false, configurable: true });
  return u;
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
  google: !!(env.PLM_KV && env.SESSION_SECRET && googleClientId(env)),   // v1.5.0: owner-only Continue with Google
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
  { id: 'qwen',      label: 'DeepSeek V4.1 Flash (Qwen 3.8 Flash backup) — cloud via OpenRouter', needs: 'OPENROUTER_API_KEY' },
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

/* ── Continue with Google (v1.5.0, owner only) — copied from IBI Apps functions/api/_lib.js, where it is proven live.
 * The browser gets a Google ID token (Google Identity Services); the server checks its RS256 signature against Google's
 * published keys, the issuer, the audience (our OAuth client), the expiry and `email_verified`. Client id: env
 * GOOGLE_CLIENT_ID, else IBI's OAuth client (the same one IBI Apps uses). */
export const GOOGLE_CLIENT_ID = '861626146743-tc8qeau1ijvb0g01ujifp1v0m60gdcan.apps.googleusercontent.com';
export const googleClientId = env => String((env && env.GOOGLE_CLIENT_ID) || GOOGLE_CLIENT_ID).trim();
const GOOGLE_CERTS = 'https://www.googleapis.com/oauth2/v3/certs';
let googleKeys = { at: 0, keys: [] };
export const _resetGoogleKeys = () => { googleKeys = { at: 0, keys: [] }; };   // tests only
async function googleJwks(force) {
  if (!force && googleKeys.keys.length && Date.now() - googleKeys.at < 3600e3) return googleKeys.keys;
  const r = await fetch(GOOGLE_CERTS); const j = await r.json().catch(() => ({}));
  if (!r.ok || !Array.isArray(j.keys)) throw new Error('Google signing keys are unavailable');
  googleKeys = { at: Date.now(), keys: j.keys }; return j.keys;
}
const b64uBytes = s => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4)), c => c.charCodeAt(0));
const b64uJson = s => JSON.parse(new TextDecoder().decode(b64uBytes(s)));
export async function verifyGoogleIdToken(env, token) {
  const parts = String(token || '').split('.'); if (parts.length !== 3) throw new Error('malformed token');
  let head, claims; try { head = b64uJson(parts[0]); claims = b64uJson(parts[1]); } catch { throw new Error('malformed token'); }
  if (head.alg !== 'RS256' || !head.kid) throw new Error('unexpected token algorithm');
  let jwk = (await googleJwks(false)).find(k => k.kid === head.kid);
  if (!jwk) jwk = (await googleJwks(true)).find(k => k.kid === head.kid);   // Google rotates its keys
  if (!jwk) throw new Error('unknown signing key');
  const key = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64uBytes(parts[2]), enc.encode(parts[0] + '.' + parts[1]))) throw new Error('bad signature');
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss)) throw new Error('wrong issuer');
  if (claims.aud !== googleClientId(env)) throw new Error('the token was issued for another app');
  const now = Date.now() / 1000;
  if (!(+claims.exp > now - 60)) throw new Error('the token has expired');
  if (+claims.iat > now + 300) throw new Error('the token is from the future');
  if (!(claims.email_verified === true || claims.email_verified === 'true')) throw new Error('Google has not verified this email address');
  const email = normEmail(claims.email); if (!isEmail(email)) throw new Error('no email in the token');
  return { email, sub: String(claims.sub || ''), name: String(claims.name || '').trim().slice(0, 80) };
}
