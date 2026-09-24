/* /api/ai — server-side listing enhancement. The page sends the prompt it built (system, user, JSON schema);
 * this Function adds the key, enforces the plan quota and returns the model's JSON draft. v1.3.0: the engine is
 * the one the CEO chose in the hidden panel (KV 'cfg:ai_engine', default = the office laptop's Qwen 3.5 9B) and
 * ONLY that engine runs — never a fallback. The laptop engine STREAMS (text/event-stream: progress heartbeats,
 * then one 'done' or 'error' event) because a 9B reply takes minutes; the cloud engines answer as JSON.
 * Raw HTTP on purpose: this Pages project has no bundler. */
import { json, err, notConfigured, requireUser, planOf, PLANS, aiUsed, monthKey, handle, rateLimit, clientIp, activeEngine, engineReady, DEFAULT_LOCAL_AI_URL } from './_lib.js';

const TIMEOUT_MS = 55000;
function withTimeout(ms) { const c = new AbortController(); const t = setTimeout(() => c.abort(), ms); return { signal: c.signal, done: () => clearTimeout(t) }; }
function extractJson(text) {
  if (!text) return null; const s = String(text).replace(/```(?:json)?/g, '');
  for (let i = s.indexOf('{'); i >= 0; i = s.indexOf('{', i + 1)) {
    let depth = 0, q = false;
    for (let j = i; j < s.length; j++) { const c = s[j]; if (q) { if (c === '\\') j++; else if (c === '"') q = false; continue; } if (c === '"') q = true; else if (c === '{') depth++; else if (c === '}') { depth--; if (!depth) { try { const o = JSON.parse(s.slice(i, j + 1)); if (o && typeof o === 'object' && ('title' in o || 'bullets' in o || 'answer' in o)) return o; } catch { /* next */ } break; } } }
  }
  return null;
}

/* The providers are all asked for JSON, and each picks its own key for a plain-text
 * reply — Anthropic and the local engine honour the schema and return {answer}, while
 * DeepSeek's bare json_object mode invented {"response": …} and the raw JSON reached the
 * user on the live site. So: take whatever strings the object holds, in order, and never
 * show the wrapper. Anything that is not JSON is already the answer. */
const ANSWER_KEYS = ['answer', 'response', 'reply', 'text', 'content', 'message', 'result', 'output'];
/* Asked for JSON, a model sometimes nests it: {"answer":"{\"answer\":\"…\"}"}. Seen
 * intermittently on the live site with DeepSeek, so peel until the result is no longer
 * a JSON object. Prose never parses as one, and a bare JSON *string* is left alone. */
export function unwrapText(raw) {
  let out = unwrapOnce(raw);
  for (let i = 0; i < 3; i++) { const next = unwrapOnce(out); if (next === out) break; out = next; }
  return out;
}
function unwrapOnce(raw) {
  const s = String(raw == null ? '' : raw).trim().replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();
  const strings = o => typeof o === 'string' ? [o] : Array.isArray(o) ? o.flatMap(strings) : (o && typeof o === 'object') ? Object.values(o).flatMap(strings) : [];
  const tryParse = t => { try { return JSON.parse(t); } catch { return undefined; } };
  let obj = tryParse(s);
  if (obj === undefined) { const a = s.indexOf('{'), b = s.lastIndexOf('}'); if (a >= 0 && b > a) obj = tryParse(s.slice(a, b + 1)); }
  if (!obj || typeof obj !== 'object') return s;
  // 1. a key that names the reply wins outright — this is the normal case
  for (const want of ANSWER_KEYS) {
    const k = Object.keys(obj).find(x => x.toLowerCase() === want);
    if (k == null) continue;
    const v = strings(obj[k]).map(x => x.trim()).filter(Boolean);
    if (v.length) return v.join('\n\n');
  }
  // 2. otherwise keep the prose and drop the provider's metadata labels
  //    (DeepSeek returned {"type":"json_object", …} and "json_object" was being shown)
  let v = strings(obj).map(x => x.trim()).filter(Boolean);
  if (v.some(x => x.length >= 40)) v = v.filter(x => x.length >= 40);
  return v.length ? v.join('\n\n') : s;
}

async function callAnthropic(env, p) {
  const t = withTimeout(TIMEOUT_MS);
  const base = { model: env.ANTHROPIC_MODEL || 'claude-opus-5', max_tokens: 4096, system: p.system, messages: [{ role: 'user', content: p.user }], output_config: { effort: 'low', format: { type: 'json_schema', schema: p.schema } }, fallbacks: 'default' };
  const headers = { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'server-side-fallback-2026-07-01' };
  try {
    let r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(base), signal: t.signal });
    let j = await r.json().catch(() => ({}));
    if (r.status === 400 && /output_config|format|fallbacks|beta/i.test(JSON.stringify(j))) { // shape drift guard: retry plain and hunt the JSON
      const plain = { ...base }; delete plain.output_config; delete plain.fallbacks; delete headers['anthropic-beta'];
      r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(plain), signal: t.signal }); j = await r.json().catch(() => ({}));
    }
    if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(j.error && j.error.message) || 'request failed'}`);
    if (j.stop_reason === 'refusal') throw new Error('The model declined this request' + (j.stop_details && j.stop_details.explanation ? ': ' + j.stop_details.explanation : ''));
    const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    return { text, provider: `anthropic:${j.model || base.model}` };
  } finally { t.done(); }
}
async function callGemini(env, p) {
  const models = [env.GEMINI_MODEL || 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-2.5-flash'];
  let last = '';
  for (const model of models) {
    const t = withTimeout(TIMEOUT_MS);
    try {
      const body = { systemInstruction: { parts: [{ text: p.system }] }, contents: [{ role: 'user', parts: [{ text: p.user }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.6, maxOutputTokens: 4096, thinkingConfig: model.startsWith('gemini-3') ? { thinkingLevel: 'minimal' } : { thinkingBudget: 0 } } };
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
      let r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: t.signal });
      if (r.status === 400) { delete body.generationConfig.thinkingConfig; r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: t.signal }); }
      const j = await r.json().catch(() => ({}));
      if (r.status === 401 || r.status === 403) throw new Error('Gemini key rejected');
      if (!r.ok) { last = `${model}: ${(j.error && j.error.message) || r.status}`; continue; }
      const text = ((((j.candidates || [])[0] || {}).content || {}).parts || []).filter(x => !x.thought).map(x => x.text).join('');
      if (text) return { text, provider: `gemini:${model}` };
      last = `${model}: empty reply`;
    } finally { t.done(); }
  }
  throw new Error('Gemini failed — ' + last);
}
async function callDeepSeek(env, p) {
  const strategies = [{ thinking: { type: 'disabled' }, response_format: { type: 'json_object' } }, { reasoning_effort: 'none' }, {}];
  let last = '';
  for (const extra of strategies) {
    const t = withTimeout(TIMEOUT_MS);
    try {
      const body = { model: env.DEEPSEEK_MODEL || 'deepseek-flash', max_tokens: 4096, temperature: 0.6, messages: [{ role: 'system', content: p.system }, { role: 'user', content: p.user + '\nReply with JSON only.' }], ...extra };
      const r = await fetch('https://api.deepseek.com/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.DEEPSEEK_API_KEY }, body: JSON.stringify(body), signal: t.signal });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401 || r.status === 402) throw new Error('DeepSeek account problem: ' + ((j.error && j.error.message) || r.status));
      if (!r.ok) { last = (j.error && j.error.message) || String(r.status); continue; }
      const m = ((j.choices || [])[0] || {}).message || {}; const text = m.content || m.reasoning_content || '';
      if (text) return { text, provider: `deepseek:${body.model}` };
      last = 'empty reply';
    } finally { t.done(); }
  }
  throw new Error('DeepSeek failed — ' + last);
}
/* Qwen 3.8 Flash through OpenRouter (OpenAI-compatible). Its reasoning is ON by default and would
 * eat the time budget, so it is switched off; if a knob is rejected the next dialect is tried. */
async function callQwen(env, p) {
  const model = env.QWEN_MODEL || 'qwen/qwen3.8-flash';
  const strategies = [
    { reasoning: { enabled: false }, response_format: { type: 'json_schema', json_schema: { name: 'listing', schema: p.schema } } },
    { reasoning: { effort: 'none' }, response_format: { type: 'json_object' } },
    {},
  ];
  let last = '';
  for (const extra of strategies) {
    const t = withTimeout(TIMEOUT_MS);
    try {
      const body = { model, max_tokens: 4096, temperature: 0.6, messages: [{ role: 'system', content: p.system }, { role: 'user', content: p.user + '\nReply with JSON only.' }], ...extra };
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.OPENROUTER_API_KEY, 'HTTP-Referer': 'https://listingsmaster.indiabusinessinternational.online', 'X-Title': 'IBI Product Listings Master' }, body: JSON.stringify(body), signal: t.signal });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401 || r.status === 402) throw new Error('OpenRouter account problem: ' + ((j.error && j.error.message) || r.status));
      if (!r.ok || j.error) { last = (j.error && j.error.message) || String(r.status); continue; }
      const text = ((((j.choices || [])[0] || {}).message) || {}).content || '';
      if (text) return { text, provider: `qwen:${j.model || model}` };
      last = 'empty reply';
    } finally { t.done(); }
  }
  throw new Error('Qwen failed — ' + last);
}

