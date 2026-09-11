/* IBI Product Listings Master — application (v1.1.2)
 * Local-first SPA. Every control is wired through data-act="<name>" → A.<name>; tests/audit_actions.mjs
 * fails the build if a data-act names an action that does not exist.
 */
import { CHANNELS, CHANNEL_MAP, exportSpec, blankChannel, SLOT_LABELS, RULE_LABELS } from './channels.js';
import * as E from './engine.js';
import { db, uid, now, loadSettings, saveSettings, secrets, exportBackup, importBackup, cloud, syncWorkspace, APP_VERSION } from './store.js';
import * as X from './exporter.js';
import { enhance, helpAnswer } from './ai.js';
import { HELP_ARTICLES, HELP_VERSION, searchHelp, answerFromKb, startersFor, renderHelpText } from './help.js';

export const PLANS = {
  free: { name: 'Free', price: 0, products: 25, ai: 10, custom: 1, seats: 1, blurb: 'Rule-engine listings for every channel, unlimited local products, 25 in cloud sync.' },
  starter: { name: 'Starter', price: 499, products: 300, ai: 150, custom: 3, seats: 1, blurb: 'For a growing seller: cloud sync, 150 AI enhancements a month, 3 custom channels.' },
  pro: { name: 'Pro', price: 1499, products: 3000, ai: 600, custom: 99, seats: 3, blurb: 'Teams and agencies: performance loop, unlimited custom channels, 3 seats.', popular: true },
  business: { name: 'Business', price: 3999, products: 25000, ai: 2500, custom: 99, seats: 10, blurb: 'Large catalogues: 25,000 products, 2,500 AI enhancements, 10 seats, priority support.' },
};

const S = { products: [], listings: [], perf: [], custom: [], settings: null, route: { name: 'dashboard', id: null, sub: null }, suggest: {}, busy: {} };
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => n === '' || n == null || isNaN(n) ? '—' : '₹' + Number(n).toLocaleString('en-IN');
const fmtDate = s => s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const registry = () => { const r = { ...CHANNEL_MAP }; for (const c of S.custom) r[c.id] = c; return r; };
const allChannels = () => [...CHANNELS, ...S.custom];
const enabledChannels = () => allChannels().filter(c => S.settings.enabledChannels.includes(c.id));
const productById = id => S.products.find(p => p.id === id);
const listingRec = (pid, chid) => S.listings.find(l => l.productId === pid && l.channel === chid);
const planOf = () => (cloud.state.user && cloud.state.user.plan) || 'free';

/* ───────── toast / modal ───────── */
export function toast(msg, type = '') {
  const el = document.createElement('div'); el.className = 'toast ' + type; el.textContent = msg; $('#toastRoot').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 320); }, type === 'err' ? 5200 : 3000);
}
function modal({ title, body, buttons = [{ label: 'Close', act: 'close' }], wide = false, onMount }) {
  return new Promise(res => {
    const root = $('#modalRoot');
    root.innerHTML = `<div class="modal" data-modal><div class="box ${wide ? 'wide' : ''}" role="dialog" aria-modal="true"><div class="mh"><h3>${esc(title)}</h3><button class="iconbtn" data-mclose aria-label="Close">✕</button></div><div class="mb">${body}</div><div class="mf">${buttons.map(b => `<button class="btn ${b.cls || ''}" data-mact="${esc(b.act)}">${esc(b.label)}</button>`).join('')}</div></div></div>`;
    const close = v => { root.innerHTML = ''; res(v); };
    root.onclick = e => { const b = e.target.closest('[data-mact]'); if (b) { const act = b.dataset.mact; if (act === 'close' || act === 'cancel') close(null); else close({ act, box: root }); return; } if (e.target.closest('[data-mclose]') || e.target.hasAttribute('data-modal')) close(null); };
    document.onkeydown = e => { if (e.key === 'Escape' && root.firstChild) close(null); };
    onMount && onMount(root);
    const f = $('input, textarea, select, button.primary', root); f && f.focus();
  });
}
const confirmDlg = (title, text, label = 'Confirm', cls = 'primary') => modal({ title, body: `<p>${text}</p>`, buttons: [{ label: 'Cancel', act: 'cancel' }, { label, act: 'ok', cls }] }).then(r => !!(r && r.act === 'ok'));

/* ───────── data ───────── */
async function loadAll() {
  S.settings = await loadSettings();
  [S.products, S.listings, S.perf, S.custom] = await Promise.all([db.all('products'), db.all('listings'), db.all('perf'), db.all('channels')]);
  S.products = S.products.filter(p => !p.deleted).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  S.listings = S.listings.filter(l => !l.deleted); S.perf = S.perf.filter(r => !r.deleted); S.custom = S.custom.filter(c => !c.deleted);
}
async function saveProduct(p) { p.updatedAt = now(); if (!p.createdAt) p.createdAt = p.updatedAt; await db.put('products', p); const i = S.products.findIndex(x => x.id === p.id); if (i >= 0) S.products[i] = p; else S.products.unshift(p); queueSync(); }
async function deleteProduct(id) { await db.put('products', { id, deleted: true, updatedAt: now() }); S.products = S.products.filter(p => p.id !== id); for (const l of S.listings.filter(l => l.productId === id)) await db.put('listings', { id: l.id, deleted: true, updatedAt: now() }); S.listings = S.listings.filter(l => l.productId !== id); queueSync(); }
async function saveListing(l) { l.updatedAt = now(); await db.put('listings', l); const i = S.listings.findIndex(x => x.id === l.id); if (i >= 0) S.listings[i] = l; else S.listings.push(l); queueSync(); }
async function savePerf(r) { r.updatedAt = now(); await db.put('perf', r); const i = S.perf.findIndex(x => x.id === r.id); if (i >= 0) S.perf[i] = r; else S.perf.push(r); queueSync(); }
async function saveCustom(c) { c.updatedAt = now(); await db.put('channels', c); const i = S.custom.findIndex(x => x.id === c.id); if (i >= 0) S.custom[i] = c; else S.custom.push(c); queueSync(); }
const queueSync = debounce(async () => { if (S.settings.autoSync && cloud.state.user && navigator.onLine) { try { await syncWorkspace(); paintSync(); } catch (e) { console.warn('sync', e); paintSync(e.message); } } }, 4000);

function boostsFor(pid) { const rows = S.perf.filter(r => r.productId === pid && r.impressions > 0); return E.boostFromPerformance(rows).boosts; }
function genOpts(pid) { return { registry: registry(), suggestions: S.suggest[pid] || [], boosts: boostsFor(pid) }; }

async function generateFor(pid, chid, { keepLocked = true, source = 'rules' } = {}) {
  const p = productById(pid), ch = registry()[chid]; if (!p || !ch) return null;
  const fresh = E.generateListing(p, ch, genOpts(pid));
  let rec = listingRec(pid, chid);
  if (!rec) rec = { id: `${pid}:${chid}`, productId: pid, channel: chid, current: null, versions: [], locked: {}, updatedAt: '' };
  const fields = pickFields(fresh);
  if (keepLocked && rec.current) for (const k of Object.keys(rec.locked || {})) if (rec.locked[k]) fields[k] = rec.current[k];
  rec.current = { ...fields }; rec.versions.push({ v: rec.versions.length + 1, at: now(), source, fields: { ...fields } }); if (rec.versions.length > 20) rec.versions.shift();
  await saveListing(rec);
  return rec;
}
const pickFields = L => ({ title: L.title || '', highlights: L.highlights || '', bullets: [...(L.bullets || [])], description: L.description || '', keywords: L.keywords || '', metaDescription: L.metaDescription || '' });
function evaluate(pid, chid, fields) { const p = productById(pid), ch = registry()[chid]; const pool = E.keywordPool(p, { suggestions: S.suggest[pid] || [], boosts: boostsFor(pid) }); return E.finishListing(ch, { ...fields, channel: chid }, p, pool); }

