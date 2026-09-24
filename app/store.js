/* IBI Product Listings Master — storage (IndexedDB, local-first) + cloud sync client */
export const APP_VERSION = '1.3.0';
const DB_NAME = 'plm', DB_VER = 1;
const STORES = ['products', 'listings', 'perf', 'channels', 'settings', 'kwcache'];
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = () => { const d = r.result; for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
function tx(store, mode, fn) {
  return open().then(d => new Promise((res, rej) => {
    const t = d.transaction(store, mode), os = t.objectStore(store); let out;
    try { out = fn(os); } catch (e) { rej(e); return; }
    t.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
    t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  }));
}
export const db = {
  all: s => tx(s, 'readonly', os => os.getAll()),
  get: (s, id) => tx(s, 'readonly', os => os.get(id)),
  put: (s, obj) => tx(s, 'readwrite', os => os.put(obj)),
  bulkPut: (s, arr) => tx(s, 'readwrite', os => { arr.forEach(o => os.put(o)); return arr.length; }),
  del: (s, id) => tx(s, 'readwrite', os => os.delete(id)),
  clear: s => tx(s, 'readwrite', os => os.clear()),
};
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).replace(/-/g, '').slice(0, 20);
export const now = () => new Date().toISOString();

/* settings live as one doc {id:'app', ...} */
export const DEFAULT_SETTINGS = {
  id: 'app', onboarded: false, theme: 'auto', textSize: 1, liveSuggest: true, autoSync: true,
  business: { brand: '', manufacturerName: '', manufacturerAddress: '', packerName: '', packerAddress: '', consumerCare: '', countryOfOrigin: 'India', gst: 18, currency: 'INR' },
  enabledChannels: ['amazon_in', 'amazon_bazaar', 'flipkart', 'shopsy', 'meesho', 'shopclues', 'ibi'],
  ai: { mode: 'server', geminiKeySaved: false },
  ibiStock: true, // IBI-only live stock link; ignored unless the workspace is IBI's own
  updatedAt: '',
};
export async function loadSettings() { const s = await db.get('settings', 'app'); return deepMerge(structuredClone(DEFAULT_SETTINGS), s || {}); }
export function saveSettings(s) { s.updatedAt = now(); return db.put('settings', s); }
function deepMerge(a, b) { for (const k of Object.keys(b)) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') deepMerge(a[k], b[k]); else a[k] = b[k]; } return a; }

/* BYOK keys never enter IndexedDB export/sync; they sit in localStorage under a separate key. */
export const secrets = {
  get: k => { try { return localStorage.getItem('plm:secret:' + k) || ''; } catch { return ''; } },
  set: (k, v) => { try { v ? localStorage.setItem('plm:secret:' + k, v) : localStorage.removeItem('plm:secret:' + k); } catch { /* private mode */ } },
};

/* ── backup / restore ── */
export async function exportBackup() {
  const out = { app: 'IBI Product Listings Master', version: APP_VERSION, exportedAt: now() };
  for (const s of ['products', 'listings', 'perf', 'channels', 'settings']) out[s] = await db.all(s);
  return out;
}
export async function importBackup(obj, { merge = true } = {}) {
  if (!obj || !Array.isArray(obj.products)) throw new Error('Not a Listings Master backup file');
  for (const s of ['products', 'listings', 'perf', 'channels', 'settings']) { if (!merge) await db.clear(s); if (Array.isArray(obj[s])) await db.bulkPut(s, obj[s].filter(o => o && o.id)); }
  return { products: obj.products.length };
}

/* ── cloud client (Cloudflare Pages Functions under ../api/) ── */
const API = new URL('../api/', location.href).href;
async function call(path, opts = {}) {
  const { onProgress, ...fetchOpts } = opts;
  const r = await fetch(API + path, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }, ...fetchOpts, body: opts.body != null && typeof opts.body !== 'string' ? JSON.stringify(opts.body) : opts.body });
  // v1.3.0: the laptop engine streams — progress events, then one 'done' or 'error'
  if (r.ok && (r.headers.get('Content-Type') || '').includes('text/event-stream')) return readEvents(r, onProgress);
  const text = await r.text(); let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 200) }; }
  if (!r.ok) { const e = new Error((data && (data.error || data.message)) || `HTTP ${r.status}`); e.status = r.status; e.data = data; throw e; }
  return data;
}
async function readEvents(r, onProgress) {
  const rd = r.body.getReader(), td = new TextDecoder(); let buf = '', final = null;
  for (;;) {
    const { value, done } = await rd.read(); if (done) break;
    buf += td.decode(value, { stream: true }); let cut;
    while ((cut = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, cut); buf = buf.slice(cut + 2);
      const ev = (block.match(/^event: *(.+)$/m) || [])[1] || 'message';
      let data = null; try { data = JSON.parse((block.match(/^data: *(.*)$/m) || [])[1] || 'null'); } catch { /* keep-alive */ }
      if (ev === 'progress') { onProgress && onProgress(data || {}); continue; }
      if (ev === 'done' || ev === 'error') final = { ev, data: data || {} };
    }
  }
  if (!final) { const e = new Error('The AI connection closed before it finished. Please try again.'); e.status = 504; throw e; }
  if (final.ev === 'error') { const e = new Error(final.data.error || 'AI failed'); e.status = final.data.status || 503; e.data = final.data; throw e; }
  return final.data;
}

