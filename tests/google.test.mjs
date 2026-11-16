/* v1.5.0 owner-only Continue with Google: /api/auth/google with a fake Google (own RSA keys + faked fetch of the certs). */
import test from 'node:test';
import assert from 'node:assert/strict';

function fakeKV() { const m = new Map(); return { m, async get(k) { return m.has(k) ? m.get(k) : null; }, async put(k, v) { m.set(k, String(v)); }, async delete(k) { m.delete(k); }, async list({ prefix }) { return { keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })) }; } }; }
const req = (path, { method = 'GET', body, cookie = '', headers = {} } = {}) => new Request('https://x.test' + path, { method, headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '10.0.0.' + Math.floor(Math.random() * 250), ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body != null ? JSON.stringify(body) : undefined });
const cookieOf = res => { const c = res.headers.get('Set-Cookie') || ''; const m = c.match(/plm_session=([^;]*)/); return m ? 'plm_session=' + m[1] : ''; };

const lib = await import('../functions/api/_lib.js');
const auth = (await import('../functions/api/auth/[action].js')).onRequest;
const data = await import('../functions/api/data.js');
const usage = (await import('../functions/api/usage.js')).onRequestGet;
const order = (await import('../functions/api/billing/order.js')).onRequestPost;
const version = (await import('../functions/api/version.js')).onRequestGet;