/* The office laptop (Qwen 3.5 9B, ~2.6 tokens/s on a 4 GB card): a reply takes minutes, far past any
 * non-streaming timeout, so the gateway reply is STREAMED and turned into this Function's own events:
 *   event: progress  {chars, secs}   every few seconds (also during the silent prefill — keeps every hop alive)
 *   event: done      {...final JSON...}  or   event: error {error, status}
 * finish(r) turns the model's text into the final payload (help answer, or listing draft + quota). */
const LOCAL_MAX_MS = 9 * 60 * 1000;
function localStream(env, p, ctx, finish) {
  const model = env.LOCAL_AI_MODEL || 'qwen3.5:9b';
  const base = String(env.LOCAL_AI_URL || DEFAULT_LOCAL_AI_URL).replace(/\/$/, '');
  const { readable, writable } = new TransformStream();
  const w = writable.getWriter(), te = new TextEncoder();
  const send = (event, data) => w.write(te.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)).catch(() => {});
  const t0 = Date.now(); let text = '';
  const beat = setInterval(() => send('progress', { chars: text.length, secs: Math.round((Date.now() - t0) / 1000) }), 4000);
  const work = (async () => {
    const t = withTimeout(LOCAL_MAX_MS);
    try {
      send('progress', { chars: 0, secs: 0 });
      const body = { model, messages: [{ role: 'system', content: p.system }, { role: 'user', content: p.user }], temperature: 0.6, max_tokens: 3000, stream: true, reasoning_effort: 'none', response_format: { type: 'json_schema', json_schema: { name: 'listing', schema: p.schema } } };
      const r = await fetch(base + '/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-ibi-access': env.LOCAL_AI_CODE }, body: JSON.stringify(body), signal: t.signal });
      if (!r.ok || !r.body) { console.error('local engine HTTP', r.status, (await r.text().catch(() => '')).slice(0, 300)); await send('error', { error: UNAVAILABLE, status: 503 }); return; }
      const rd = r.body.getReader(), td = new TextDecoder(); let buf = '';
      for (;;) {
        const { value, done } = await rd.read(); if (done) break;
        buf += td.decode(value, { stream: true }); let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
          if (!line.startsWith('data:')) continue; const d = line.slice(5).trim(); if (!d || d === '[DONE]') continue;
          try { const c = ((JSON.parse(d).choices || [])[0] || {}).delta || {}; if (c.content) text += c.content; } catch { /* partial line */ }
        }
      }
      const out = await finish({ text, provider: 'local:' + model });
      await send(out.error ? 'error' : 'done', out);
    } catch (e) {
      console.error('local engine failed:', e && e.message);
      await send('error', { error: UNAVAILABLE, status: 503 });
    } finally { clearInterval(beat); t.done(); await w.close().catch(() => {}); }
  })();
  if (ctx && ctx.waitUntil) ctx.waitUntil(work);
  return new Response(readable, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' } });
}