/* ───────── router ───────── */
const NAV = [
  ['dashboard', 'Dashboard', 'M3 12 12 4l9 8M5 10v10h5v-6h4v6h5V10'], ['products', 'Products', 'M4 7h16M4 12h16M4 17h10'], ['studio', 'Listing Studio', 'M4 5h16v14H4zM8 9h8M8 13h5'],
  ['keywords', 'Keywords & SEO', 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4-4'], ['performance', 'Performance', 'M4 19V5m0 14h16M8 15l3-4 3 2 5-6'], ['channels', 'Channels', 'M4 6h6v6H4zM14 6h6v6h-6zM4 16h6v4H4zM14 16h6v4h-6z'],
  ['exports', 'Exports', 'M12 4v12m0 0-4-4m4 4 4-4M4 20h16'], ['account', 'Account & Plan', 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0'], ['settings', 'Settings', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7-3 2-1-1-3-2 .3-1.5-1.5.3-2-3-1-1 2h-2l-1-2-3 1 .3 2L5.6 8.3l-2-.3-1 3 2 1v2l-2 1 1 3 2-.3 1.5 1.5-.3 2 3 1 1-2h2l1 2 3-1-.3-2 1.5-1.5 2 .3 1-3-2-1z'], ['help', 'Help', 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-5v-1m0-3c0-2 3-2 3-5a3 3 0 0 0-6 0'],
];
const icon = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
function parseRoute() { const h = location.hash.replace(/^#\/?/, ''); const [name = 'dashboard', id = null, sub = null] = h.split('/'); return { name, id: id ? decodeURIComponent(id) : null, sub }; }
function go(path) { location.hash = '#/' + path; }
function paintNav() {
  const cur = S.route.name;
  $('#sideNav').innerHTML = `<div class="sec">Workspace</div>` + NAV.slice(0, 7).map(([k, l, d]) => `<a href="#/${k}" class="${cur === k ? 'active' : ''}">${icon(d)}${l}</a>`).join('') + `<div class="sec">You</div>` + NAV.slice(7).map(([k, l, d]) => `<a href="#/${k}" class="${cur === k ? 'active' : ''}">${icon(d)}${l}</a>`).join('');
  const tabs = ['dashboard', 'products', 'studio', 'channels', 'account'];
  $('#tabBar').innerHTML = tabs.map(k => { const n = NAV.find(x => x[0] === k); return `<a href="#/${k}" class="${cur === k ? 'active' : ''}">${icon(n[2])}<span>${k === 'studio' ? 'Studio' : k === 'account' ? 'Account' : n[1]}</span></a>`; }).join('');
  const plan = PLANS[planOf()]; const u = cloud.state.user;
  $('#planCard').innerHTML = `<b>${esc(plan.name)} plan</b><span class="small muted">${u ? esc(u.email) : 'Local mode — sign in to sync'}</span>${u && u.aiUsed != null ? `<div class="small muted">AI this month: ${u.aiUsed}/${plan.ai}</div>` : ''}${planOf() === 'free' ? `<div style="margin-top:8px"><a class="btn sm" href="#/account">Upgrade</a></div>` : ''}`;
  $('#avatarBtn').textContent = u ? (u.name || u.email).slice(0, 1).toUpperCase() : '?';
  paintAbout(); paintSync();
}
function paintAbout() { const b = cloud.state.version; $('#aboutLine').textContent = `App v${APP_VERSION} · Backend ${cloud.state.available ? `v${b}${b === APP_VERSION ? ' ✓ in step' : ' (differs)'}` : 'offline / local mode'} · Engine v${E.ENGINE_VERSION}`; }
function paintSync(err) { const b = $('#syncBtn'); const u = cloud.state.user; b.style.color = !cloud.state.available ? 'var(--faint)' : err ? 'var(--err)' : u ? 'var(--ok)' : 'var(--muted)'; b.title = !cloud.state.available ? 'Local mode: the online service is not reachable' : err ? `Sync problem: ${err}` : u ? `Synced${cloud.state.lastSync ? ' ' + new Date(cloud.state.lastSync).toLocaleTimeString() : ''}` : 'Sign in to sync across devices'; }

async function render() {
  S.route = parseRoute(); paintNav();
  const v = $('#view'); v.scrollTop = 0; window.scrollTo(0, 0);
  const R = { dashboard: vDashboard, products: vProducts, studio: vStudio, keywords: vKeywords, performance: vPerformance, channels: vChannels, exports: vExports, account: vAccount, settings: vSettings, help: vHelp };
  const fn = R[S.route.name] || vDashboard;
  try { v.innerHTML = await fn(S.route); } catch (e) { console.error(e); v.innerHTML = `<div class="callout err">Something broke while drawing this page: ${esc(e.message)}. <a href="#/dashboard">Back to the dashboard</a></div>`; }
  $$('textarea.auto', v).forEach(autosize);
  if (S.route.name === 'studio' && S.route.id) mountStudio();
}
function autosize(t) { t.style.height = 'auto'; t.style.height = (t.scrollHeight + 2) + 'px'; }
document.addEventListener('input', e => { if (e.target.matches('textarea.auto')) autosize(e.target); });

/* ───────── views ───────── */
function pageHead(title, sub, actions = '') { return `<div class="page-head"><div><h1>${title}</h1>${sub ? `<div class="muted">${sub}</div>` : ''}</div><div class="actions">${actions}</div></div>`; }
function scoreRing(sc) { const c = sc >= 85 ? 'var(--ok)' : sc >= 70 ? '#65a30d' : sc >= 50 ? 'var(--warn)' : 'var(--err)'; return `<span class="score" style="--pct:${sc};--sc:${c}" data-v="${sc}"></span>`; }
function chanChip(ch, on, extra = '') { return `<span class="chip ${on ? 'on' : ''}" style="--c:${ch.accent}" ${extra}><span class="dot"></span>${esc(ch.short)}</span>`; }

async function vDashboard() {
  const n = S.products.length, L = S.listings.filter(l => l.current);
  const scores = L.map(l => evaluate(l.productId, l.channel, l.current).score.total).filter(x => !isNaN(x));
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const recent = S.products.slice(0, 6);
  return pageHead('Dashboard', `${S.settings.business.brand ? esc(S.settings.business.brand) + ' · ' : ''}list once, sell everywhere.`, `<button class="btn primary" data-act="newProduct">+ New product</button><button class="btn" data-act="importSheet">Import sheet</button>${n ? '' : '<button class="btn" data-act="loadSample">Load sample product</button>'}`)
    + (S.settings.onboarded ? '' : `<div class="callout info" style="margin-bottom:14px"><div><b>Welcome.</b> Set your business defaults once (brand, manufacturer address, GST) and every product inherits them. <a href="#/settings">Open Settings</a> · or <a href="#" data-act="loadSample">load the sample product</a> to see the whole flow in a minute.</div></div>`)
    + `<div class="grid g4" style="margin-bottom:16px">
      <div class="panel stat"><div class="v">${n}</div><div class="l">Products</div></div>
      <div class="panel stat"><div class="v">${L.length}</div><div class="l">Channel listings generated</div></div>
      <div class="panel stat"><div class="v">${avg || '—'}</div><div class="l">Average listing score</div></div>
      <div class="panel stat"><div class="v">${enabledChannels().length}</div><div class="l">Channels enabled <a class="small" href="#/channels">manage</a></div></div></div>
    <div class="grid g2">
      <div class="panel"><div class="ph"><h3>Recent products</h3><a class="btn sm" href="#/products">All products</a></div><div class="pb" style="padding:0">${recent.length ? `<div class="tbl-wrap" style="border:0;border-radius:0"><table><thead><tr><th>Product</th><th>Price</th><th>Listings</th><th></th></tr></thead><tbody>${recent.map(p => { const ls = S.listings.filter(l => l.productId === p.id && l.current); return `<tr class="rowlink" data-act="openProduct" data-id="${p.id}"><td><b>${esc(p.productType || p.name || 'Untitled')}</b><div class="small muted">${esc(p.sku || 'no SKU')} · ${esc(p.brand || 'no brand')}</div></td><td>${money(p.sellingPrice)}</td><td>${ls.length ? ls.map(l => { const ch = registry()[l.channel]; return ch ? `<span class="tag" style="border-color:${ch.accent}" title="${esc(ch.name)}">${esc(ch.short)}</span>` : ''; }).join(' ') : '<span class="faint">none yet</span>'}</td><td><a class="btn sm" href="#/studio/${p.id}" data-stop>Studio</a></td></tr>`; }).join('')}</tbody></table></div>` : `<div class="empty"><div class="big">📦</div>No products yet. Add one, import a sheet you already use on Meesho / Flipkart / Amazon, or load the sample.</div>`}</div></div>
      <div class="panel"><div class="ph"><h3>Channel policies in force</h3><a class="btn sm" href="#/channels">Channels</a></div><div class="pb"><ul class="issues">${enabledChannels().map(ch => `<li class="ok"><div><b>${esc(ch.name)}</b> <span class="faint small">policy ${fmtDate(ch.policyDate)}</span><div class="small muted">${esc(ch.summary)}</div></div></li>`).join('')}</ul></div></div>
    </div>
    <div class="panel" style="margin-top:14px"><div class="ph"><h3>How it works</h3></div><div class="pb"><div class="stepper"><span class="st on"><i>1</i>One master product record</span><span class="st"><i>2</i>Rule engine writes each channel's listing</span><span class="st"><i>3</i>Live keywords + AI polish</span><span class="st"><i>4</i>Validate, score, export the exact sheet</span><span class="st"><i>5</i>Log impressions & clicks → titles re-optimise</span></div><p class="muted small">Dynamic SEO: the composer ranks keywords from your inputs, marketplace synonyms, live search suggestions and your own performance data, then fills each platform's visible band — 75 characters on Amazon, ~100 on Flipkart, 60–80 on Meesho — without repeating a word more than twice or touching a banned term.</p></div></div>`;
}

async function vProducts(r) {
  const q = (S.q || '').toLowerCase();
  const rows = S.products.filter(p => !q || JSON.stringify([p.productType, p.sku, p.brand, p.category, p.keywords]).toLowerCase().includes(q));
  return pageHead('Products', `${S.products.length} product${S.products.length === 1 ? '' : 's'} in this workspace`, `<button class="btn primary" data-act="newProduct">+ New product</button><button class="btn" data-act="importSheet">Import sheet</button><button class="btn" data-act="exportProducts">Export catalogue</button>`)
    + `<div class="split" style="margin-bottom:12px"><input class="input" id="prodSearch" style="max-width:340px" placeholder="Filter by name, SKU, brand, keyword…" value="${esc(S.q || '')}"><span class="muted small">${rows.length} shown</span><span class="grow"></span><button class="btn sm danger" data-act="deleteSelected">Delete selected</button></div>`
    + (rows.length ? `<div class="tbl-wrap"><table><thead><tr><th><input type="checkbox" id="selAll" aria-label="Select all"></th><th>Product</th><th>Category</th><th>MRP / Price</th><th>Stock</th><th>Channels</th><th>Updated</th><th></th></tr></thead><tbody>${rows.map(p => { const ls = S.listings.filter(l => l.productId === p.id && l.current); const img = (p.images || [])[0]; return `<tr class="rowlink" data-act="openProduct" data-id="${p.id}"><td data-stop><input type="checkbox" class="selrow" value="${p.id}" aria-label="Select"></td><td><div class="split" style="flex-wrap:nowrap">${img ? `<img class="thumb" src="${esc(img.url || img.data)}" alt="" loading="lazy">` : '<span class="thumb"></span>'}<div><b>${esc(p.productType || 'Untitled')}</b><div class="small muted">${esc(p.sku || 'no SKU')} · ${esc(p.brand || 'no brand')}${p.variants && p.variants.length ? ` · ${p.variants.length} variants` : ''}</div></div></div></td><td>${esc(p.category || '—')}</td><td>${money(p.mrp)} / <b>${money(p.sellingPrice)}</b></td><td>${p.stock === '' || p.stock == null ? '—' : p.stock}</td><td>${ls.length ? ls.map(l => { const ch = registry()[l.channel]; return ch ? `<span class="tag" style="border-color:${ch.accent}">${esc(ch.short)}</span>` : ''; }).join(' ') : '<span class="faint">—</span>'}</td><td class="small muted">${fmtDate(p.updatedAt)}</td><td data-stop><a class="btn sm" href="#/studio/${p.id}">Studio</a></td></tr>`; }).join('')}</tbody></table></div>` : `<div class="panel"><div class="empty"><div class="big">🗂️</div>${q ? 'Nothing matches that filter.' : 'No products yet.'}</div></div>`);
}

const PRODUCT_FIELDS = [
  { sec: 'Basics', f: [
    ['sku', 'SKU / style code', 'text', 'Your own code; every marketplace sheet needs one'], ['brand', 'Brand', 'text', '“Generic” if unbranded'], ['productType', 'Product type (what it is)', 'text', 'e.g. Food Strainer Colander, Cotton Kurti, Bluetooth Speaker', 1],
    ['category', 'Category', 'text', 'Kitchen, Fashion, Jewellery, Grocery…'], ['subcategory', 'Sub-category', 'text', ''], ['audience', 'Audience', 'text', 'women, men, kids, home kitchens…'],
  ] },
  { sec: 'What makes it good', f: [
    ['keyFeatures', 'Key features — one per line', 'textarea', 'Plain facts: “Fine mesh drains rice fast”, “Riveted handle stays cool”. These become bullets and the title\'s key-feature slot.', 1],
    ['useCases', 'Use cases — comma separated', 'text', 'rice washing, pasta draining…'], ['notes', 'Seller notes / story', 'textarea', 'Anything true and useful: who makes it, how, why it lasts. Never invented claims.'],
  ] },
  { sec: 'Attributes', f: [
    ['material', 'Material / fabric', 'text', ''], ['colour', 'Colour', 'text', ''], ['size', 'Size', 'text', '27 cm, Free Size, XL…'], ['model', 'Model name', 'text', ''], ['partNumber', 'Model / part number', 'text', ''],
    ['certifications', 'Certifications — comma separated', 'text', 'BIS, ISI, FSSAI, ISO…'], ['warranty', 'Warranty', 'text', '6 months manufacturing warranty (omitted on Meesho)'], ['care', 'Care instructions', 'text', 'Rinse and dry after use…'],
  ] },
  { sec: 'Pricing, tax & identity', f: [
    ['mrp', 'MRP (₹)', 'number', 'Printed on the pack'], ['sellingPrice', 'Selling price (₹)', 'number', ''], ['gst', 'GST %', 'select:0,3,5,12,18,28', ''], ['hsn', 'HSN code', 'text', '4, 6 or 8 digits'], ['gtin', 'GTIN / EAN / UPC', 'text', 'Barcode, or leave blank and apply for an exemption'], ['stock', 'Stock (units)', 'number', ''],
  ] },
  { sec: 'Package & logistics', f: [
    ['lengthCm', 'Length (cm)', 'number', ''], ['breadthCm', 'Breadth (cm)', 'number', ''], ['heightCm', 'Height (cm)', 'number', ''], ['weightG', 'Weight (g)', 'number', 'Packed weight'], ['netQuantity', 'Net quantity', 'text', '1 N, 500 g, 2 pcs — Legal Metrology'], ['packSize', 'Pack size (units per listing)', 'number', '1 unless it is a multi-pack'],
  ] },
  { sec: 'Compliance declarations (Legal Metrology)', f: [
    ['countryOfOrigin', 'Country of origin', 'text', ''], ['manufacturerName', 'Manufacturer / packer name', 'text', ''], ['manufacturerAddress', 'Manufacturer address', 'text', 'Full postal address'], ['packerName', 'Packer name (if different)', 'text', ''], ['packerAddress', 'Packer address', 'text', ''], ['importerName', 'Importer name (imported goods)', 'text', ''], ['importerAddress', 'Importer address', 'text', ''], ['consumerCare', 'Consumer care contact', 'text', 'Phone / email printed on the pack'],
  ] },
];
function fieldHtml([k, label, type, hint, req], v) {
  const val = Array.isArray(v) ? (type === 'textarea' ? v.join('\n') : v.join(', ')) : (v == null ? '' : v);
  let ctrl;
  if (type === 'textarea') ctrl = `<textarea class="input auto" name="${k}" rows="2">${esc(val)}</textarea>`;
  else if (type.startsWith('select:')) ctrl = `<select class="input" name="${k}">${type.slice(7).split(',').map(o => `<option value="${o}" ${String(val) === o ? 'selected' : ''}>${o}${k === 'gst' ? '%' : ''}</option>`).join('')}</select>`;
  else ctrl = `<input class="input" name="${k}" type="${type}" ${type === 'number' ? 'step="any" inputmode="decimal"' : ''} value="${esc(val)}" ${req ? 'required' : ''}>`;
  return `<div class="field"><label>${esc(label)}${req ? ' *' : ''}</label>${ctrl}${hint ? `<div class="hint">${esc(hint)}</div>` : ''}</div>`;
}
async function vProductEdit(id) {
  const isNew = id === 'new';
  const p = isNew ? Object.assign(E.blankProduct(), { id: uid(), images: [], variants: [], ...defaultsFromBusiness() }) : productById(id);
  if (!p) return `<div class="callout err">Product not found. <a href="#/products">Back</a></div>`;
  S.draft = structuredClone(p);
  const img = (i, n) => `<div class="im" data-idx="${n}">${i.url || i.data ? `<img src="${esc(i.url || i.data)}" alt="">` : 'no image'}<span class="n">${n + 1}${i.data ? ' local' : ''}</span><button class="x" data-act="imgRemove" data-idx="${n}" title="Remove">✕</button></div>`;
  return pageHead(isNew ? 'New product' : esc(p.productType || 'Edit product'), 'One record feeds every channel. Fields marked * are required; the rest raise your score.', `<button class="btn" data-act="cancelEdit">Cancel</button>${isNew ? '' : '<button class="btn" data-act="duplicateProduct">Duplicate</button><button class="btn danger" data-act="deleteProduct">Delete</button>'}<button class="btn" data-act="saveProduct">Save</button><button class="btn primary" data-act="saveAndStudio">Save &amp; open Studio →</button>`)
    + `<form id="productForm" onsubmit="return false">` + PRODUCT_FIELDS.map(sec => `<fieldset class="sec"><legend>${esc(sec.sec)}</legend>${sec.sec.startsWith('Compliance') ? '<div style="margin-bottom:10px"><button class="btn sm" data-act="applyBusinessDefaults">Fill from business defaults</button></div>' : ''}<div class="frow">${sec.f.map(f => fieldHtml(f, p[f[0]])).join('')}</div></fieldset>`).join('')
    + `<fieldset class="sec"><legend>Images</legend><div class="hint" style="margin-bottom:8px">Marketplace sheets need public image URLs (Google Drive “anyone with link”, your website, a CDN). Order is the display order — the first is the main photo. Local uploads preview here but are not exported.</div><div class="imgrow" id="imgRow">${(p.images || []).map(img).join('')}</div><div class="split" style="margin-top:10px"><input class="input" id="imgUrl" placeholder="https://… image URL" style="max-width:420px"><button class="btn" data-act="imgAdd">Add URL</button><button class="btn" data-act="imgUpload">Upload for preview</button><button class="btn sm" data-act="imgLeft" title="Move last-selected image earlier">◀ earlier</button><button class="btn sm" data-act="imgRight">later ▶</button></div></fieldset>`
    + `<fieldset class="sec"><legend>Keywords (dynamic SEO)</legend><div class="frow"><div class="field"><label>Seller keywords — comma separated <span class="cnt">${(p.keywords || []).length}</span></label><textarea class="input auto" name="keywords" rows="2">${esc((p.keywords || []).join(', '))}</textarea><div class="hint">Words shoppers actually type: “rice chalni”, “strainer for kitchen”. The engine adds synonyms, and live suggestions when online.</div></div></div><div class="split" style="margin-top:8px"><button class="btn" data-act="liveSuggest">Fetch live search suggestions</button><span class="small muted" id="suggestNote">${cloud.state.suggest ? 'Google + Amazon.in autocomplete, ranked into the keyword pool.' : 'Needs the online service (offline now: synonyms and your keywords still work).'}</span></div><div class="kwlist" id="suggestList" style="margin-top:8px"></div></fieldset>`
    + `<fieldset class="sec"><legend>Variants (colour × size)</legend><div class="hint" style="margin-bottom:8px">Leave empty for a single SKU. Each variant becomes one row in every sheet.</div><div id="varRows">${(p.variants || []).map((v, i) => varRow(v, i)).join('')}</div><button class="btn sm" data-act="varAdd">+ Add variant</button></fieldset></form>`;
}
function varRow(v = {}, i) { return `<div class="varrow" data-var="${i}"><input class="input" placeholder="Variant SKU" data-vk="sku" value="${esc(v.sku || '')}"><input class="input" placeholder="Colour" data-vk="colour" value="${esc(v.colour || '')}"><input class="input" placeholder="Size" data-vk="size" value="${esc(v.size || '')}"><input class="input" placeholder="Price" type="number" data-vk="sellingPrice" value="${esc(v.sellingPrice ?? '')}"><input class="input" placeholder="MRP" type="number" data-vk="mrp" value="${esc(v.mrp ?? '')}"><input class="input" placeholder="Stock" type="number" data-vk="stock" value="${esc(v.stock ?? '')}"><button class="btn sm danger" data-act="varRemove" data-idx="${i}">✕</button></div>`; }
function defaultsFromBusiness() { const b = S.settings.business; return { brand: b.brand, manufacturerName: b.manufacturerName, manufacturerAddress: b.manufacturerAddress, packerName: b.packerName, packerAddress: b.packerAddress, consumerCare: b.consumerCare, countryOfOrigin: b.countryOfOrigin || 'India', gst: b.gst }; }
function readProductForm() {
  const f = $('#productForm'); if (!f) return null;
  const p = S.draft;
  for (const sec of PRODUCT_FIELDS) for (const [k, , type] of sec.f) { const el = f.elements[k]; if (!el) continue; let v = el.value; if (['keyFeatures'].includes(k)) v = v.split(/\n+/).map(s => s.trim()).filter(Boolean); else if (['useCases', 'certifications'].includes(k)) v = v.split(/[,\n]+/).map(s => s.trim()).filter(Boolean); else if (type === 'number') v = v === '' ? '' : parseFloat(v); p[k] = v; }
  p.keywords = (f.elements.keywords.value || '').split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
  p.variants = $$('#varRows .varrow').map(r => { const o = {}; $$('[data-vk]', r).forEach(i => { o[i.dataset.vk] = i.type === 'number' ? (i.value === '' ? '' : parseFloat(i.value)) : i.value.trim(); }); return o; }).filter(v => v.sku || v.colour || v.size);
  return p;
}
function paintImages() { const row = $('#imgRow'); if (!row) return; row.innerHTML = (S.draft.images || []).map((i, n) => `<div class="im ${S.imgSel === n ? 'on' : ''}" data-idx="${n}" style="${S.imgSel === n ? 'outline:2px solid var(--accent)' : ''}">${i.url || i.data ? `<img src="${esc(i.url || i.data)}" alt="">` : 'no image'}<span class="n">${n + 1}${i.data ? ' local' : ''}</span><button class="x" data-act="imgRemove" data-idx="${n}" title="Remove">✕</button></div>`).join(''); }

/* ── Studio ── */
async function vStudio(r) {
  if (!r.id) {
    return pageHead('Listing Studio', 'Pick a product to generate, polish and export its channel listings.') + (S.products.length ? `<div class="grid g3">${S.products.map(p => { const ls = S.listings.filter(l => l.productId === p.id && l.current); return `<a class="panel" href="#/studio/${p.id}" style="padding:14px;display:block;color:inherit"><b>${esc(p.productType || 'Untitled')}</b><div class="small muted">${esc(p.sku || '')} · ${money(p.sellingPrice)}</div><div style="margin-top:8px">${ls.length ? ls.map(l => { const ch = registry()[l.channel]; return ch ? `<span class="tag" style="border-color:${ch.accent}">${esc(ch.short)}</span>` : ''; }).join(' ') : '<span class="faint small">no listings yet</span>'}</div></a>`; }).join('')}</div>` : `<div class="panel"><div class="empty"><div class="big">🧪</div>No products yet. <a href="#/products/new">Create one</a> or <a href="#" data-act="loadSample">load the sample</a>.</div></div>`);
  }
  const p = productById(r.id); if (!p) return `<div class="callout err">Product not found. <a href="#/studio">Back</a></div>`;
  S.studio = { pid: p.id, sel: (S.studio && S.studio.pid === p.id && S.studio.sel) || enabledChannels().map(c => c.id) };
  const chips = enabledChannels().map(ch => chanChip(ch, S.studio.sel.includes(ch.id), `data-act="toggleSel" data-id="${ch.id}"`)).join(' ');
  return pageHead(esc(p.productType || 'Untitled'), `<a href="#/products/${p.id}">Edit product</a> · ${esc(p.sku || 'no SKU')} · ${money(p.sellingPrice)} · ${(p.images || []).length} image${(p.images || []).length === 1 ? '' : 's'}`, `<button class="btn" data-act="liveSuggest">Live keywords</button><button class="btn" data-act="aiAll" ${cloud.state.ai || secrets.get('gemini') ? '' : 'title="Needs the online AI service or your own Gemini key"'}>✦ Enhance all with AI</button><button class="btn primary" data-act="generateAll">Generate all</button>`)
    + `<div class="studio"><div class="side"><div class="panel"><div class="ph"><h3>Channels</h3><button class="btn sm" data-act="selAllCh">All / none</button></div><div class="pb"><div class="split" id="chSel">${chips}</div><p class="small muted" style="margin:10px 0 0">Generate rewrites every unlocked field from the rule engine. Edit any field by hand and it locks (🔒) until you unlock it.</p></div></div>
    <div class="panel" style="margin-top:14px"><div class="ph"><h3>Keyword pool</h3></div><div class="pb"><div class="kwlist" id="poolList"></div><p class="small muted" style="margin:10px 0 0">Ranked by weight: your keywords, product words, synonyms, live suggestions (green) and performance boosts (purple). <a href="#/keywords">Manage</a></p></div></div>
    <div class="panel" style="margin-top:14px"><div class="ph"><h3>Export</h3></div><div class="pb split"><button class="btn" data-act="exportSelected">Sheets for selected channels</button><button class="btn" data-act="copyAll">Copy all as text</button><button class="btn" data-act="printAll">Print / PDF</button></div></div></div>
    <div id="cards">${enabledChannels().filter(ch => S.studio.sel.includes(ch.id)).map(ch => channelCard(ch, listingRec(p.id, ch.id), p)).join('')}</div></div>`;
}
function meterHtml(f, len, isBytes) {
  const max = f.maxBytes || f.max; if (!max) return '';
  const pct = Math.min(100, len / max * 100); const t = f.target || [0, max];
  const cls = len > max ? 'err' : len < t[0] ? 'low' : len > t[1] ? 'warn' : '';
  return `<div class="meter" title="band ${t[0]}–${t[1]}, max ${max}${isBytes ? ' bytes' : ''}"><i class="${cls}" style="width:${pct}%"></i><b style="left:${t[0] / max * 100}%"></b><b style="left:${Math.min(100, t[1] / max * 100)}%"></b></div>`;
}
function cntCls(f, len) { const max = f.maxBytes || f.max; const t = f.target || [0, max]; return len > max ? 'over' : len < t[0] ? 'low' : len <= t[1] ? 'band' : ''; }
function channelCard(ch, rec, p) {
  const cur = rec && rec.current; const ev = cur ? evaluate(p.id, ch.id, cur) : null;
  const lock = k => rec && rec.locked && rec.locked[k];
  const fieldBlock = (k, f) => {
    if (!cur) return '';
    if (k === 'bullets') return `<div class="lfield"><div class="lh"><b>${esc(f.label)} <span class="faint">(${f.count} × ≤${f.maxEach})</span></b><span class="split"><button class="btn sm ghost" data-act="lockToggle" data-ch="${ch.id}" data-field="bullets" title="Lock keeps your edit through Generate">${lock('bullets') ? '🔒' : '🔓'}</button><button class="btn sm ghost" data-act="copyField" data-ch="${ch.id}" data-field="bullets">Copy</button></span></div>${cur.bullets.map((b, i) => `<div class="split" style="align-items:flex-start;margin-bottom:4px"><span class="faint small mono" style="padding-top:8px">${i + 1}</span><div style="flex:1"><textarea class="auto" data-ch="${ch.id}" data-field="bullets" data-idx="${i}" rows="1">${esc(b)}</textarea>${meterHtml({ max: f.maxEach, target: f.targetEach }, b.length)}</div><span class="cnt small ${cntCls({ max: f.maxEach, target: f.targetEach }, b.length)}" style="padding-top:8px" data-cnt="bullets${i}">${b.length}</span></div>`).join('')}${cur.bullets.length < f.count ? `<button class="btn sm" data-act="bulletAdd" data-ch="${ch.id}">+ bullet</button>` : ''}</div>`;
    const v = cur[k] || ''; const len = f.maxBytes ? E.bytes(v) : v.length;
    return `<div class="lfield"><div class="lh"><b>${esc(f.label)}</b><span class="split"><span class="cnt ${cntCls(f, len)}" data-cnt="${k}">${len}${f.maxBytes ? ' B' : ''} / ${f.maxBytes || f.max}</span><button class="btn sm ghost" data-act="lockToggle" data-ch="${ch.id}" data-field="${k}">${lock(k) ? '🔒' : '🔓'}</button><button class="btn sm ghost" data-act="copyField" data-ch="${ch.id}" data-field="${k}">Copy</button></span></div><textarea class="auto" data-ch="${ch.id}" data-field="${k}" rows="1">${esc(v)}</textarea><div data-meter="${k}">${meterHtml(f, len, !!f.maxBytes)}</div></div>`;
  };
  const versions = rec && rec.versions ? rec.versions : [];
  return `<div class="panel chcard" id="card-${ch.id}" style="--c:${ch.accent}"><div class="ph"><h3>${esc(ch.name)} <span class="tag ${ch.status === 'live' ? 'ok' : ch.status === 'custom' ? 'acc' : 'info'}">${ch.status}</span></h3><div class="split">${ev ? scoreRing(ev.score.total) : ''}${versions.length ? `<select class="input" style="width:auto;padding:6px 8px" data-act="versionPick" data-ch="${ch.id}">${versions.map(v => `<option value="${v.v}" ${v.v === versions.length ? 'selected' : ''}>v${v.v} · ${v.source}</option>`).join('')}</select>` : ''}<button class="btn sm" data-act="aiOne" data-ch="${ch.id}">✦ AI</button><button class="btn sm" data-act="generateOne" data-ch="${ch.id}">${cur ? 'Regenerate' : 'Generate'}</button><button class="btn sm" data-act="exportOne" data-ch="${ch.id}" ${cur ? '' : 'disabled'}>Sheet</button></div></div>
    ${cur ? Object.entries(ch.fields).map(([k, f]) => fieldBlock(k, f)).join('') + `<div class="lfield"><div class="lh"><b>Checks</b><span class="small muted">score ${ev.score.parts.map(x => `${x.name} ${x.got}/${x.max}`).join(' · ')}</span></div><ul class="issues" data-issues="${ch.id}">${ev.issues.length ? ev.issues.map(i => `<li class="${i.level}">${esc(i.msg)}</li>`).join('') : '<li class="ok">All checks pass for this channel.</li>'}</ul><div class="small muted" style="margin-top:8px">Images: ${ch.images.min}–${ch.images.max}, ${ch.images.minPx}px+${ch.images.mainWhiteBg ? ', main on white' : ''}${ch.images.ratio ? `, ${ch.images.ratio}` : ''}. <a href="#/performance">Log performance</a> for this listing to feed the SEO loop.</div></div>` : `<div class="pb muted">Not generated yet. <button class="btn sm primary" data-act="generateOne" data-ch="${ch.id}">Generate from the rule engine</button></div>`}</div>`;
}
function mountStudio() {
  paintPool();
  const cards = $('#cards'); if (!cards) return;
  cards.addEventListener('input', debounce(async e => {
    const t = e.target; if (!t.matches('textarea[data-field]')) return;
    const chid = t.dataset.ch, k = t.dataset.field, rec = listingRec(S.studio.pid, chid); if (!rec) return;
    if (k === 'bullets') { rec.current.bullets = $$(`textarea[data-ch="${chid}"][data-field="bullets"]`, cards).map(x => x.value); }
    else rec.current[k] = t.value;
    rec.locked = rec.locked || {}; rec.locked[k] = true;
    await saveListing(rec); refreshCard(chid, { keepFocus: true });
  }, 350));
}
function paintPool() {
  const el = $('#poolList'); if (!el || !S.studio) return;
  const p = productById(S.studio.pid); const pool = E.keywordPool(p, { suggestions: S.suggest[p.id] || [], boosts: boostsFor(p.id) }).slice(0, 24);
  el.innerHTML = pool.length ? pool.map(k => `<span class="kw ${k.sources.includes('live') ? 'live' : ''} ${k.sources.includes('performance') ? 'perf' : ''}" title="${esc(k.sources.join(', '))}">${esc(k.term)}<span class="w">${k.weight.toFixed(1)}</span></span>`).join('') : '<span class="muted small">Add a product type and keywords to build the pool.</span>';
}
function refreshCard(chid, { keepFocus = false } = {}) {
  const ch = registry()[chid], p = productById(S.studio.pid), rec = listingRec(p.id, chid); const card = $(`#card-${chid}`); if (!card) return;
  if (!keepFocus) { card.outerHTML = channelCard(ch, rec, p); $$(`#card-${chid} textarea.auto`).forEach(autosize); return; }
  const ev = evaluate(p.id, chid, rec.current);
  $('.score', card) && ($('.score', card).outerHTML = scoreRing(ev.score.total));
  for (const [k, f] of Object.entries(ch.fields)) {
    if (k === 'bullets') { rec.current.bullets.forEach((b, i) => { const c = $(`[data-cnt="bullets${i}"]`, card); if (c) { c.textContent = b.length; c.className = `cnt small ${cntCls({ max: f.maxEach, target: f.targetEach }, b.length)}`; } const ta = $(`textarea[data-field="bullets"][data-idx="${i}"]`, card); if (ta && ta.nextElementSibling) ta.nextElementSibling.outerHTML = meterHtml({ max: f.maxEach, target: f.targetEach }, b.length); }); continue; }
    const v = rec.current[k] || ''; const len = f.maxBytes ? E.bytes(v) : v.length; const c = $(`[data-cnt="${k}"]`, card); if (c) { c.textContent = `${len}${f.maxBytes ? ' B' : ''} / ${f.maxBytes || f.max}`; c.className = `cnt ${cntCls(f, len)}`; } const m = $(`[data-meter="${k}"]`, card); if (m) m.innerHTML = meterHtml(f, len, !!f.maxBytes);
  }
  const ul = $(`[data-issues="${chid}"]`, card); if (ul) ul.innerHTML = ev.issues.length ? ev.issues.map(i => `<li class="${i.level}">${esc(i.msg)}</li>`).join('') : '<li class="ok">All checks pass for this channel.</li>';
  $$('button[data-act="lockToggle"]', card).forEach(b => { b.textContent = rec.locked && rec.locked[b.dataset.field] ? '🔒' : '🔓'; });
}

/* ── Keywords ── */
async function vKeywords(r) {
  const pid = r.id || (S.products[0] && S.products[0].id); const p = pid && productById(pid);
  const opts = S.products.map(x => `<option value="${x.id}" ${x.id === pid ? 'selected' : ''}>${esc(x.productType || 'Untitled')} (${esc(x.sku || '—')})</option>`).join('');
  if (!p) return pageHead('Keywords & SEO') + `<div class="panel"><div class="empty">Add a product first.</div></div>`;
  const pool = E.keywordPool(p, { suggestions: S.suggest[p.id] || [], boosts: boostsFor(p.id) });
  return pageHead('Keywords & SEO', 'Where the dynamic SEO ranking comes from, and how to feed it.', `<select class="input" style="width:auto" data-act="pickKwProduct">${opts}</select>`)
    + `<div class="grid g2"><div class="panel"><div class="ph"><h3>Live search suggestions</h3></div><div class="pb"><div class="split"><input class="input" id="seedInput" value="${esc(p.productType)}" placeholder="Seed phrase" style="max-width:320px"><button class="btn primary" data-act="fetchSuggest" data-id="${p.id}">Fetch</button></div><p class="small muted" style="margin:8px 0">Google and Amazon.in autocomplete for the seed, fetched fresh each time (via the site's suggest proxy; nothing is stored server-side). Click a suggestion to add it to the product's seller keywords.</p><div class="kwlist" id="suggestList">${(S.suggest[p.id] || []).map(s => `<span class="kw live" data-act="addKeyword" data-id="${p.id}" data-term="${esc(s)}" style="cursor:pointer">${esc(s)} +</span>`).join('')}</div></div></div>
    <div class="panel"><div class="ph"><h3>Keyword pool for this product</h3><span class="tag">${pool.length}</span></div><div class="pb"><div class="tbl-wrap" style="border:0"><table><thead><tr><th>Term</th><th>Weight</th><th>Sources</th></tr></thead><tbody>${pool.slice(0, 40).map(k => `<tr><td>${esc(k.term)}</td><td class="mono">${k.weight.toFixed(1)}</td><td class="small muted">${esc(k.sources.join(', '))}</td></tr>`).join('')}</tbody></table></div></div></div></div>
    <div class="panel" style="margin-top:14px"><div class="ph"><h3>How the ranking works</h3></div><div class="pb help"><ul><li><b>Seller keywords</b> (yours) weigh most; <b>product words</b> and their marketplace <b>synonyms</b> (chalni, dabba, kurta…) next; then use cases, material, audience and category hints.</li><li><b>Live suggestions</b> are what people typed this week — they enter near the top and can displace an optional title slot.</li><li><b>Performance boosts</b> come from your own impressions/clicks: words that ride with higher CTR move earlier, words in weak titles move later. <a href="#/performance">Log data</a>.</li><li>Every channel then fills its own band (Amazon 62–75 chars, Flipkart ~100, Meesho 60–80) from that ranked pool, with the platform's rules enforced.</li></ul></div></div>`;
}

/* ── Performance ── */
async function vPerformance(r) {
  const pid = r.id || (S.perf[0] && S.perf[0].productId) || (S.products[0] && S.products[0].id); const p = pid && productById(pid);
  const rows = S.perf.filter(x => x.productId === pid).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const ins = E.boostFromPerformance(rows);
  const opts = S.products.map(x => `<option value="${x.id}" ${x.id === pid ? 'selected' : ''}>${esc(x.productType || 'Untitled')}</option>`).join('');
  const chOpts = enabledChannels().map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  return pageHead('Performance loop', 'Log what each live title did. The engine turns it into keyword boosts and re-optimised titles.', `<select class="input" style="width:auto" data-act="pickPerfProduct">${opts}</select><button class="btn" data-act="importPerf">Import CSV</button>`)
    + (p ? `<div class="grid g2"><div class="panel"><div class="ph"><h3>Log a period</h3></div><div class="pb"><form id="perfForm" onsubmit="return false"><div class="frow"><div class="field"><label>Channel</label><select class="input" name="channel">${chOpts}</select></div><div class="field"><label>Title that was live</label><input class="input" name="title" placeholder="Paste the exact title" required></div><div class="field"><label>Impressions</label><input class="input" name="impressions" type="number" min="0" inputmode="numeric" required></div><div class="field"><label>Clicks / sessions</label><input class="input" name="clicks" type="number" min="0" inputmode="numeric" required></div><div class="field"><label>Orders</label><input class="input" name="orders" type="number" min="0" inputmode="numeric"></div><div class="field"><label>Period end</label><input class="input" name="date" type="date" value="${new Date().toISOString().slice(0, 10)}"></div></div><div class="split" style="margin-top:10px"><button class="btn primary" data-act="perfAdd" data-id="${p.id}">Add row</button><button class="btn" data-act="perfUseCurrent" data-id="${p.id}">Use current title</button></div></form></div></div>
    <div class="panel"><div class="ph"><h3>Insights</h3><button class="btn sm primary" data-act="reoptimise" data-id="${p.id}" ${rows.length >= 2 ? '' : 'disabled'}>Re-optimise titles</button></div><div class="pb"><ul class="issues">${ins.insights.length ? ins.insights.map(i => `<li class="ok">${esc(i)}</li>`).join('') : '<li>Log at least two rows (two versions, or two channels) to compare.</li>'}</ul>${Object.keys(ins.boosts).length ? `<div class="kwlist" style="margin-top:10px">${Object.entries(ins.boosts).sort((a, b) => b[1] - a[1]).slice(0, 16).map(([w, b]) => `<span class="kw ${b > 0 ? 'perf' : ''}">${esc(w)}<span class="w">${b > 0 ? '+' : ''}${b}</span></span>`).join('')}</div>` : ''}</div></div></div>
    <div class="tbl-wrap" style="margin-top:14px"><table><thead><tr><th>Date</th><th>Channel</th><th>Title</th><th>Impr.</th><th>Clicks</th><th>CTR</th><th>Orders</th><th></th></tr></thead><tbody>${rows.length ? rows.map(x => `<tr><td class="small">${fmtDate(x.date)}</td><td>${esc((registry()[x.channel] || {}).short || x.channel)}</td><td class="small">${esc(x.title)}</td><td>${x.impressions}</td><td>${x.clicks}</td><td class="mono">${x.impressions ? (x.clicks / x.impressions * 100).toFixed(2) + '%' : '—'}</td><td>${x.orders || 0}</td><td><button class="btn sm danger" data-act="perfDelete" data-id="${x.id}">✕</button></td></tr>`).join('') : '<tr><td colspan="8" class="muted">No rows yet.</td></tr>'}</tbody></table></div>` : `<div class="panel"><div class="empty">Add a product first.</div></div>`);
}

/* ── Channels ── */
async function vChannels(r) {
  if (r.id === 'edit') return vChannelEdit(r.sub);
  const groups = {}; for (const ch of allChannels()) (groups[ch.group] = groups[ch.group] || []).push(ch);
  return pageHead('Channels', 'Every marketplace this workspace can write for. Turn channels on or off, inspect their rules, or build your own.', `<button class="btn primary" data-act="newChannel">+ Custom channel</button>`)
    + Object.entries(groups).map(([g, list]) => `<h4 style="margin:18px 0 8px">${esc(g)}</h4><div class="grid g3">${list.map(ch => { const on = S.settings.enabledChannels.includes(ch.id); const f = ch.fields; return `<div class="panel" style="padding:14px;border-top:4px solid ${ch.accent}"><div class="split" style="justify-content:space-between"><b>${esc(ch.name)}</b><label class="check" title="Enable"><input type="checkbox" data-act="toggleChannel" data-id="${ch.id}" ${on ? 'checked' : ''}><span class="switch"></span></label></div><div class="small muted" style="margin:6px 0 8px">${esc(ch.summary)}</div><div class="split"><span class="tag ${ch.status === 'live' ? 'ok' : ch.status === 'custom' ? 'acc' : 'info'}">${ch.status}</span><span class="tag">policy ${fmtDate(ch.policyDate)}</span></div><dl class="kv small" style="margin-top:10px"><dt>Title</dt><dd>${f.title.target[0]}–${f.title.target[1]} of ${f.title.max}</dd>${f.highlights ? `<dt>${esc(f.highlights.label)}</dt><dd>≤${f.highlights.max}</dd>` : ''}${f.bullets ? `<dt>${esc(f.bullets.label)}</dt><dd>${f.bullets.count} × ≤${f.bullets.maxEach}</dd>` : ''}<dt>Description</dt><dd>≤${f.description ? f.description.max : '—'}</dd>${f.keywords ? `<dt>${esc(f.keywords.label)}</dt><dd>≤${f.keywords.maxBytes} B</dd>` : ''}<dt>Images</dt><dd>${ch.images.min}–${ch.images.max}, ${ch.images.minPx}px+</dd><dt>Export</dt><dd>${exportSpec(ch, registry()).format.toUpperCase()} · ${exportSpec(ch, registry()).headerRow.length} columns</dd></dl><div class="split" style="margin-top:10px">${ch.status === 'custom' ? `<a class="btn sm" href="#/channels/edit/${ch.id}">Edit</a><button class="btn sm danger" data-act="deleteChannel" data-id="${ch.id}">Delete</button>` : `<button class="btn sm" data-act="cloneChannel" data-id="${ch.id}">Duplicate as custom</button>`}${ch.site ? `<a class="btn sm ghost" href="${esc(ch.site)}" target="_blank" rel="noopener">Seller portal ↗</a>` : ''}</div></div>`; }).join('')}</div>`).join('');
}
const RULE_IDS = Object.keys(RULE_LABELS);
const COMPLIANCE_IDS = ['manufacturer', 'netQuantity', 'mrp', 'countryOfOrigin', 'consumerCare', 'commonName', 'hsn', 'gstRate', 'gtin', 'warranty', 'bulletsAll5'];
async function vChannelEdit(id) {
  const existing = S.custom.find(c => c.id === id); const c = existing ? structuredClone(existing) : blankChannel(id || ('custom_' + uid().slice(0, 6)));
  S.chDraft = c;
  const fieldEd = (k, label) => { const f = c.fields[k]; const on = !!f; const d = f || { label, max: 200, target: [60, 120], rules: [] }; return `<fieldset class="sec"><legend><label class="check"><input type="checkbox" name="on_${k}" ${on ? 'checked' : ''}><span class="switch"></span> ${label}</label></legend><div class="frow tight"><div class="field"><label>Label</label><input class="input" name="${k}_label" value="${esc(d.label)}"></div>${k === 'bullets' ? `<div class="field"><label>Count</label><input class="input" type="number" name="bullets_count" value="${d.count || 5}"></div><div class="field"><label>Max each</label><input class="input" type="number" name="bullets_maxEach" value="${d.maxEach || 200}"></div><div class="field"><label>Band min</label><input class="input" type="number" name="bullets_tmin" value="${(d.targetEach || [60, 160])[0]}"></div><div class="field"><label>Band max</label><input class="input" type="number" name="bullets_tmax" value="${(d.targetEach || [60, 160])[1]}"></div>` : `<div class="field"><label>${k === 'keywords' ? 'Max bytes' : 'Max chars'}</label><input class="input" type="number" name="${k}_max" value="${d.maxBytes || d.max}"></div><div class="field"><label>Band min</label><input class="input" type="number" name="${k}_tmin" value="${(d.target || [0, 0])[0]}"></div><div class="field"><label>Band max</label><input class="input" type="number" name="${k}_tmax" value="${(d.target || [0, 0])[1]}"></div>${k === 'highlights' ? `<div class="field"><label>Separator</label><input class="input" name="highlights_sep" value="${esc(d.sep || ' | ')}"></div>` : ''}`}</div><div class="split" style="margin-top:8px">${RULE_IDS.map(rid => `<label class="chip ${(d.rules || []).includes(rid) ? 'on' : ''}"><input type="checkbox" name="${k}_rule_${rid}" ${(d.rules || []).includes(rid) ? 'checked' : ''} hidden>${esc(RULE_LABELS[rid])}</label>`).join('')}</div></fieldset>`; };
  const ex = c.export.inherit ? exportSpec(c, registry()) : c.export;
  return pageHead(existing ? `Edit channel: ${esc(c.name)}` : 'New custom channel', 'Define the limits, rules, composer slots and the exact sheet columns. The engine treats it like any built-in marketplace.', `<a class="btn" href="#/channels">Cancel</a><button class="btn primary" data-act="saveChannel">Save channel</button>`)
    + `<form id="chForm" onsubmit="return false"><fieldset class="sec"><legend>Identity</legend><div class="frow"><div class="field"><label>Channel id</label><input class="input mono" name="id" value="${esc(c.id)}" ${existing ? 'readonly' : ''}></div><div class="field"><label>Name</label><input class="input" name="name" value="${esc(c.name)}" required></div><div class="field"><label>Short name</label><input class="input" name="short" value="${esc(c.short)}"></div><div class="field"><label>Group</label><input class="input" name="group" value="${esc(c.group)}"></div><div class="field"><label>Accent colour</label><input class="input" type="color" name="accent" value="${esc(c.accent)}"></div><div class="field"><label>Seller portal URL</label><input class="input" name="site" value="${esc(c.site)}"></div><div class="field" style="grid-column:1/-1"><label>Summary / policy notes</label><textarea class="input auto" name="summary" rows="2">${esc(c.summary)}</textarea></div></div></fieldset>
    ${fieldEd('title', 'Title')}${fieldEd('highlights', 'Highlights / SEO title')}${fieldEd('bullets', 'Bullets / key features')}${fieldEd('description', 'Description')}${fieldEd('keywords', 'Search keywords')}${fieldEd('metaDescription', 'Meta description')}
    <fieldset class="sec"><legend>Title composer</legend><div class="frow"><div class="field"><label>Slots in order (comma separated)</label><input class="input mono" name="titleSlots" value="${esc(c.titleSlots.join(', '))}"><div class="hint">Available: ${Object.keys(SLOT_LABELS).join(', ')}</div></div><div class="field"><label>Joiner</label><input class="input mono" name="titleJoin" value="${esc(c.titleJoin || ' ')}"></div><div class="field"><label>Slots shown in brackets</label><input class="input mono" name="titleParen" value="${esc((c.titleParen || []).join(', '))}"></div></div></fieldset>
    <fieldset class="sec"><legend>Images, price, compliance</legend><div class="frow tight"><div class="field"><label>Min images</label><input class="input" type="number" name="img_min" value="${c.images.min}"></div><div class="field"><label>Max images</label><input class="input" type="number" name="img_max" value="${c.images.max}"></div><div class="field"><label>Min px</label><input class="input" type="number" name="img_minPx" value="${c.images.minPx}"></div><div class="field"><label>Max selling price (0 = none)</label><input class="input" type="number" name="maxSell" value="${c.price.maxSell || 0}"></div></div><div class="split" style="margin-top:8px"><label class="chip ${c.images.mainWhiteBg ? 'on' : ''}"><input type="checkbox" name="mainWhiteBg" ${c.images.mainWhiteBg ? 'checked' : ''} hidden>Main image on white</label><label class="chip ${c.price.requireMRP ? 'on' : ''}"><input type="checkbox" name="requireMRP" ${c.price.requireMRP ? 'checked' : ''} hidden>MRP required</label>${COMPLIANCE_IDS.map(cid => `<label class="chip ${c.compliance.includes(cid) ? 'on' : ''}"><input type="checkbox" name="comp_${cid}" ${c.compliance.includes(cid) ? 'checked' : ''} hidden>${cid}</label>`).join('')}</div></fieldset>
    <fieldset class="sec"><legend>Export sheet</legend><div class="frow"><div class="field"><label>Format</label><select class="input" name="format"><option value="xlsx" ${ex.format === 'xlsx' ? 'selected' : ''}>XLSX</option><option value="csv" ${ex.format === 'csv' ? 'selected' : ''}>CSV</option></select></div><div class="field"><label>Sheet name</label><input class="input" name="sheet" value="${esc(ex.sheet || 'Products')}"></div></div><div class="frow" style="margin-top:10px"><div class="field"><label>Column headers — one per line</label><textarea class="input auto mono" name="headers" rows="6">${esc(ex.headerRow.join('\n'))}</textarea></div><div class="field"><label>Field for each column — one per line, same order</label><textarea class="input auto mono" name="map" rows="6">${esc(ex.map.join('\n'))}</textarea><div class="hint">Fields: sku title highlights description descriptionWithBullets descriptionHtml bullet1…bullet5 bulletsJoined bulletsPipe keywords keywordsComma metaDescription sellingPrice mrp stock image1…image9 imagesPipe imagesComma colour size material packSize netQuantity countryOfOrigin hsn gst taxCode weightG weightKg lengthCm breadthCm heightCm warranty gtin gtinType manufacturerName manufacturerAddress manufacturerDetails packerDetails importerDetails partNumber model productType category subcategory salesPackage handle brand · or const:TEXT for a fixed value.</div></div></div></fieldset></form>`;
}
function readChannelForm() {
  const f = $('#chForm'), c = S.chDraft; const v = n => (f.elements[n] ? f.elements[n].value : '').trim(); const num = n => parseFloat(v(n)) || 0; const on = n => !!(f.elements[n] && f.elements[n].checked);
  c.id = v('id').toLowerCase().replace(/[^a-z0-9_]+/g, '_'); c.name = v('name'); c.short = v('short') || c.name.slice(0, 10); c.group = v('group') || 'Custom'; c.accent = v('accent'); c.site = v('site'); c.summary = v('summary'); c.status = 'custom';
  const fields = {};
  for (const k of ['title', 'highlights', 'bullets', 'description', 'keywords', 'metaDescription']) {
    if (!on('on_' + k)) continue;
    const rules = RULE_IDS.filter(r => on(`${k}_rule_${r}`));
    if (k === 'bullets') fields.bullets = { label: v('bullets_label'), count: num('bullets_count') || 5, maxEach: num('bullets_maxEach') || 200, targetEach: [num('bullets_tmin'), num('bullets_tmax')], rules };
    else { const fd = { label: v(k + '_label'), target: [num(k + '_tmin'), num(k + '_tmax')], rules }; if (k === 'keywords') fd.maxBytes = num(k + '_max') || 250; else fd.max = num(k + '_max') || 200; if (k === 'highlights') fd.sep = f.elements.highlights_sep.value || ' | '; if (fd.target[1] <= 0 || fd.target[1] > (fd.max || fd.maxBytes)) fd.target[1] = fd.max || fd.maxBytes; fields[k] = fd; }
  }
  if (!fields.title) throw new Error('A channel needs a title field.');
  c.fields = fields;
  c.titleSlots = v('titleSlots').split(/[,\s]+/).filter(s => SLOT_LABELS[s]); if (!c.titleSlots.length) c.titleSlots = ['brand', 'productType']; c.titleJoin = f.elements.titleJoin.value || ' '; c.titleParen = v('titleParen').split(/[,\s]+/).filter(s => SLOT_LABELS[s]);
  c.images = { min: num('img_min') || 1, max: num('img_max') || 5, minPx: num('img_minPx') || 500, recPx: Math.max(1000, num('img_minPx')), mainWhiteBg: on('mainWhiteBg') };
  c.price = { requireMRP: on('requireMRP'), sellLteMrp: true, maxSell: num('maxSell') || null };
  c.compliance = COMPLIANCE_IDS.filter(cid => on('comp_' + cid));
  const headerRow = v('headers').split('\n').map(s => s.trim()).filter(Boolean), map = v('map').split('\n').map(s => s.trim()).filter(Boolean);
  if (headerRow.length !== map.length) throw new Error(`Export: ${headerRow.length} headers but ${map.length} fields — they must match line for line.`);
  if (!headerRow.length) throw new Error('Export needs at least one column.');
  c.export = { format: v('format') || 'xlsx', sheet: v('sheet') || 'Products', headerRow, map };
  return c;
}

/* ── Exports ── */
async function vExports() {
  S.exp = S.exp || { ch: enabledChannels().map(c => c.id), pids: S.products.map(p => p.id) };
  return pageHead('Exports', 'One sheet per channel in that marketplace\'s own column layout, one row per variant. Products without a generated listing are generated on the fly.', `<button class="btn" data-act="exportPack">Listing pack (JSON)</button><button class="btn primary" data-act="exportRun">Download sheets</button>`)
    + `<div class="grid g2"><div class="panel"><div class="ph"><h3>Channels</h3><button class="btn sm" data-act="expAllCh">All / none</button></div><div class="pb split">${enabledChannels().map(ch => chanChip(ch, S.exp.ch.includes(ch.id), `data-act="expToggleCh" data-id="${ch.id}"`)).join('')}</div></div>
    <div class="panel"><div class="ph"><h3>Products</h3><button class="btn sm" data-act="expAllP">All / none</button></div><div class="pb" style="max-height:360px;overflow:auto">${S.products.length ? S.products.map(p => `<label class="check" style="padding:6px 0"><input type="checkbox" data-act="expToggleP" data-id="${p.id}" ${S.exp.pids.includes(p.id) ? 'checked' : ''}><span class="switch"></span><span>${esc(p.productType || 'Untitled')} <span class="faint small">${esc(p.sku || '')}</span></span></label>`).join('') : '<div class="muted">No products yet.</div>'}</div></div></div>
    <div class="panel" style="margin-top:14px"><div class="ph"><h3>Upload guide</h3></div><div class="pb help"><ul><li><b>Amazon India / Bazaar</b>: open your category's flat file from Seller Central → Add Products via Upload, paste these columns into the Template sheet (row 3 headers), then upload. Fields not in your category template are simply ignored.</li><li><b>Flipkart / Shopsy</b>: Seller Hub → Listings → Add new listings → bulk; paste into the vertical's template. Shopsy uses the same catalogue.</li><li><b>Meesho</b>: Supplier Panel → Catalog Upload → Bulk; the Catalog sheet matches Meesho's column names.</li><li><b>ShopClues</b>: Seller Panel → Bulk Upload. <b>IBI Marketplace</b>: Seller Central → Bulk Upload accepts the sheet as-is.</li><li>Preview channels (JioMart, Snapdeal, eBay, Etsy, Shopify, WooCommerce) export that platform's common sheet; check the column names against your account's template once.</li></ul></div></div>`;
}

/* ── Account ── */
async function vAccount() {
  const u = cloud.state.user, plan = planOf();
  const pricing = `<div class="pricing">${Object.entries(PLANS).map(([k, pl]) => `<div class="plan ${plan === k ? 'cur' : ''}">${pl.popular ? '<span class="rib">Most popular</span>' : ''}<b>${esc(pl.name)}</b><div class="price">${pl.price ? `₹${pl.price.toLocaleString('en-IN')}<small>/month, GST incl.</small>` : 'Free'}</div><ul><li>${pl.products.toLocaleString('en-IN')} products in cloud sync</li><li>${pl.ai} AI enhancements / month</li><li>${pl.custom >= 99 ? 'Unlimited' : pl.custom} custom channel${pl.custom === 1 ? '' : 's'}</li><li>${pl.seats} seat${pl.seats > 1 ? 's' : ''}</li>${k !== 'free' ? '<li>Performance loop + priority fixes</li>' : '<li>Every channel, unlimited local products</li>'}</ul>${plan === k ? '<span class="tag ok">Current plan</span>' : k === 'free' ? '' : `<button class="btn ${pl.popular ? 'primary' : ''}" data-act="choosePlan" data-id="${k}">Choose ${esc(pl.name)}</button>`}</div>`).join('')}</div>`;
  const backup = `<div class="panel" style="margin-top:14px"><div class="ph"><h3>Backup</h3></div><div class="pb split"><button class="btn" data-act="backupExport">Download backup (JSON)</button><button class="btn" data-act="backupImport">Restore from backup</button><span class="small muted">Everything in this workspace — products, listings, performance rows, custom channels, settings. Keys are never included.</span></div></div>`;
  if (!cloud.state.available) return pageHead('Account & plan', 'Local mode') + `<div class="callout warn"><div><b>The online service is not reachable</b> (${esc(cloud.state.error || 'offline')}). Everything on this device keeps working — products, the rule engine, exports. Sign-in, cloud sync, server AI, live suggestions and billing return when you are online at the live site.</div></div>` + backup + `<div style="margin-top:18px"><h2>Plans</h2>${pricing}</div>`;
  if (!u) return pageHead('Account & plan', 'Sign in to sync this workspace across devices, use server AI and manage your plan.') + `<div class="grid g2"><div class="panel"><div class="ph"><h3 id="authTitle">${S.authMode === 'signup' ? 'Create your account' : 'Sign in'}</h3><button class="btn sm ghost" data-act="authSwitch">${S.authMode === 'signup' ? 'I have an account' : 'Create account'}</button></div><div class="pb"><form id="authForm" onsubmit="return false" autocomplete="on">${S.authMode === 'signup' ? '<div class="field"><label>Your name / business</label><input class="input" name="name" autocomplete="organization"></div>' : ''}<div class="field" style="margin-top:8px"><label>Email (your username)</label><input class="input" name="username" type="email" autocomplete="username" required inputmode="email"></div><div class="field" style="margin-top:8px"><label>Password</label><input class="input" name="password" type="password" autocomplete="${S.authMode === 'signup' ? 'new-password' : 'current-password'}" minlength="8" required></div><div class="split" style="margin-top:12px"><button class="btn primary" data-act="authSubmit">${S.authMode === 'signup' ? 'Create account' : 'Sign in'}</button><span class="small muted">${S.authMode === 'signup' ? 'Free plan, no card. 8+ character password.' : ''}</span></div></form></div></div><div class="panel"><div class="ph"><h3>What an account adds</h3></div><div class="pb help"><ul><li>Cloud sync of this workspace across your laptop, phone and staff devices.</li><li>Server-side AI enhancement with a monthly quota per plan — no key handling.</li><li>Plan upgrades, invoices and support.</li></ul><p class="small muted">Local mode never expires. Your data stays in this browser until you sync.</p></div></div></div>` + backup + `<div style="margin-top:18px"><h2>Plans</h2>${pricing}</div>`;
  return pageHead('Account & plan', esc(u.email), `<button class="btn" data-act="syncNow">Sync now</button><button class="btn" data-act="signOut">Sign out</button>`)
    + `<div class="grid g3"><div class="panel stat"><div class="l">Plan</div><div class="v">${esc(PLANS[plan].name)}</div><div class="small muted">${u.planUntil ? `until ${fmtDate(u.planUntil)}` : plan === 'free' ? 'no expiry' : ''}</div></div><div class="panel stat"><div class="l">AI enhancements this month</div><div class="v">${u.aiUsed || 0} <span class="muted" style="font-size:14px">/ ${PLANS[plan].ai}</span></div></div><div class="panel stat"><div class="l">Last sync</div><div class="v" style="font-size:18px">${cloud.state.lastSync ? new Date(cloud.state.lastSync).toLocaleString('en-IN') : '—'}</div><label class="check small" style="margin-top:6px"><input type="checkbox" data-act="toggleAutoSync" ${S.settings.autoSync ? 'checked' : ''}><span class="switch"></span> Auto-sync after changes</label></div></div>
    <div style="margin-top:18px"><h2>Plans</h2>${pricing}<p class="small muted" style="margin-top:8px">Prices include 18% GST. ${cloud.state.billing ? 'Pay by card, UPI or netbanking through Razorpay; the plan activates the moment payment is captured.' : 'Pay by UPI to <b>indiabusinessinternational@okicici</b> and send the reference on WhatsApp; the plan is switched on within 12 hours.'}</p></div>`
    + backup + `<div class="panel" style="margin-top:14px"><div class="ph"><h3>Security</h3></div><div class="pb split"><button class="btn" data-act="changePassword">Change password</button><button class="btn danger" data-act="deleteAccount">Delete account</button><span class="small muted">Deleting removes your cloud copy; the local copy on this device stays until you reset it in Settings.</span></div></div>`;
}

/* ── Settings ── */
async function vSettings() {
  const b = S.settings.business, hasKey = !!secrets.get('gemini');
  return pageHead('Settings', 'Defaults every new product inherits, appearance, AI and data.')
    + `<form id="settingsForm" onsubmit="return false"><fieldset class="sec"><legend>Business defaults</legend><div class="frow"><div class="field"><label>Brand</label><input class="input" name="brand" value="${esc(b.brand)}"></div><div class="field"><label>Manufacturer / packer name</label><input class="input" name="manufacturerName" value="${esc(b.manufacturerName)}"></div><div class="field" style="grid-column:1/-1"><label>Manufacturer address</label><input class="input" name="manufacturerAddress" value="${esc(b.manufacturerAddress)}"></div><div class="field"><label>Packer name (if different)</label><input class="input" name="packerName" value="${esc(b.packerName)}"></div><div class="field"><label>Packer address</label><input class="input" name="packerAddress" value="${esc(b.packerAddress)}"></div><div class="field"><label>Consumer care contact</label><input class="input" name="consumerCare" value="${esc(b.consumerCare)}"></div><div class="field"><label>Country of origin</label><input class="input" name="countryOfOrigin" value="${esc(b.countryOfOrigin)}"></div><div class="field"><label>Default GST %</label><select class="input" name="gst">${[0, 3, 5, 12, 18, 28].map(g => `<option value="${g}" ${Number(b.gst) === g ? 'selected' : ''}>${g}%</option>`).join('')}</select></div></div><div style="margin-top:10px"><button class="btn primary" data-act="saveSettings">Save defaults</button></div></fieldset>
    <fieldset class="sec"><legend>Appearance</legend><div class="frow"><div class="field"><label>Theme</label><select class="input" data-act="setTheme">${['auto', 'light', 'dark'].map(t => `<option value="${t}" ${S.settings.theme === t ? 'selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}</select></div><div class="field"><label>Text size</label><select class="input" data-act="setTextSize">${[[1, 'Default'], [1.15, 'Large'], [1.3, 'Extra large'], [1.5, 'Huge'], [1.75, 'Maximum']].map(([v, l]) => `<option value="${v}" ${Number(S.settings.textSize) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div></fieldset>
    <fieldset class="sec"><legend>AI enhancement</legend><div class="frow"><div class="field"><label>Engine</label><select class="input" data-act="setAiMode"><option value="server" ${S.settings.ai.mode === 'server' ? 'selected' : ''}>Listings Master service (plan quota)</option><option value="byok" ${S.settings.ai.mode === 'byok' ? 'selected' : ''}>My own Gemini API key (this device only)</option></select><div class="hint">${cloud.state.available ? (cloud.state.ai ? 'Server AI is configured.' : 'Server AI is not configured on this deployment.') : 'Offline: only your own key can work right now.'}</div></div><div class="field"><label>Gemini API key <span class="cnt">${hasKey ? '✓ saved' : 'not set'}</span></label><input class="input" type="password" id="geminiKey" autocomplete="off" placeholder="${hasKey ? 'Saved on this device — paste a new one to replace' : 'AIza…'}"><div class="hint">Stored only in this browser; never synced or backed up. Get one at aistudio.google.com.</div></div></div><div class="split" style="margin-top:8px"><button class="btn" data-act="saveGeminiKey">Save key</button>${hasKey ? '<button class="btn danger" data-act="removeGeminiKey">Remove key</button>' : ''}</div></fieldset>
    <fieldset class="sec"><legend>Behaviour</legend><label class="check"><input type="checkbox" data-act="toggleLiveSuggest" ${S.settings.liveSuggest ? 'checked' : ''}><span class="switch"></span> Fetch live search suggestions automatically when opening the Studio (online only)</label><label class="check" style="margin-top:8px"><input type="checkbox" data-act="toggleAutoSync" ${S.settings.autoSync ? 'checked' : ''}><span class="switch"></span> Auto-sync to the cloud after changes (when signed in)</label></fieldset>
    <fieldset class="sec"><legend>Data</legend><div class="split"><button class="btn" data-act="backupExport">Download backup</button><button class="btn" data-act="backupImport">Restore backup</button><button class="btn danger" data-act="resetLocal">Reset this device</button></div><p class="small muted" style="margin-top:8px">Reset wipes products, listings and settings from this browser only. Cloud copies are untouched.</p></fieldset></form>`;
}

/* ───────── help assistant ───────── */
const HELP = { open: false, msgs: [], busy: false };
const HELP_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9.1 9a3 3 0 1 1 4.2 2.7c-.8.4-1.3 1.2-1.3 2.1v.3"/><circle cx="12" cy="17.5" r=".9" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="9.2"/></svg>';

function helpMount() {
  if (!$('#helpRoot')) { const d = document.createElement('div'); d.id = 'helpRoot'; document.body.appendChild(d); }
  paintHelp();
  /* ?help=1 opens the assistant, ?help=<article id or question> opens it on that answer.
     Support can send a seller a link that explains the thing they asked about. */
  const want = new URLSearchParams(location.search).get('help');
  if (want) {
    HELP.open = true; paintHelp();
    const art = HELP_ARTICLES.find(a => a.id === want);
    const q = art ? art.title : (want === '1' || want === 'true' ? '' : want);
    if (q) helpRun(q);
  }
}
function paintHelp() {
  const root = $('#helpRoot'); if (!root) return;
  if (!HELP.open) {
    root.innerHTML = `<button class="help-fab" data-act="helpOpen" title="Help — how to use Listings Master" aria-label="Open help">${HELP_ICON}</button>`;
    return;
  }
  const body = HELP.msgs.length
    ? HELP.msgs.map(m => m.role === 'you'
      ? `<div class="hmsg you">${esc(m.text)}</div>`
      : `<div class="hmsg bot">${m.src ? `<span class="src">${esc(m.src)}</span>` : ''}${m.typing ? '<span class="typing">Looking that up…</span>' : renderHelpText(m.text, esc)}${(m.actions && m.actions.length) ? `<div class="acts">${m.actions.map(a => `<span class="chip" data-act="${esc(a.act)}" ${a.id ? `data-id="${esc(a.id)}"` : ''} ${a.q ? `data-q="${esc(a.q)}"` : ''}>${esc(a.label)}</span>`).join('')}</div>` : ''}</div>`).join('')
    : `<div class="help-greet">Ask me anything about using Listings Master — how to import your sheet, what Amazon allows in a title, why Meesho is different, what the score means. I answer from the built-in help, so I work offline too.</div>
       <div class="help-sugg">${startersFor(S.route.name).map(s => `<button data-act="helpStarter" data-q="${esc(s.q)}">${esc(s.q)}</button>`).join('')}</div>`;
  root.innerHTML = `<div class="help-panel" role="dialog" aria-label="Help assistant">
    <div class="hh"><div style="flex:1;min-width:0"><b>Help</b><div class="sub">Listings Master · answers from the built-in guide</div></div>${HELP.msgs.length ? '<button class="iconbtn" data-act="helpClear" title="Start again" aria-label="Start again">⟲</button>' : ''}<button class="iconbtn" data-act="helpClose" title="Close" aria-label="Close help">✕</button></div>
    <div class="hb" id="helpBody">${body}</div>
    <div class="hf"><textarea id="helpInput" rows="1" placeholder="Ask a question…" aria-label="Ask a question"></textarea><button class="btn primary" data-act="helpSend" ${HELP.busy ? 'disabled' : ''}>Ask</button></div>
  </div>`;
  const b = $('#helpBody'); if (b) b.scrollTop = b.scrollHeight;
  const i = $('#helpInput'); if (i && !HELP.busy && window.innerWidth > 820) i.focus();
}
async function helpRun(q) {
  q = clean0(q); if (!q) return;
  HELP.msgs.push({ role: 'you', text: q });
  const kb = answerFromKb(q, { route: S.route.name });
  const actions = [];
  if (kb.route) actions.push({ act: 'helpGo', id: kb.route, label: 'Open that screen →' });
  (kb.related || []).slice(0, 3).forEach(r => actions.push({ act: 'helpStarter', q: r, label: r }));
  if (kb.kind === 'nomatch') actions.push({ act: 'helpWhatsApp', label: '💬 Ask a human on WhatsApp' });
  const msg = { role: 'bot', text: kb.text, src: kb.title || '', actions };
  HELP.msgs.push(msg);
  paintHelp();
  // AI rephrase only when an engine is available and the match was not exact
  if (kb.kind !== 'nomatch' && kb.articles.length && (cloud.state.ai || secrets.get('gemini'))) {
    HELP.busy = true; const think = { role: 'bot', text: '', typing: true }; HELP.msgs.push(think); paintHelp();
    try {
      const { buildHelpPrompt } = await import('./help.js');
      const r = await helpAnswer(buildHelpPrompt(q, kb.articles, { route: S.route.name }));
      HELP.msgs.splice(HELP.msgs.indexOf(think), 1);
      if (r && r.text && r.text.length > 20) { msg.text = r.text; msg.src = kb.title ? `${kb.title} · answered by AI` : 'Answered by AI'; }
    } catch { HELP.msgs.splice(HELP.msgs.indexOf(think), 1); /* the knowledge-base answer already stands */ }
    finally { HELP.busy = false; paintHelp(); }
  }
}
const clean0 = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

async function vHelp(r) {
  const art = r.id ? HELP_ARTICLES.find(a => a.id === r.id) : null;
  const q = S.helpQ || '';
  const list = q ? searchHelp(q, 12).map(h => h.article) : HELP_ARTICLES;
  return pageHead('Help', 'Ask the assistant, or read the guide. Both answer from the same built-in help, so they work offline.', `<button class="btn primary" data-act="helpOpen">💬 Ask the assistant</button><a class="btn" href="https://wa.me/918939414799?text=Hi%2C%20I%20need%20help%20with%20IBI%20Product%20Listings%20Master" target="_blank" rel="noopener">Talk to a human</a>`)
    + `<div class="split" style="margin-bottom:14px"><input class="input" id="helpSearch" style="max-width:420px" placeholder="Search the guide — “import sheet”, “Amazon title”, “score”…" value="${esc(q)}" autocomplete="off"><span class="muted small">${list.length} topic${list.length === 1 ? '' : 's'}</span></div>`
    + (art ? `<div class="panel" style="margin-bottom:14px"><div class="ph"><h3>${esc(art.title)}</h3><div class="split"><button class="btn sm" data-act="helpAskArticle" data-q="${esc(art.title)}">Ask about this</button>${art.route ? `<a class="btn sm primary" href="${esc(art.route)}">Open that screen →</a>` : ''}</div></div><div class="pb help-answer">${renderHelpText(art.body, esc)}</div></div>` : '')
    + `<div class="help-topics">${list.map(a => `<button data-act="helpTopic" data-id="${esc(a.id)}"><b>${esc(a.title)}</b><span>${esc(a.body.replace(/\*\*/g, '').split('\n')[0].slice(0, 110))}…</span></button>`).join('') || '<div class="muted">Nothing matches that. Try fewer words, or ask the assistant.</div>'}</div>`
    + `<div class="grid g2" style="margin-top:16px"><div class="panel"><div class="ph"><h3>Channel notes</h3></div><div class="pb help"><ul>${allChannels().map(ch => `<li><b>${esc(ch.name)}</b> <span class="faint small">policy ${fmtDate(ch.policyDate)}</span><br><span class="muted small">${esc(ch.summary)}</span></li>`).join('')}</ul></div></div>
    <div class="panel"><div class="ph"><h3>Support &amp; legal</h3></div><div class="pb help"><p>WhatsApp <a href="https://wa.me/918939414799?text=Hi%2C%20I%20need%20help%20with%20IBI%20Product%20Listings%20Master" target="_blank" rel="noopener">+91 89394 14799</a> · <a href="mailto:indiabusinessinternational@gmail.com">indiabusinessinternational@gmail.com</a>, Monday to Saturday, Indian business hours.</p><p><a href="../terms.html" target="_blank">Terms of service</a> · <a href="../privacy.html" target="_blank">Privacy policy</a> · <a href="../refunds.html" target="_blank">Refunds &amp; cancellation</a></p><p class="small muted">Help guide v${HELP_VERSION} · ${HELP_ARTICLES.length} topics · App v${APP_VERSION}</p></div></div></div>`;
}

/* ───────── actions (every data-act resolves here) ───────── */
const A = {
  newProduct() { go('products/new'); },
  openProduct(e, el) { go('products/' + el.dataset.id); },
  async loadSample() { const p = Object.assign(E.blankProduct(), structuredClone(E.SAMPLE_PRODUCT), { id: uid() }); await saveProduct(p); toast('Sample product added', 'ok'); go('studio/' + p.id); },
  cancelEdit() { history.length > 1 ? history.back() : go('products'); },
  async saveProduct() { const p = readProductForm(); if (!p) return; if (!p.productType) { toast('Product type is required', 'err'); $('[name=productType]').focus(); return; } await saveProduct(p); toast('Saved', 'ok'); go('products'); },
  async saveAndStudio() { const p = readProductForm(); if (!p) return; if (!p.productType) { toast('Product type is required', 'err'); $('[name=productType]').focus(); return; } await saveProduct(p); go('studio/' + p.id); },
  async duplicateProduct() { const p = readProductForm(); const c = structuredClone(p); c.id = uid(); c.sku = (c.sku || 'SKU') + '-COPY'; c.createdAt = ''; await saveProduct(c); toast('Duplicated', 'ok'); go('products/' + c.id); },
  async deleteProduct() { if (!await confirmDlg('Delete product', 'This removes the product and all its channel listings from this workspace.', 'Delete', 'danger')) return; await deleteProduct(S.draft.id); toast('Deleted'); go('products'); },
  applyBusinessDefaults() { const d = defaultsFromBusiness(); const f = $('#productForm'); for (const [k, v] of Object.entries(d)) if (f.elements[k] && !f.elements[k].value) f.elements[k].value = v; toast('Defaults filled where empty', 'ok'); },
  imgAdd() { const i = $('#imgUrl'); const u = i.value.trim(); if (!/^https?:\/\//.test(u)) { toast('Paste a full http(s) image URL', 'err'); return; } S.draft.images.push({ url: u, alt: '' }); i.value = ''; paintImages(); },
  imgUpload() { pickFile('image/*', async file => { if (file.size > 2.5e6) { toast('Keep preview uploads under 2.5 MB', 'err'); return; } const data = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file); }); S.draft.images.push({ data, alt: file.name, local: true }); paintImages(); toast('Added for preview — exports need a public URL', 'warn'); }); },
  imgRemove(e, el) { S.draft.images.splice(+el.dataset.idx, 1); S.imgSel = null; paintImages(); },
  imgLeft() { const i = S.imgSel ?? S.draft.images.length - 1; if (i <= 0) { toast('Already first'); return; } [S.draft.images[i - 1], S.draft.images[i]] = [S.draft.images[i], S.draft.images[i - 1]]; S.imgSel = i - 1; paintImages(); },
  imgRight() { const i = S.imgSel ?? 0; if (i >= S.draft.images.length - 1) { toast('Already last'); return; } [S.draft.images[i + 1], S.draft.images[i]] = [S.draft.images[i], S.draft.images[i + 1]]; S.imgSel = i + 1; paintImages(); },
  varAdd() { const r = $('#varRows'); r.insertAdjacentHTML('beforeend', varRow({}, r.children.length)); $$('.varrow', r).forEach((x, i) => { x.dataset.var = i; $('[data-act=varRemove]', x).dataset.idx = i; }); },
  varRemove(e, el) { el.closest('.varrow').remove(); },
  async liveSuggest(e, el) {
    const p = S.draft && $('#productForm') ? readProductForm() : productById(S.studio ? S.studio.pid : null); if (!p) return;
    if (!cloud.state.available || !cloud.state.suggest) { toast('Live suggestions need the online service. Synonyms and your keywords still apply.', 'warn'); return; }
    await withBusy(el, async () => { const seed = p.productType; const r = await cloud.suggest(seed); const terms = (r.suggestions || []).map(s => s.term || s); S.suggest[p.id] = terms; const list = $('#suggestList'); if (list) list.innerHTML = terms.map(t => `<span class="kw live" data-act="addKeyword" data-id="${p.id}" data-term="${esc(t)}" style="cursor:pointer">${esc(t)} +</span>`).join('') || '<span class="muted small">No suggestions came back for that seed.</span>'; paintPool(); toast(`${terms.length} live suggestions ranked into the pool`, 'ok'); });
  },
  async fetchSuggest(e, el) { const seed = $('#seedInput').value.trim(); if (!seed) return; if (!cloud.state.available || !cloud.state.suggest) { toast('Live suggestions need the online service', 'warn'); return; } await withBusy(el, async () => { const r = await cloud.suggest(seed); S.suggest[el.dataset.id] = (r.suggestions || []).map(s => s.term || s); render(); }); },
  async addKeyword(e, el) { const p = productById(el.dataset.id) || (S.draft && S.draft.id === el.dataset.id ? S.draft : null); if (!p) return; const t = el.dataset.term; if (!p.keywords.includes(t)) p.keywords.push(t); if ($('#productForm')) { $('[name=keywords]').value = p.keywords.join(', '); toast(`Added “${t}”`, 'ok'); } else { await saveProduct(p); toast(`Added “${t}” to seller keywords`, 'ok'); if (S.route.name === 'keywords') render(); } },
  toggleSel(e, el) { const id = el.dataset.id; const i = S.studio.sel.indexOf(id); if (i >= 0) S.studio.sel.splice(i, 1); else S.studio.sel.push(id); render(); },
  selAllCh() { S.studio.sel = S.studio.sel.length === enabledChannels().length ? [] : enabledChannels().map(c => c.id); render(); },
  async generateAll(e, el) { if (!S.studio.sel.length) { toast('Select at least one channel', 'warn'); return; } await withBusy(el, async () => { for (const chid of S.studio.sel) await generateFor(S.studio.pid, chid); render(); toast(`Generated ${S.studio.sel.length} listing${S.studio.sel.length > 1 ? 's' : ''}`, 'ok'); }); },
  async generateOne(e, el) { await withBusy(el, async () => { await generateFor(S.studio.pid, el.dataset.ch); refreshCard(el.dataset.ch); toast('Regenerated (locked fields kept)', 'ok'); }); },
  async aiOne(e, el) { await aiRun([el.dataset.ch], el); },
  async aiAll(e, el) { if (!S.studio.sel.length) { toast('Select at least one channel', 'warn'); return; } await aiRun(S.studio.sel, el); },
  async lockToggle(e, el) { const rec = listingRec(S.studio.pid, el.dataset.ch); if (!rec) return; rec.locked = rec.locked || {}; rec.locked[el.dataset.field] = !rec.locked[el.dataset.field]; await saveListing(rec); el.textContent = rec.locked[el.dataset.field] ? '🔒' : '🔓'; toast(rec.locked[el.dataset.field] ? 'Locked: Generate will keep this field' : 'Unlocked'); },
  async copyField(e, el) { const rec = listingRec(S.studio.pid, el.dataset.ch); const v = rec.current[el.dataset.field]; const ok = await X.copyText(Array.isArray(v) ? v.join('\n') : v); toast(ok ? 'Copied' : 'Copy blocked by the browser', ok ? 'ok' : 'err'); },
  async bulletAdd(e, el) { const rec = listingRec(S.studio.pid, el.dataset.ch); rec.current.bullets.push(''); await saveListing(rec); refreshCard(el.dataset.ch); },
  async versionPick(e, el) { const rec = listingRec(S.studio.pid, el.dataset.ch); const v = rec.versions.find(x => x.v === +el.value); if (!v) return; rec.current = { ...v.fields, bullets: [...v.fields.bullets] }; await saveListing(rec); refreshCard(el.dataset.ch); toast(`Showing v${v.v}`); },
  async exportOne(e, el) { await exportChannels([el.dataset.ch], [S.studio.pid], el); },
  async exportSelected(e, el) { if (!S.studio.sel.length) { toast('Select channels first', 'warn'); return; } await exportChannels(S.studio.sel, [S.studio.pid], el); },
  async copyAll() { const p = productById(S.studio.pid); const parts = []; for (const chid of S.studio.sel) { const rec = listingRec(p.id, chid); if (!rec || !rec.current) continue; const ch = registry()[chid]; parts.push(`=== ${ch.name} ===\n` + Object.entries(ch.fields).map(([k, f]) => `${f.label}:\n${Array.isArray(rec.current[k]) ? rec.current[k].map((b, i) => `${i + 1}. ${b}`).join('\n') : rec.current[k]}`).join('\n\n')); } if (!parts.length) { toast('Nothing generated yet', 'warn'); return; } const ok = await X.copyText(parts.join('\n\n\n')); toast(ok ? 'All listings copied as text' : 'Copy blocked', ok ? 'ok' : 'err'); },
  printAll() { window.print(); },
  pickKwProduct(e, el) { go('keywords/' + el.value); },
  pickPerfProduct(e, el) { go('performance/' + el.value); },
  async perfAdd(e, el) { const f = $('#perfForm'); if (!f.reportValidity()) return; const r = { id: uid(), productId: el.dataset.id, channel: f.elements.channel.value, title: f.elements.title.value.trim(), impressions: +f.elements.impressions.value, clicks: +f.elements.clicks.value, orders: +f.elements.orders.value || 0, date: f.elements.date.value }; if (r.clicks > r.impressions) { toast('Clicks cannot exceed impressions', 'err'); return; } await savePerf(r); toast('Row added', 'ok'); render(); },
  perfUseCurrent(e, el) { const f = $('#perfForm'); const rec = listingRec(el.dataset.id, f.elements.channel.value); if (!rec || !rec.current) { toast('No generated title for that channel yet', 'warn'); return; } f.elements.title.value = rec.current.title; },
  async perfDelete(e, el) { await db.put('perf', { id: el.dataset.id, deleted: true, updatedAt: now() }); S.perf = S.perf.filter(r => r.id !== el.dataset.id); queueSync(); render(); },
  async reoptimise(e, el) { const pid = el.dataset.id; await withBusy(el, async () => { let n = 0; for (const ch of enabledChannels()) { const rec = listingRec(pid, ch.id); if (!rec || !rec.current) continue; const before = rec.current.title; const fresh = E.generateListing(productById(pid), ch, genOpts(pid)); if (fresh.title !== before && !(rec.locked && rec.locked.title)) { rec.current.title = fresh.title; rec.versions.push({ v: rec.versions.length + 1, at: now(), source: 'performance', fields: { ...rec.current } }); await saveListing(rec); n++; } } toast(n ? `${n} title${n > 1 ? 's' : ''} re-optimised — see the Studio` : 'Titles already reflect the data (or are locked)', n ? 'ok' : 'warn'); }); },
  importPerf() { pickFile('.csv,.xlsx,.xls', async file => { const rows = await X.parseSheetFile(file); const pid = S.route.id || (S.products[0] && S.products[0].id); let n = 0; for (const r of rows) { const g = re => { const k = Object.keys(r).find(h => re.test(h)); return k ? r[k] : ''; }; const imp = +g(/impression|session|views/i), clk = +g(/click|page view|visit/i); if (!imp) continue; await savePerf({ id: uid(), productId: pid, channel: (enabledChannels()[0] || {}).id, title: String(g(/title|name/i) || ''), impressions: imp, clicks: clk || 0, orders: +g(/order|unit/i) || 0, date: String(g(/date|period/i) || new Date().toISOString().slice(0, 10)) }); n++; } toast(`${n} rows imported`, n ? 'ok' : 'warn'); render(); }); },
  async toggleChannel(e, el) { const id = el.dataset.id; const on = el.checked; const list = S.settings.enabledChannels; if (on && !list.includes(id)) list.push(id); if (!on) S.settings.enabledChannels = list.filter(x => x !== id); await saveSettings(S.settings); toast(on ? 'Channel enabled' : 'Channel disabled'); },
  newChannel() { const lim = PLANS[planOf()].custom; if (S.custom.length >= lim) { toast(`Your ${PLANS[planOf()].name} plan allows ${lim} custom channel${lim === 1 ? '' : 's'}. Upgrade in Account.`, 'warn'); return; } go('channels/edit/'); },
  async cloneChannel(e, el) { const lim = PLANS[planOf()].custom; if (S.custom.length >= lim) { toast(`Your plan allows ${lim} custom channel${lim === 1 ? '' : 's'}. Upgrade in Account.`, 'warn'); return; } const src = registry()[el.dataset.id]; const c = structuredClone(src); c.id = src.id + '_custom_' + uid().slice(0, 4); c.name = src.name + ' (custom)'; c.status = 'custom'; c.group = 'Custom'; c.export = exportSpec(src, registry()); await saveCustom(c); toast('Duplicated — edit it now', 'ok'); go('channels/edit/' + c.id); },
  async saveChannel() { let c; try { c = readChannelForm(); } catch (err) { toast(err.message, 'err'); return; } try { E.generateListing(E.SAMPLE_PRODUCT, c); } catch (err) { toast('The definition cannot generate: ' + err.message, 'err'); return; } await saveCustom(c); if (!S.settings.enabledChannels.includes(c.id)) { S.settings.enabledChannels.push(c.id); await saveSettings(S.settings); } toast('Channel saved and enabled', 'ok'); go('channels'); },
  async deleteChannel(e, el) { if (!await confirmDlg('Delete channel', 'Listings generated for it stay in the workspace but will no longer render.', 'Delete', 'danger')) return; await db.put('channels', { id: el.dataset.id, deleted: true, updatedAt: now() }); S.custom = S.custom.filter(c => c.id !== el.dataset.id); S.settings.enabledChannels = S.settings.enabledChannels.filter(x => x !== el.dataset.id); await saveSettings(S.settings); queueSync(); render(); },
  expToggleCh(e, el) { const i = S.exp.ch.indexOf(el.dataset.id); if (i >= 0) S.exp.ch.splice(i, 1); else S.exp.ch.push(el.dataset.id); render(); },
  expToggleP(e, el) { const i = S.exp.pids.indexOf(el.dataset.id); if (i >= 0) S.exp.pids.splice(i, 1); else S.exp.pids.push(el.dataset.id); },
  expAllCh() { S.exp.ch = S.exp.ch.length === enabledChannels().length ? [] : enabledChannels().map(c => c.id); render(); },
  expAllP() { S.exp.pids = S.exp.pids.length === S.products.length ? [] : S.products.map(p => p.id); render(); },
  async exportRun(e, el) { if (!S.exp.ch.length || !S.exp.pids.length) { toast('Pick at least one channel and one product', 'warn'); return; } await exportChannels(S.exp.ch, S.exp.pids, el); },
  async exportPack() { const pack = { app: 'IBI Product Listings Master', version: APP_VERSION, exportedAt: now(), products: S.exp.pids.map(pid => ({ product: productById(pid), listings: Object.fromEntries(S.exp.ch.map(chid => [chid, (listingRec(pid, chid) || {}).current || null])) })) }; X.downloadJson(`listing-pack-${new Date().toISOString().slice(0, 10)}.json`, pack); toast('Listing pack downloaded', 'ok'); },
  async exportProducts() { const rows = S.products.map(p => [p.sku, p.brand, p.productType, p.category, p.subcategory, p.material, p.colour, p.size, (p.keyFeatures || []).join(' | '), (p.useCases || []).join(', '), (p.keywords || []).join(', '), p.mrp, p.sellingPrice, p.gst, p.hsn, p.stock, p.weightG, p.lengthCm, p.breadthCm, p.heightCm, p.netQuantity, p.countryOfOrigin, p.manufacturerName, p.manufacturerAddress, ...(p.images || []).slice(0, 5).map(i => i.url || '')]); const head = ['SKU', 'Brand', 'Product Type', 'Category', 'Sub-category', 'Material', 'Colour', 'Size', 'Key Features', 'Use Cases', 'Keywords', 'MRP', 'Selling Price', 'GST %', 'HSN', 'Stock', 'Weight (g)', 'Length (cm)', 'Breadth (cm)', 'Height (cm)', 'Net Quantity', 'Country of Origin', 'Manufacturer', 'Manufacturer Address', 'Image 1', 'Image 2', 'Image 3', 'Image 4', 'Image 5']; try { await X.downloadXlsx(`catalogue-${new Date().toISOString().slice(0, 10)}.xlsx`, [{ name: 'Catalogue', headerRow: head, rows }]); } catch (err) { X.downloadCsv('catalogue.csv', E.toCsv(head, rows)); toast(err.message, 'warn'); } },
  importSheet() { pickFile('.xlsx,.xls,.csv', async file => { try { const rows = await X.parseSheetFile(file); if (!rows.length) { toast('No rows found', 'warn'); return; } const d = defaultsFromBusiness(); let n = 0; const byTitle = {}; for (const r of rows) { const q = X.rowToProduct(r); if (!q.productType) continue; const key = q.productType.toLowerCase(); if (byTitle[key]) { byTitle[key].variants.push({ sku: q.sku, colour: q.colour, size: q.size, sellingPrice: q.sellingPrice, mrp: q.mrp, stock: q.stock }); q.images.forEach(i => { if (!byTitle[key].images.some(x => x.url === i.url)) byTitle[key].images.push(i); }); continue; } const p = Object.assign(E.blankProduct(), d, q, { id: uid(), variants: [] }); byTitle[key] = p; n++; } for (const p of Object.values(byTitle)) { if (p.variants.length) p.variants.unshift({ sku: p.sku, colour: p.colour, size: p.size, stock: p.stock }); await saveProduct(p); } toast(`${n} product${n === 1 ? '' : 's'} imported from ${file.name}`, 'ok'); go('products'); render(); } catch (err) { toast('Import failed: ' + err.message, 'err'); } }); },
  async deleteSelected() { const ids = $$('.selrow:checked').map(x => x.value); if (!ids.length) { toast('Tick the products to delete first', 'warn'); return; } if (!await confirmDlg('Delete products', `Delete ${ids.length} product${ids.length > 1 ? 's' : ''} and their listings?`, 'Delete', 'danger')) return; for (const id of ids) await deleteProduct(id); toast('Deleted'); render(); },
  authSwitch() { S.authMode = S.authMode === 'signup' ? 'login' : 'signup'; render(); },
  async authSubmit(e, el) { const f = $('#authForm'); if (!f.reportValidity()) return; const email = f.elements.username.value.trim().toLowerCase(), pw = f.elements.password.value; await withBusy(el, async () => { try { if (S.authMode === 'signup') await cloud.signup(email, pw, (f.elements.name || {}).value || ''); else await cloud.login(email, pw); await cloud.me(); toast(S.authMode === 'signup' ? 'Account created' : 'Signed in', 'ok'); try { await syncWorkspace(); } catch (err) { toast('Signed in, but the first sync failed: ' + err.message, 'warn'); } render(); } catch (err) { toast(err.message, 'err'); } }); },
  async signOut() { try { await cloud.logout(); } catch { /* ignore */ } cloud.state.user = null; toast('Signed out'); render(); },
  async syncNow(e, el) { await withBusy(el, async () => { try { await syncWorkspace(); await loadAll(); toast('Synced', 'ok'); render(); } catch (err) { toast('Sync failed: ' + err.message, 'err'); paintSync(err.message); } }); },
  async toggleAutoSync(e, el) { S.settings.autoSync = el.checked; await saveSettings(S.settings); },
  async choosePlan(e, el) { const k = el.dataset.id, pl = PLANS[k]; if (!cloud.state.user) { toast('Sign in first, then choose a plan', 'warn'); $('#authForm') && $('#authForm').elements.username.focus(); return; } if (cloud.state.billing) { await razorpayFlow(k, el); return; } const ref = `PLM-${k.toUpperCase()}-${(cloud.state.user.email || '').split('@')[0]}`; await modal({ title: `${pl.name} — ₹${pl.price.toLocaleString('en-IN')} / month`, body: `<p>Pay <b>₹${pl.price.toLocaleString('en-IN')}</b> by UPI to <b class="mono">indiabusinessinternational@okicici</b> (India Business International) with the note <b class="mono">${esc(ref)}</b>, then send the UPI reference on WhatsApp. The plan is switched on within 12 hours, usually much sooner.</p><p class="small muted">Card / netbanking checkout arrives when Razorpay is enabled on this deployment.</p>`, buttons: [{ label: 'Close', act: 'close' }, { label: 'Open WhatsApp', act: 'wa', cls: 'primary' }] }).then(r => { if (r && r.act === 'wa') window.open(`https://wa.me/918939414799?text=${encodeURIComponent(`Hi, I paid ₹${pl.price} for the Listings Master ${pl.name} plan. Ref ${ref}. Account: ${cloud.state.user.email}. UPI ref: `)}`, '_blank', 'noopener'); }); },
  async changePassword() { const r = await modal({ title: 'Change password', body: `<form id="pwForm" onsubmit="return false"><input type="text" name="username" autocomplete="username" value="${esc(cloud.state.user.email)}" hidden><div class="field"><label>Current password</label><input class="input" name="old" type="password" autocomplete="current-password" required></div><div class="field" style="margin-top:8px"><label>New password (8+)</label><input class="input" name="nw" type="password" autocomplete="new-password" minlength="8" required></div></form>`, buttons: [{ label: 'Cancel', act: 'cancel' }, { label: 'Change', act: 'ok', cls: 'primary' }], onMount: root => { root.querySelector('[data-mact=ok]').addEventListener('click', () => { const f = root.querySelector('#pwForm'); S.pwVals = { old: f.elements.old.value, nw: f.elements.nw.value }; }, true); } }); if (!r) return; try { await cloud.changePassword(S.pwVals.old, S.pwVals.nw); toast('Password changed', 'ok'); } catch (err) { toast(err.message, 'err'); } },
  async deleteAccount() { const r = await modal({ title: 'Delete account', body: `<p>This deletes your cloud account and its synced copy. Type your password to confirm.</p><form id="delForm" onsubmit="return false"><input class="input" name="pw" type="password" autocomplete="current-password" required></form>`, buttons: [{ label: 'Cancel', act: 'cancel' }, { label: 'Delete my account', act: 'ok', cls: 'danger' }], onMount: root => root.querySelector('[data-mact=ok]').addEventListener('click', () => { S.pwVals = { old: root.querySelector('#delForm').elements.pw.value }; }, true) }); if (!r) return; try { await cloud.deleteAccount(S.pwVals.old); cloud.state.user = null; toast('Account deleted'); render(); } catch (err) { toast(err.message, 'err'); } },
  async backupExport() { const b = await exportBackup(); X.downloadJson(`listings-master-backup-${new Date().toISOString().slice(0, 10)}.json`, b); toast('Backup downloaded', 'ok'); },
  backupImport() { pickFile('.json', async file => { try { const obj = JSON.parse(await file.text()); const r = await importBackup(obj, { merge: true }); await loadAll(); toast(`Restored ${r.products} products (merged)`, 'ok'); render(); } catch (err) { toast(err.message, 'err'); } }); },
  async saveSettings() { const f = $('#settingsForm'); for (const k of ['brand', 'manufacturerName', 'manufacturerAddress', 'packerName', 'packerAddress', 'consumerCare', 'countryOfOrigin']) S.settings.business[k] = f.elements[k].value.trim(); S.settings.business.gst = +f.elements.gst.value; S.settings.onboarded = true; await saveSettings(S.settings); toast('Defaults saved', 'ok'); },
  async setTheme(e, el) { S.settings.theme = el.value; await saveSettings(S.settings); applyTheme(); },
  async setTextSize(e, el) { S.settings.textSize = +el.value; await saveSettings(S.settings); applyTheme(); },
  async setAiMode(e, el) { S.settings.ai.mode = el.value; await saveSettings(S.settings); toast(el.value === 'byok' ? 'Using your own Gemini key' : 'Using the service AI'); },
  saveGeminiKey() { const v = $('#geminiKey').value.trim(); if (!v) { toast('Paste a key first', 'warn'); return; } secrets.set('gemini', v); $('#geminiKey').value = ''; S.settings.ai.geminiKeySaved = true; saveSettings(S.settings); toast('Key saved on this device', 'ok'); render(); },
  removeGeminiKey() { secrets.set('gemini', ''); S.settings.ai.geminiKeySaved = false; saveSettings(S.settings); toast('Key removed'); render(); },
  async toggleLiveSuggest(e, el) { S.settings.liveSuggest = el.checked; await saveSettings(S.settings); },
  async resetLocal() { if (!await confirmDlg('Reset this device', 'Wipes every product, listing, performance row, custom channel and setting from this browser.', 'Reset', 'danger')) return; for (const s of ['products', 'listings', 'perf', 'channels', 'settings', 'kwcache']) await db.clear(s); try { localStorage.removeItem('plm:lastSync'); } catch { /* ignore */ } await loadAll(); toast('Reset done'); go('dashboard'); render(); },
  toggleTheme() { const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; S.settings.theme = cur === 'dark' ? 'light' : 'dark'; saveSettings(S.settings); applyTheme(); },
  goSync() { go('account'); },
  goAccount() { go('account'); },
  helpOpen() { HELP.open = true; paintHelp(); },
  helpClose() { HELP.open = false; paintHelp(); },
  helpClear() { HELP.msgs = []; paintHelp(); },
  async helpSend() { const i = $('#helpInput'); if (!i) return; const q = i.value; i.value = ''; if (!clean0(q)) { toast('Type a question first'); return; } await helpRun(q); },
  async helpStarter(e, el) { await helpRun(el.dataset.q); },
  async helpAskArticle(e, el) { HELP.open = true; paintHelp(); await helpRun(el.dataset.q); },
  helpGo(e, el) { HELP.open = false; paintHelp(); location.hash = el.dataset.id; },
  helpTopic(e, el) { go('help/' + el.dataset.id); },
  helpWhatsApp() { window.open('https://wa.me/918939414799?text=' + encodeURIComponent('Hi, I need help with IBI Product Listings Master: '), '_blank', 'noopener'); },
  async about() { await modal({ title: 'About IBI Product Listings Master', body: `<dl class="kv"><dt>App</dt><dd>v${APP_VERSION}</dd><dt>Backend</dt><dd>${cloud.state.available ? `v${cloud.state.version}${cloud.state.version === APP_VERSION ? ' ✓ in step' : ' — differs from the app'}` : 'offline / local mode'}</dd><dt>Engine</dt><dd>v${E.ENGINE_VERSION}</dd><dt>Channels</dt><dd>${CHANNELS.length} built-in + ${S.custom.length} custom</dd><dt>Features</dt><dd>${cloud.state.available ? esc((cloud.state.features || []).join(', ') || '—') : '—'}</dd></dl><p class="small muted" style="margin-top:10px">India Business International · <a href="../" target="_blank">listingsmaster.indiabusinessinternational.online</a></p>` }); },
};

/* ───────── helpers used by actions ───────── */
async function withBusy(el, fn) { if (el && el.classList) { if (el.classList.contains('busy')) return; el.classList.add('busy'); el.disabled = true; } try { await fn(); } catch (err) { console.error(err); toast(err.message || String(err), 'err'); } finally { if (el && el.classList) { el.classList.remove('busy'); el.disabled = false; } } }
function pickFile(accept, cb) { const i = $('#fileInput'); i.accept = accept; i.value = ''; i.onchange = () => { const f = i.files[0]; if (f) cb(f); }; i.click(); }
async function aiRun(chids, el) {
  const p = productById(S.studio.pid);
  await withBusy(el, async () => {
    let done = 0;
    for (const chid of chids) {
      const ch = registry()[chid]; let rec = listingRec(p.id, chid); if (!rec || !rec.current) rec = await generateFor(p.id, chid);
      const card = $(`#card-${chid}`); if (card) card.style.opacity = '.6';
      try {
        const r = await enhance({ product: E.normalizeProduct(p), channel: ch, current: rec.current, suggestions: S.suggest[p.id] || [], mode: S.settings.ai.mode });
        const draft = E.enforceLimits(ch, { ...rec.current, ...r.draft }, p);
        for (const k of Object.keys(rec.locked || {})) if (rec.locked[k]) draft[k] = rec.current[k];
        rec.current = pickFields(draft); rec.versions.push({ v: rec.versions.length + 1, at: now(), source: 'ai', fields: { ...rec.current } }); await saveListing(rec); refreshCard(chid); done++;
        if (r.usage && cloud.state.user) { cloud.state.user.aiUsed = r.usage.used; paintNav(); }
      } catch (err) { toast(`${ch.short}: ${err.message}`, 'err'); if (/quota|limit|plan/i.test(err.message)) break; }
      finally { if (card) card.style.opacity = ''; }
    }
    if (done) toast(`AI enhanced ${done} listing${done > 1 ? 's' : ''} — every field re-checked by the rule engine`, 'ok');
  });
}
async function exportChannels(chids, pids, el) {
  await withBusy(el, async () => {
    const reg = registry();
    for (const chid of chids) {
      const ch = reg[chid]; const spec = exportSpec(ch, reg); const rows = [];
      for (const pid of pids) { const p = productById(pid); if (!p) continue; let rec = listingRec(pid, chid); if (!rec || !rec.current) rec = await generateFor(pid, chid); const X2 = E.buildExportRows(ch, { ...p, images: (p.images || []).filter(i => i.url) }, { ...rec.current, channel: chid }, reg); rows.push(...X2.rows); }
      const stamp = new Date().toISOString().slice(0, 10); const base = `${X.safeName(ch.short)}-listings-${stamp}`;
      if (spec.format === 'csv') { X.downloadCsv(base + '.csv', E.toCsv(spec.headerRow, rows)); continue; }
      try { await X.downloadXlsx(base + '.xlsx', [{ name: spec.sheet || 'Sheet1', headerRow: spec.headerRow, rows, note: [[`${ch.name} — generated by IBI Product Listings Master v${APP_VERSION} on ${stamp}`], [ch.summary], ['One row per variant. Paste into the marketplace template; columns your category template does not have are ignored.'], ['Image columns must be public URLs. Local preview uploads are left blank.']] }]); }
      catch (err) { X.downloadCsv(base + '.csv', E.toCsv(spec.headerRow, rows)); toast(err.message + ' Exported CSV instead.', 'warn'); }
      await new Promise(r => setTimeout(r, 400));
    }
    toast(`${chids.length} sheet${chids.length > 1 ? 's' : ''} downloaded`, 'ok');
  });
}
async function razorpayFlow(planKey, el) {
  await withBusy(el, async () => {
    const o = await cloud.order(planKey);
    await new Promise((res, rej) => { if (window.Razorpay) return res(); const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.onload = res; s.onerror = () => rej(new Error('Could not load the payment page')); document.head.appendChild(s); });
    await new Promise(res => { const rz = new window.Razorpay({ key: o.keyId, amount: o.amount, currency: 'INR', name: 'IBI Product Listings Master', description: `${PLANS[planKey].name} plan — 1 month`, order_id: o.orderId, prefill: { email: cloud.state.user.email }, notes: { plan: planKey }, theme: { color: '#6d28d9' }, handler: () => res(true), modal: { ondismiss: () => res(false) } }); rz.open(); });
    let tries = 0; while (tries++ < 10) { await new Promise(r => setTimeout(r, 2000)); const st = await cloud.orderStatus(o.orderId).catch(() => null); if (st && st.status === 'paid') { await cloud.me(); toast(`${PLANS[planKey].name} plan is active`, 'ok'); render(); return; } }
    toast('Payment not confirmed yet — if you paid, the plan activates automatically within minutes', 'warn');
  });
}
function applyTheme() {
  const t = S.settings.theme, dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light'); document.documentElement.style.setProperty('--ts', S.settings.textSize || 1);
  const m = $('meta[name=theme-color]'); if (m) m.content = dark ? '#171a24' : '#6d28d9';
  try { localStorage.setItem('plm:theme', t === 'auto' ? '' : t); localStorage.setItem('plm:ts', S.settings.textSize || 1); } catch { /* ignore */ }
}

/* ───────── wiring ───────── */
document.addEventListener('click', e => {
  const stop = e.target.closest('[data-stop]'); const el = e.target.closest('[data-act]'); if (!el) return;
  if (el.matches('input[type=checkbox], select')) return; // handled on change
  if (stop && stop !== el && !el.contains(stop)) { /* click inside a data-stop cell but not on the act element */ }
  if (el.tagName === 'A' && el.getAttribute('href') === '#') e.preventDefault();
  if (el.classList.contains('rowlink') && e.target.closest('[data-stop]')) return;
  const fn = A[el.dataset.act]; if (!fn) { console.error('No action', el.dataset.act); toast('This control is not wired: ' + el.dataset.act, 'err'); return; }
  fn.call(A, e, el);
});
document.addEventListener('change', e => { const el = e.target.closest('[data-act]'); if (!el || !el.matches('input[type=checkbox], select')) return; const fn = A[el.dataset.act]; if (!fn) { toast('This control is not wired: ' + el.dataset.act, 'err'); return; } fn.call(A, e, el); });
document.addEventListener('keydown', e => {
  if (e.target.matches('#helpInput')) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); A.helpSend(); } return; }
  if (e.key === 'Escape' && HELP.open && !$('#modalRoot').firstChild) { A.helpClose(); return; }
  if (e.key === 'Enter' && e.target.matches('#imgUrl')) { e.preventDefault(); A.imgAdd(); } if (e.key === 'Enter' && e.target.matches('#seedInput')) { e.preventDefault(); const b = $('[data-act=fetchSuggest]'); b && b.click(); } if (e.key === 'Enter' && e.target.closest('#authForm') && e.target.tagName !== 'BUTTON') { e.preventDefault(); A.authSubmit(e, $('[data-act=authSubmit]')); } });
$('#globalSearch').addEventListener('input', debounce(e => { S.q = e.target.value; if (S.route.name !== 'products') go('products'); else render(); }, 250));
document.addEventListener('input', e => {
  if (e.target.id === 'prodSearch') { S.q = e.target.value; debouncedProducts(); }
  if (e.target.id === 'helpSearch') { S.helpQ = e.target.value; debouncedHelp(); }
  if (e.target.id === 'helpInput') autosize(e.target);
});
const debouncedHelp = debounce(() => { const v = $('#helpSearch'); const pos = v ? v.selectionStart : 0; render().then(() => { const n = $('#helpSearch'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }); }, 250);
const debouncedProducts = debounce(() => { const v = $('#prodSearch'); const pos = v ? v.selectionStart : 0; render().then(() => { const n = $('#prodSearch'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }); }, 250);
$('#themeBtn').addEventListener('click', () => A.toggleTheme());
$('#syncBtn').addEventListener('click', () => A.goSync());
$('#avatarBtn').addEventListener('click', () => A.goAccount());
$('#versionBadge').addEventListener('click', () => A.about());
document.addEventListener('click', e => { if (e.target.closest('.imgrow .im') && !e.target.closest('[data-act]')) { S.imgSel = +e.target.closest('.im').dataset.idx; paintImages(); } });
window.addEventListener('hashchange', () => { const r = parseRoute(); if (r.name === 'products' && r.id) { S.route = r; paintNav(); vProductEdit(r.id).then(h => { $('#view').innerHTML = h; $$('textarea.auto').forEach(autosize); window.scrollTo(0, 0); }); } else render(); });
window.addEventListener('online', () => { cloud.probe().then(() => { paintNav(); if (cloud.state.user) queueSync(); }); });

(async function boot() {
  await loadAll(); applyTheme();
  try { // landing page hands returning users straight to the app; "See the sample" seeds the demo once
    if ((localStorage.getItem('plm:demo') || /[?&]demo/.test(location.search)) && !S.products.length) { localStorage.removeItem('plm:demo'); const p = Object.assign(E.blankProduct(), structuredClone(E.SAMPLE_PRODUCT), { id: uid() }); await saveProduct(p); location.hash = '#/studio/' + p.id; }
    if (S.products.length || matchMedia('(display-mode: standalone)').matches) localStorage.setItem('plm:installed', '1');
  } catch { /* private mode */ }
  const r = parseRoute();
  if (r.name === 'products' && r.id) { S.route = r; paintNav(); $('#view').innerHTML = await vProductEdit(r.id); $$('textarea.auto').forEach(autosize); } else await render();
  helpMount();
  cloud.probe().then(async () => { if (cloud.state.available) { await cloud.me(); if (cloud.state.user && S.settings.autoSync) { try { await syncWorkspace(); await loadAll(); if (S.route.name !== 'products' || !S.route.id) render(); } catch (e) { console.warn(e); } } } paintNav(); });
  if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js').then(reg => { reg.addEventListener('updatefound', () => { const nw = reg.installing; nw && nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) toast('Update ready — reload to get the new version'); }); }); }).catch(() => { /* file:// or unsupported */ }); }
})();