/* ── a fake Google: our own RS256 key pair, served as the JWKS ── */
const KID = 'test-kid-1';
const gen = () => crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const good = await gen(), evil = await gen();
const pubJwk = await crypto.subtle.exportKey('jwk', good.publicKey);
const b64uStr = s => Buffer.from(s).toString('base64url');
async function token(claims = {}, { key = good.privateKey, kid = KID } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const c = { iss: 'https://accounts.google.com', aud: lib.GOOGLE_CLIENT_ID, sub: '1234567890', email: lib.OWNER_EMAIL, email_verified: true, name: 'IBI Owner', iat: now, exp: now + 3600, ...claims };
  const head = b64uStr(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' })), body = b64uStr(JSON.stringify(c));
  const sig = Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(head + '.' + body))).toString('base64url');
  return `${head}.${body}.${sig}`;
}
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u === 'https://www.googleapis.com/oauth2/v3/certs') return new Response(JSON.stringify({ keys: [{ ...pubJwk, kid: KID, alg: 'RS256', use: 'sig' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  if (u === 'https://api.razorpay.com/v1/orders') { const b = JSON.parse(opts.body); return new Response(JSON.stringify({ id: 'order_test1', amount: b.amount, currency: 'INR' }), { status: 200 }); }
  return realFetch(url, opts);
};

const mkEnv = () => ({ PLM_KV: fakeKV(), SESSION_SECRET: 'test-secret-1234567890', RAZORPAY_KEY_ID: 'rzp_test_k', RAZORPAY_KEY_SECRET: 's', RAZORPAY_WEBHOOK_SECRET: 'whs' });
const google = (env, credential) => auth({ request: req('/api/auth/google', { method: 'POST', body: { credential } }), env, params: { action: 'google' } });
const me = async (env, cookie) => { const r = await auth({ request: req('/api/auth/me', { cookie }), env, params: { action: 'me' } }); return { status: r.status, user: (await r.json()).user }; };

test('owner token reuses the existing account, keeps its password, starts a session with the owner plan', async () => {
  const env = mkEnv();
  // the owner account already exists (made earlier with a password) — and password sign-up never grants owner
  let r = await auth({ request: req('/api/auth/signup', { method: 'POST', body: { email: 'IndiaBusinessInternational@gmail.com', password: 'old-password-1' } }), env, params: { action: 'signup' } });
  assert.equal(r.status, 200);
  const pwCookie = cookieOf(r);
  let m = await me(env, pwCookie);
  assert.equal(m.user.plan, 'free', 'password sign-up with the owner email is NOT the owner plan'); assert.equal(m.user.owner, false);
  const before = await lib.getUserByEmail(env, lib.OWNER_EMAIL);

  r = await google(env, await token());
  assert.equal(r.status, 200);
  const j = await r.json(); assert.equal(j.user.plan, 'business'); assert.equal(j.user.owner, true); assert.equal(j.user.planUntil, null);
  assert.equal(j.user.id, before.id, 'same account reused');
  const gCookie = cookieOf(r); assert.equal(gCookie.split('=')[1].split('.').length, 4, 'Google session carries the signed g marker');
  m = await me(env, gCookie); assert.equal(m.status, 200); assert.equal(m.user.plan, 'business'); assert.equal(m.user.owner, true);

  const after = await lib.getUserByEmail(env, lib.OWNER_EMAIL);
  assert.equal(after.pwHash, before.pwHash, 'password unchanged'); assert.equal(after.salt, before.salt);
  assert.equal(after.googleVerified.email, lib.OWNER_EMAIL); assert.ok(!('viaGoogle' in JSON.parse(env.PLM_KV.m.get(await lib.userKey(lib.OWNER_EMAIL)))), 'session flag never stored');

  // the old password still signs in — but that session is not the owner plan
  r = await auth({ request: req('/api/auth/login', { method: 'POST', body: { email: lib.OWNER_EMAIL, password: 'old-password-1' } }), env, params: { action: 'login' } });
  assert.equal(r.status, 200); assert.equal((await r.json()).user.plan, 'free');
  m = await me(env, cookieOf(r)); assert.equal(m.user.plan, 'free', 'password session of a Google-verified owner is still not owner');

  // Business limits server-side with the Google session
  const many = Array.from({ length: 400 }, (_, i) => ({ id: 'p' + i, productType: 'X' }));
  r = await data.onRequestPut({ request: req('/api/data', { method: 'PUT', cookie: gCookie, body: { products: many } }), env }); assert.equal(r.status, 200);
  r = await data.onRequestPut({ request: req('/api/data', { method: 'PUT', cookie: cookieOf(await auth({ request: req('/api/auth/login', { method: 'POST', body: { email: lib.OWNER_EMAIL, password: 'old-password-1' } }), env, params: { action: 'login' } })), body: { products: many } }), env }); assert.equal(r.status, 402, 'password session keeps free limits');
  const us = await (await usage({ request: req('/api/usage', { cookie: gCookie }), env })).json(); assert.equal(us.plan, 'business'); assert.equal(us.limit, lib.PLANS.business.ai);

  // billing still works for the owner (Razorpay window test)
  r = await order({ request: req('/api/billing/order', { method: 'POST', cookie: gCookie, body: { plan: 'starter' } }), env });
  assert.equal(r.status, 200); const o = await r.json(); assert.equal(o.orderId, 'order_test1'); assert.equal(o.amount, lib.PLANS.starter.price * 100);
});

test('owner account missing → created on Google sign-in', async () => {
  const env = mkEnv();
  const r = await google(env, await token({ email: 'INDIABUSINESSINTERNATIONAL@gmail.com' }));
  assert.equal(r.status, 200); assert.equal((await r.json()).user.plan, 'business');
  const u = await lib.getUserByEmail(env, lib.OWNER_EMAIL); assert.ok(u && u.pwHash && u.googleVerified);
});

test('any other Google account → 403 with the plain message', async () => {
  const env = mkEnv();
  const r = await google(env, await token({ email: 'someone@gmail.com' }));
  assert.equal(r.status, 403);
  assert.equal((await r.json()).error, 'Google sign-in is for the IBI owner only. Please sign in or create an account with your email and password.');
  assert.equal(r.headers.get('Set-Cookie'), null); assert.equal(await lib.getUserByEmail(env, 'someone@gmail.com'), null);
});

test('bad signature / wrong audience / expired / unverified / junk → 401', async () => {
  const env = mkEnv();
  const cases = {
    'bad signature': await token({}, { key: evil.privateKey }),
    'wrong audience': await token({ aud: 'other-app.apps.googleusercontent.com' }),
    'expired': await token({ exp: Math.floor(Date.now() / 1000) - 3600, iat: Math.floor(Date.now() / 1000) - 7200 }),
    'wrong issuer': await token({ iss: 'https://evil.example' }),
    'email not verified': await token({ email_verified: false }),
    'unknown key': await token({}, { kid: 'nope' }),
    'junk': 'not-a-token', 'empty': '',
  };
  for (const [name, cred] of Object.entries(cases)) {
    const r = await google(env, cred);
    assert.equal(r.status, 401, name); assert.equal((await r.json()).code, 'google_invalid', name); assert.equal(r.headers.get('Set-Cookie'), null, name);
  }
});

test('a password session cannot be turned into a Google session by adding the g marker', async () => {
  const env = mkEnv();
  await google(env, await token());   // owner is Google-verified
  const r = await auth({ request: req('/api/auth/login', { method: 'POST', body: { email: lib.OWNER_EMAIL, password: 'x' } }), env, params: { action: 'login' } });
  assert.equal(r.status, 401, 'unknown random password');
  const u = await lib.getUserByEmail(env, lib.OWNER_EMAIL);
  const plain = await lib.makeSession(env, u); const [id, exp, sig] = plain.split('.');
  const m = await me(env, `plm_session=${id}.${exp}.g.${sig}`); assert.equal(m.status, 401);
  const ok = await me(env, `plm_session=${plain}`); assert.equal(ok.user.plan, 'free');
});

test('/api/version advertises Google sign-in and the client id', async () => {
  const j = await (await version({ env: mkEnv() })).json();
  assert.equal(j.version, '1.5.0'); assert.equal(j.google, true); assert.equal(j.googleClientId, lib.GOOGLE_CLIENT_ID);
});