/* What a customer sees when an engine fails — never the vendor, the account or the balance. */
const UNAVAILABLE = 'AI is not available right now. Please try again in a few minutes. Your rule-engine listings are unaffected.';

const IMPL = { anthropic: callAnthropic, gemini: callGemini, deepseek: callDeepSeek, qwen: callQwen };
async function runCloud(impl, env, p) {
  try { return await impl(env, p); }
  catch (e) { console.error('AI engine failed:', e && e.message); throw err(UNAVAILABLE, 503, { code: 'ai_unavailable' }); }
}

export const onRequestPost = handle(async ctx => {
  const { request, env } = ctx;
  const engine = await activeEngine(env);
  if (engine === 'off') return err('AI enhancement is paused right now. Your rule-engine listings are unaffected.', 503, { code: 'ai_off' });
  if (!engineReady(env, engine)) return notConfigured('Server AI');
  const impl = IMPL[engine];   // undefined for 'local' — that one streams

  /* ── help assistant ──
   * The page has already retrieved its own help articles and sends them as the only
   * source; this only rephrases them. No sign-in (a visitor deciding whether to buy
   * must be able to ask), no listing quota, a tight IP rate limit and a small cap.
   * It returns plain text, never a listing. */
  const peek = await request.clone().json().catch(() => null);
  if (peek && peek.task === 'help') {
    if (!await rateLimit(env, 'help:' + clientIp(request), 25, 3600)) return err('Too many help questions from this network; try again in an hour, or WhatsApp +91 89394 14799.', 429);
    if (typeof peek.system !== 'string' || typeof peek.user !== 'string') return err('Missing prompt');
    if (peek.system.length + peek.user.length > 24000) return err('Prompt too long');
    const hp = { system: peek.system, user: peek.user, schema: { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] } };
    const finishHelp = r => { const text = unwrapText(r.text); return text ? { text: text.slice(0, 4000), provider: r.provider } : { error: 'The assistant had no answer; the help topics below still apply.', status: 502 }; };
    if (engine === 'local') return localStream(env, hp, ctx, async r => finishHelp(r));
    const out = finishHelp(await runCloud(impl, env, hp));
    return out.error ? err(out.error, out.status) : json(out);
  }

  if (!env.PLM_KV || !env.SESSION_SECRET) return notConfigured('Accounts (needed for AI quotas)');
  const u = await requireUser(request, env);
  if (!await rateLimit(env, 'ai:' + clientIp(request), 40, 600)) return err('Slow down — 40 AI calls per 10 minutes', 429);
  const plan = planOf(u), limit = PLANS[plan].ai, used = await aiUsed(env, u.id);
  if (used >= limit) return err(`You have used all ${limit} AI enhancements of your ${PLANS[plan].name} plan this month. Upgrade in Account & Plan, or add your own Gemini key in Settings.`, 402, { code: 'quota' });
  const p = await request.json().catch(() => null);
  if (!p || typeof p.system !== 'string' || typeof p.user !== 'string' || !p.schema) return err('Missing prompt');
  if (p.system.length + p.user.length > 60000) return err('Prompt too long');
  // Quota is counted only for a listing that actually came back.
  const finishListing = async r => {
    const draft = extractJson(r.text);
    if (!draft) return { error: 'The model returned no listing JSON; try again', status: 502 };
    const n = (await aiUsed(env, u.id)) + 1;
    await env.PLM_KV.put(`usage:${u.id}:${monthKey()}`, String(n), { expirationTtl: 40 * 86400 });
    return { draft, provider: r.provider, usage: { used: n, limit, plan } };
  };
  if (engine === 'local') return localStream(env, p, ctx, finishListing);
  const out = await finishListing(await runCloud(impl, env, p));
  return out.error ? err(out.error, out.status) : json(out);
});