/* IBI CEO Auth — the ONE Apps Script that holds the CEO PIN. text/plain skips the CORS preflight
 * Apps Script cannot answer. Google sometimes answers late or with its own HTML 404 when the
 * account is busy, so a reply that is not JSON is retried. */
export const CEO_AUTH_URL = 'https://script.google.com/macros/s/AKfycbxIW4j7m51JjX6yt38-a1X6XrDRyZp3czMYN8eXECfP9H2twjfrgLaozWCCl843AgWo0g/exec';
export async function ceoVerify(pin, onRetry) {
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await fetch(CEO_AUTH_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'verifyCeo', pin }) });
      return JSON.parse(await r.text());
    } catch { if (i < 3) { onRetry && onRetry(i + 1); await new Promise(res => setTimeout(res, 2000 * i)); } }
  }
  throw new Error('Google\u2019s sign-in service is busy right now. Please wait a minute and try again.');
}

export const cloud = {
  state: { available: null, version: null, features: [], ai: false, billing: false, suggest: false, user: null, lastSync: null, error: null },
  async probe() {
    try { const v = await call('version'); Object.assign(this.state, { available: true, version: v.version, features: v.features || [], ai: !!v.ai, billing: !!v.billing, suggest: !!v.suggest, error: null }); }
    catch (e) { Object.assign(this.state, { available: false, version: null, error: e.status ? `HTTP ${e.status}` : 'offline' }); }
    return this.state;
  },
  async me() { try { const m = await call('auth/me'); this.state.user = m.user || null; } catch (e) { if (e.status !== 401) this.state.error = e.message; this.state.user = null; } return this.state.user; },
  signup: (email, password, name) => call('auth/signup', { method: 'POST', body: { email, password, name } }),
  login: (email, password) => call('auth/login', { method: 'POST', body: { email, password } }),
  logout: () => call('auth/logout', { method: 'POST' }),
  changePassword: (oldPassword, newPassword) => call('auth/password', { method: 'POST', body: { oldPassword, newPassword } }),
  deleteAccount: password => call('auth/delete', { method: 'POST', body: { password } }),
  pull: () => call('data'),
  push: payload => call('data', { method: 'PUT', body: payload }),
  ai: (body, onProgress) => call('ai', { method: 'POST', body, onProgress }),
  helpAi: (body, onProgress) => call('ai', { method: 'POST', body: { ...body, task: 'help' }, onProgress }),
  aiConfig: body => call('aiconfig', { method: 'POST', body }),
  suggest: q => call('suggest?q=' + encodeURIComponent(q)),
  order: plan => call('billing/order', { method: 'POST', body: { plan } }),
  orderStatus: id => call('billing/status?order=' + encodeURIComponent(id)),
  usage: () => call('usage'),
};

/* Merge strategy: newest updatedAt wins per record; deletions are tombstones {id, deleted:true, updatedAt}. */
export function mergeRecords(local, remote) {
  const m = new Map(local.map(r => [r.id, r]));
  for (const r of remote) { const l = m.get(r.id); if (!l || (r.updatedAt || '') > (l.updatedAt || '')) m.set(r.id, r); }
  return [...m.values()];
}
export async function syncWorkspace({ onStatus } = {}) {
  if (!cloud.state.user) throw new Error('Sign in to sync');
  onStatus && onStatus('Pulling…');
  const remote = await cloud.pull();
  const stores = ['products', 'listings', 'perf', 'channels'];
  const merged = {};
  for (const s of stores) { const local = await db.all(s); merged[s] = mergeRecords(local, (remote && remote[s]) || []); await db.bulkPut(s, merged[s]); }
  const settingsLocal = await loadSettings(); const settingsRemote = remote && remote.settings;
  if (settingsRemote && (settingsRemote.updatedAt || '') > (settingsLocal.updatedAt || '')) await db.put('settings', deepMerge(settingsLocal, settingsRemote));
  onStatus && onStatus('Pushing…');
  const payload = { ...merged, settings: await loadSettings(), pushedAt: now(), appVersion: APP_VERSION };
  const res = await cloud.push(payload);
  cloud.state.lastSync = now();
  try { localStorage.setItem('plm:lastSync', cloud.state.lastSync); } catch { /* ignore */ }
  return res;
}
