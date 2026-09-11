/* Backend unit tests: run the Pages Functions in node with a fake KV + env. */
import test from 'node:test';
import assert from 'node:assert/strict';

function fakeKV() { const m = new Map(); return { m, async get(k) { return m.has(k) ? m.get(k) : null; }, async put(k, v) { m.set(k, String(v)); }, async delete(k) { m.delete(k); }, async list({ prefix }) { return { keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })) }; } }; }
const env = { PLM_KV: fakeKV(), SESSION_SECRET: 'test-secret-1234567890', ADMIN_TOKEN: 'admin-tok' };
const req = (path, { method = 'GET', body, cookie = '', headers = {} } = {}) => new Request('https://x.test' + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body != null ? JSON.stringify(body) : undefined });
const cookieOf = res => { const c = res.headers.get('Set-Cookie') || ''; const m = c.match(/plm_session=([^;]*)/); return m ? 'plm_session=' + m[1] : ''; };

const auth = (await import('../functions/api/auth/[action].js')).onRequest;
const version = (await import('../functions/api/version.js')).onRequestGet;
const data = await import('../functions/api/data.js');
const admin = (await import('../functions/api/admin.js')).onRequest;
const lib = await import('../functions/api/_lib.js');

test('version reports backend version equal to the app', async () => {
  const j = await (await version({ env })).json();
  const fs = await import('node:fs'); const src = fs.readFileSync(new URL('../app/store.js', import.meta.url), 'utf8');
  const appV = src.match(/APP_VERSION = '([^']+)'/)[1];
  assert.equal(j.version, appV, 'frontend/backend versions must be in step');
  assert.equal(j.auth, true); assert.equal(j.ai, false); assert.equal(j.billing, false);
});

test('signup → me → login → password → delete', async () => {
  let r = await auth({ request: req('/api/auth/signup', { method: 'POST', body: { email: 'Seller@Example.com', password: 'hunter2222', name: 'Test Seller' } }), env, params: { action: 'signup' } });
  assert.equal(r.status, 200); const ck = cookieOf(r); assert.ok(ck.length > 20);
  r = await auth({ request: req('/api/auth/me', { cookie: ck }), env, params: { action: 'me' } }); let j = await r.json();
  assert.equal(j.user.email, 'seller@example.com'); assert.equal(j.user.plan, 'free');
  r = await auth({ request: req('/api/auth/signup', { method: 'POST', body: { email: 'seller@example.com', password: 'hunter2222' } }), env, params: { action: 'signup' } }); assert.equal(r.status, 409);
  r = await auth({ request: req('/api/auth/login', { method: 'POST', body: { email: 'seller@example.com', password: 'wrongpass1' } }), env, params: { action: 'login' } }); assert.equal(r.status, 401);
  r = await auth({ request: req('/api/auth/login', { method: 'POST', body: { email: 'seller@example.com', password: 'hunter2222' } }), env, params: { action: 'login' } }); assert.equal(r.status, 200);
  const ck2 = cookieOf(r);
  r = await auth({ request: req('/api/auth/me', { cookie: 'plm_session=' + ck2.slice(12, -3) + 'xxx' }), env, params: { action: 'me' } }); assert.equal(r.status, 401, 'tampered cookie rejected');
  r = await auth({ request: req('/api/auth/password', { method: 'POST', cookie: ck2, body: { oldPassword: 'hunter2222', newPassword: 'newpass9999' } }), env, params: { action: 'password' } }); assert.equal(r.status, 200);
  r = await auth({ request: req('/api/auth/me', { cookie: ck2 }), env, params: { action: 'me' } }); assert.equal(r.status, 401, 'old session invalid after password change');
  const ck3 = cookieOf(r) || cookieOf(await auth({ request: req('/api/auth/login', { method: 'POST', body: { email: 'seller@example.com', password: 'newpass9999' } }), env, params: { action: 'login' } }));
  // workspace round trip with plan limit
  r = await data.onRequestPut({ request: req('/api/data', { method: 'PUT', cookie: ck3, body: { products: [{ id: 'p1', productType: 'X', images: [{ data: 'data:...' }, { url: 'https://a/b.jpg' }] }], listings: [], perf: [], channels: [], settings: { id: 'app' } } }), env }); assert.equal(r.status, 200);
  r = await data.onRequestGet({ request: req('/api/data', { cookie: ck3 }), env }); j = await r.json(); assert.equal(j.products[0].images.length, 1, 'local previews stripped from cloud copy');
  const many = Array.from({ length: 26 }, (_, i) => ({ id: 'p' + i, productType: 'X' }));
  r = await data.onRequestPut({ request: req('/api/data', { method: 'PUT', cookie: ck3, body: { products: many } }), env }); assert.equal(r.status, 402, 'free plan caps cloud products at 25');
  // admin extends plan → cap lifts
  r = await admin({ request: req('/api/admin', { method: 'POST', headers: { 'x-admin-token': 'admin-tok' }, body: { email: 'seller@example.com', plan: 'starter', months: 2 } }), env }); j = await r.json(); assert.equal(j.user.plan, 'starter'); assert.ok(j.user.planUntil > new Date().toISOString());
  r = await admin({ request: req('/api/admin', { method: 'POST', headers: { 'x-admin-token': 'nope' }, body: {} }), env }); assert.equal(r.status, 403);
  r = await data.onRequestPut({ request: req('/api/data', { method: 'PUT', cookie: ck3, body: { products: many } }), env }); assert.equal(r.status, 200);
  r = await auth({ request: req('/api/auth/delete', { method: 'POST', cookie: ck3, body: { password: 'newpass9999' } }), env, params: { action: 'delete' } }); assert.equal(r.status, 200);
  r = await auth({ request: req('/api/auth/me', { cookie: ck3 }), env, params: { action: 'me' } }); assert.equal(r.status, 401);
});

test('unconfigured deployment fails closed but /me answers', async () => {
  const bare = { PLM_KV: fakeKV() };
  let r = await auth({ request: req('/api/auth/signup', { method: 'POST', body: { email: 'a@b.co', password: 'password1' } }), env: bare, params: { action: 'signup' } }); assert.equal(r.status, 503);
  r = await auth({ request: req('/api/auth/me'), env: bare, params: { action: 'me' } }); assert.equal((await r.json()).user, null);
  const ai = (await import('../functions/api/ai.js')).onRequestPost;
  r = await ai({ request: req('/api/ai', { method: 'POST', body: {} }), env: bare }); assert.equal(r.status, 503);
});

test('webhook rejects a bad signature and extendPlan stacks months', async () => {
  const wh = await import('../functions/api/billing/webhook.js');
  const benv = { ...env, RAZORPAY_KEY_ID: 'k', RAZORPAY_KEY_SECRET: 's', RAZORPAY_WEBHOOK_SECRET: 'whs' };
  const r = await wh.onRequestPost({ request: new Request('https://x.test/api/billing/webhook', { method: 'POST', headers: { 'x-razorpay-signature': 'bad' }, body: '{}' }), env: benv }); assert.equal(r.status, 401);
  const u = { plan: 'pro', planUntil: new Date(Date.now() + 10 * 864e5).toISOString() }; wh.extendPlan(u, 'pro', 1);
  assert.ok(new Date(u.planUntil) > new Date(Date.now() + 35 * 864e5), 'active plan is extended, not restarted');
});

test('rate limiter counts within a window', async () => {
  const e = { PLM_KV: fakeKV() }; let ok = 0; for (let i = 0; i < 5; i++) if (await lib.rateLimit(e, 'x', 3, 60)) ok++; assert.equal(ok, 3);
});
