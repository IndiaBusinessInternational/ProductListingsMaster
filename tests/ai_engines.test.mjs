/* v1.3.0 — CEO-chosen AI engine: hidden panel (/api/aiconfig), laptop streaming, Qwen via OpenRouter,
 * OFF, and customer-safe errors. Every outside service (CEO Auth, the laptop gateway, OpenRouter) is faked
 * by swapping globalThis.fetch, so nothing here touches the network. */
import test from 'node:test';
import assert from 'node:assert/strict';

function fakeKV() { const m = new Map(); return { m, async get(k) { return m.has(k) ? m.get(k) : null; }, async put(k, v) { m.set(k, String(v)); }, async delete(k) { m.delete(k); }, async list({ prefix }) { return { keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })) }; } }; }
const req = (path, { method = 'GET', body, cookie = '' } = {}) => new Request('https://x.test' + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
const cookieOf = res => { const m = (res.headers.get('Set-Cookie') || '').match(/plm_session=([^;]*)/); return m ? 'plm_session=' + m[1] : ''; };

const auth = (await import('../functions/api/auth/[action].js')).onRequest;
const aiconfig = (await import('../functions/api/aiconfig.js')).onRequestPost;
const ai = (await import('../functions/api/ai.js')).onRequestPost;
const version = (await import('../functions/api/version.js')).onRequestGet;

const GOOD = `${Date.now() + 3600e3}.c2lnbmF0dXJl`;          // well-formed, future expiry
const LISTING = { title: 'iINTELLIGENCEi Aluminium Food Strainer 27 cm', bullets: ['STURDY: Aluminium.'], description: 'A strainer.', keywords: 'strainer chalni', highlights: 'Aluminium · 27 cm' };
const realFetch = globalThis.fetch;
let calls = [];
function fakeServices({ ceoOk = true, gatewayChunks = null, openrouter = null } = {}) {
  calls = [];
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url); calls.push({ u, body: opts.body ? JSON.parse(opts.body) : null, headers: opts.headers || {} });
    if (u.includes('script.google.com')) return new Response(JSON.stringify({ ok: ceoOk }), { headers: { 'Content-Type': 'application/json' } });
    if (u.includes('ai-local')) {
      const te = new TextEncoder();
      const stream = new ReadableStream({ start(c) { for (const ch of gatewayChunks) c.enqueue(te.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: ch } }] })}\n\n`)); c.enqueue(te.encode('data: [DONE]\n\n')); c.close(); } });
      return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
    }
    if (u.includes('openrouter.ai')) return openrouter();
    return realFetch(url, opts);
  };
}
async function readSse(res) {
  const txt = await res.text(); const events = [];
  for (const block of txt.split('\n\n')) { const ev = (block.match(/^event: *(.+)$/m) || [])[1]; const d = (block.match(/^data: *(.*)$/m) || [])[1]; if (ev) events.push({ ev, data: JSON.parse(d) }); }
  return events;
}
async function signedIn(env) {
  const r = await auth({ request: req('/api/auth/signup', { method: 'POST', body: { email: 'eng' + Math.random().toString(36).slice(2) + '@x.co', password: 'password1', name: 'T' } }), env, params: { action: 'signup' } });
  return cookieOf(r);
}
const waitUntils = []; const ctx = (request, env) => ({ request, env, waitUntil: p => waitUntils.push(p) });

test('default engine is the laptop; AI reads "off" until LOCAL_AI_CODE exists', async () => {
  let j = await (await version({ env: { PLM_KV: fakeKV() } })).json();
  assert.equal(j.ai, false, 'no code → AI not offered');
  j = await (await version({ env: { PLM_KV: fakeKV(), LOCAL_AI_CODE: 'c' } })).json();
  assert.equal(j.ai, true, 'laptop code → AI on (default engine)');
  j = await (await version({ env: { PLM_KV: fakeKV(), DEEPSEEK_API_KEY: 'k' } })).json();
  assert.equal(j.ai, false, 'a DeepSeek key alone no longer switches AI on — the laptop is the default');
});

test('hidden panel: a valid CEO token reads and sets the engine; anything else is refused', async () => {
  const env = { PLM_KV: fakeKV(), LOCAL_AI_CODE: 'c', OPENROUTER_API_KEY: 'k' };
  fakeServices({ ceoOk: true });
  let r = await aiconfig({ request: req('/api/aiconfig', { method: 'POST', body: { token: GOOD, action: 'get' } }), env });
  let j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.engine, 'local');
  assert.deepEqual(j.engines.filter(e => e.ready).map(e => e.id).sort(), ['local', 'off', 'qwen']);
  assert.equal(calls[0].body.action, 'checkToken', 'the token is checked with CEO Auth, not in this app');
  r = await aiconfig({ request: req('/api/aiconfig', { method: 'POST', body: { token: GOOD, action: 'set', engine: 'qwen' } }), env });
  assert.equal((await r.json()).engine, 'qwen'); assert.equal(env.PLM_KV.m.get('cfg:ai_engine'), 'qwen');
  r = await aiconfig({ request: req('/api/aiconfig', { method: 'POST', body: { token: GOOD, action: 'set', engine: 'nonsense' } }), env });
  assert.equal(r.status, 400);
  fakeServices({ ceoOk: false });
  r = await aiconfig({ request: req('/api/aiconfig', { method: 'POST', body: { token: GOOD, action: 'set', engine: 'off' } }), env });
  assert.equal(r.status, 403); assert.equal(env.PLM_KV.m.get('cfg:ai_engine'), 'qwen', 'refused token changes nothing');
  calls = [];
  r = await aiconfig({ request: req('/api/aiconfig', { method: 'POST', body: { token: '1234.x', action: 'get' } }), env });
  assert.equal(r.status, 403); assert.equal(calls.length, 0, 'an expired token is refused without asking CEO Auth');
  globalThis.fetch = realFetch;
});

test('laptop engine streams progress then a listing, and counts quota once', async () => {
  const env = { PLM_KV: fakeKV(), SESSION_SECRET: 'test-secret-1234567890', LOCAL_AI_CODE: 'secret-code' };
  const ck = await signedIn(env);
  const js = JSON.stringify(LISTING); fakeServices({ gatewayChunks: [js.slice(0, 20), js.slice(20)] });
  const request = req('/api/ai', { method: 'POST', cookie: ck, body: { system: 's', user: 'u', schema: { type: 'object' }, maxTokens: 99999 } });
  const res = await ai(ctx(request, env));
  assert.match(res.headers.get('Content-Type'), /event-stream/);
  const ev = await readSse(res); await Promise.all(waitUntils);
  assert.equal(ev[0].ev, 'progress');
  const done = ev.find(e => e.ev === 'done'); assert.ok(done, 'done event');
  assert.equal(done.data.draft.title, LISTING.title); assert.equal(done.data.usage.used, 1);
  const g = calls.find(c => c.u.includes('ai-local'));
  assert.equal(g.body.model, 'qwen3.8:27b', 'v1.4.1: the laptop runs Qwen 3.8 27B');
  assert.equal(g.body.max_tokens, 2400, 'output budget is set server-side; a client maxTokens is ignored'); assert.equal(g.body.stream, true); assert.equal(g.body.reasoning_effort, 'none');
  assert.equal(g.headers['x-ibi-access'], 'secret-code');
  const usage = [...env.PLM_KV.m.entries()].find(([k]) => k.startsWith('usage:'));
  assert.equal(usage[1], '1');
  globalThis.fetch = realFetch;
});

test('laptop help answer streams; a gateway failure is a neutral error', async () => {
  const env = { PLM_KV: fakeKV(), LOCAL_AI_CODE: 'c' };
  fakeServices({ gatewayChunks: ['{"answer":"The Free plan costs nothing."}'] });
  let ev = await readSse(await ai(ctx(req('/api/ai', { method: 'POST', body: { task: 'help', system: 's', user: 'u' } }), env)));
  assert.equal(ev.find(e => e.ev === 'done').data.text, 'The Free plan costs nothing.');
  assert.equal(calls.find(c => c.u.includes('ai-local')).body.max_tokens, 700, 'help answers get a short output budget');
  globalThis.fetch = async () => new Response('gateway down', { status: 502 });
  ev = await readSse(await ai(ctx(req('/api/ai', { method: 'POST', body: { task: 'help', system: 's', user: 'u' } }), env)));
  const e = ev.find(x => x.ev === 'error'); assert.ok(e);
  assert.doesNotMatch(e.data.error, /laptop|gateway|qwen|502/i, 'customers never see the machinery');
  globalThis.fetch = realFetch;
});

test('Qwen via OpenRouter: reasoning off, JSON back; a billing failure never reaches the customer', async () => {
  const env = { PLM_KV: fakeKV(), SESSION_SECRET: 'test-secret-1234567890', OPENROUTER_API_KEY: 'or-key' };
  await env.PLM_KV.put('cfg:ai_engine', 'qwen');
  const ck = await signedIn(env);
  fakeServices({ openrouter: () => new Response(JSON.stringify({ model: 'qwen/qwen3.8-flash', choices: [{ message: { content: JSON.stringify(LISTING) } }] })) });
  let r = await ai(ctx(req('/api/ai', { method: 'POST', cookie: ck, body: { system: 's', user: 'u', schema: { type: 'object' } } }), env));
  let j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.draft.title, LISTING.title);
  const q = calls.find(c => c.u.includes('openrouter'));
  assert.equal(q.body.model, 'qwen/qwen3.8-flash'); assert.deepEqual(q.body.reasoning, { enabled: false });
  fakeServices({ openrouter: () => new Response(JSON.stringify({ error: { message: 'Insufficient credits' } }), { status: 402 }) });
  r = await ai(ctx(req('/api/ai', { method: 'POST', cookie: ck, body: { system: 's', user: 'u', schema: { type: 'object' } } }), env));
  j = await r.json();
  assert.equal(r.status, 503); assert.equal(j.code, 'ai_unavailable');
  assert.doesNotMatch(j.error, /openrouter|credit|balance|insufficient/i);
  globalThis.fetch = realFetch;
});

test('OFF pauses AI for everyone with a plain message', async () => {
  const env = { PLM_KV: fakeKV(), LOCAL_AI_CODE: 'c' };
  await env.PLM_KV.put('cfg:ai_engine', 'off');
  const r = await ai(ctx(req('/api/ai', { method: 'POST', body: { task: 'help', system: 's', user: 'u' } }), env));
  assert.equal(r.status, 503); assert.equal((await r.json()).code, 'ai_off');
  assert.equal((await (await version({ env })).json()).ai, false);
});
