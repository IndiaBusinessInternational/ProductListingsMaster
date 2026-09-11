/* IBI Product Listings Master — listing engine
 * Deterministic: one master product record in, one channel-shaped listing out.
 * Works with no network and no AI key. AI (see app.js / functions/api/ai.js)
 * only proposes text; everything it returns comes back through enforceLimits()
 * and validate() here, so a model can never ship a non-compliant field.
 */
import { CHANNEL_MAP, exportSpec } from './channels.js';

export const ENGINE_VERSION = '1.0.0';

/* ───────────────────────── vocabularies ───────────────────────── */
export const STOP_WORDS = new Set(['a', 'an', 'the', 'of', 'for', 'with', 'and', 'in', 'to', 'on', 'by', 'or', 'from', 'at', 'is', 'as', 'per', 'x', '&', '-', '|', '·']);

export const PROMO_WORDS = ['best', 'cheap', 'cheapest', 'sale', 'free', 'guarantee', 'guaranteed', 'no.1', 'no 1', 'number one', '100%', 'discount', 'offer', 'hot deal', 'top rated', 'bestseller', 'best seller', 'limited time', 'lowest price', 'deal', 'exclusive', 'must have', 'buy now', 'free shipping', 'money back', 'clearance', 'flash sale', 'hurry', 'combo offer'];

export const MRP_CLAIM_WORDS = ['mrp', 'discount', '% off', 'percent off', 'guarantee', 'guaranteed', 'warranty', 'cashback', 'free', 'offer', 'cheapest', 'lowest'];

export const UNVERIFIABLE = ['world\'s', 'india\'s', 'no.1', 'number one', 'best in class', 'clinically proven', 'doctor recommended', 'award winning', '100% safe', 'miracle', 'cures', 'anti-cancer'];

const ACRONYMS = new Set(['BIS', 'ISI', 'ISO', 'FSSAI', 'LED', 'USB', 'UV', 'BPA', 'ABS', 'PVC', 'PU', 'TPU', 'SS', 'XL', 'XXL', 'XS', 'S', 'M', 'L', 'ML', 'KG', 'GM', 'CM', 'MM', 'PCS', 'HD', 'AC', 'DC', 'RO', 'ECG', 'GST', 'HSN', 'MRP', 'IBI', 'UPI', 'CE', 'RoHS', 'AISI', 'CNC', 'DIY']);

/* Product-type synonyms customers actually type on Indian marketplaces. Extend freely — it is only a ranking hint. */
export const SYNONYMS = {
  strainer: ['colander', 'chalni', 'sieve', 'channi'], colander: ['strainer', 'chalni'], sieve: ['strainer', 'chalni'],
  bottle: ['flask', 'sipper', 'water bottle'], flask: ['bottle', 'thermos'], lunchbox: ['tiffin', 'lunch box'], tiffin: ['lunch box', 'dabba'],
  kurti: ['kurta', 'tunic'], kurta: ['kurti'], saree: ['sari', 'sarees'], sari: ['saree'], dupatta: ['stole', 'chunni'], lehenga: ['ghagra', 'lehnga'],
  earrings: ['jhumka', 'ear rings', 'earring'], jhumka: ['jhumki', 'earrings'], necklace: ['chain', 'haar', 'neckpiece'], bangles: ['kada', 'bangle set', 'chudi'], anklet: ['payal', 'anklets'],
  mat: ['rug', 'carpet', 'chatai'], rug: ['mat', 'carpet'], doormat: ['door mat', 'entrance mat'],
  box: ['container', 'organiser', 'organizer', 'storage box'], container: ['box', 'jar', 'dabba'], jar: ['container', 'canister'],
  cover: ['case', 'protector', 'sleeve'], case: ['cover', 'pouch'], lamp: ['light', 'lantern'], light: ['lamp', 'bulb'],
  coconut: ['nariyal', 'thengai'], coir: ['coconut fibre', 'coconut fiber', 'coir fibre'], jaggery: ['gud', 'vellam', 'gur'], palm: ['palmyra', 'panai'],
  brush: ['cleaner', 'scrubber'], scrubber: ['scrub pad', 'brush'], bag: ['handbag', 'pouch', 'tote'], handbag: ['bag', 'purse', 'sling bag'],
  shoes: ['footwear', 'shoe'], sandals: ['chappal', 'slippers', 'footwear'], slippers: ['chappal', 'flip flops'], sneakers: ['sports shoes', 'casual shoes'],
  stand: ['holder', 'rack', 'organiser'], holder: ['stand', 'rack'], rack: ['stand', 'shelf', 'organiser'], shelf: ['rack', 'organiser'],
  grinder: ['mixer', 'mixie'], mixer: ['grinder', 'mixie'], knife: ['cutter', 'chef knife'], cutter: ['slicer', 'chopper'], chopper: ['cutter', 'vegetable chopper'],
  pan: ['tawa', 'frying pan', 'kadai'], kadai: ['wok', 'kadhai', 'pan'], tawa: ['griddle', 'dosa tawa', 'pan'], cooker: ['pressure cooker'], pot: ['handi', 'vessel'],
  spoon: ['ladle', 'karchi'], ladle: ['spoon', 'karchi'], plate: ['thali', 'dish'], bowl: ['katori', 'serving bowl'], glass: ['tumbler'], tumbler: ['glass', 'cup'], mug: ['cup', 'coffee mug'],
  towel: ['napkin', 'bath towel'], bedsheet: ['bed sheet', 'double bedsheet'], pillow: ['cushion'], cushion: ['pillow', 'cushion cover'], curtain: ['curtains', 'parda'],
  tshirt: ['t-shirt', 'tee', 'round neck'], 't-shirt': ['tshirt', 'tee'], shirt: ['formal shirt', 'casual shirt'], jeans: ['denim'], trousers: ['pants', 'formal pants'], pants: ['trousers'],
  watch: ['wrist watch', 'analog watch'], wallet: ['purse', 'card holder'], belt: ['leather belt'], cap: ['hat'], hat: ['cap'], sunglasses: ['goggles', 'shades'],
  charger: ['adapter', 'fast charger'], cable: ['charging cable', 'wire', 'cord'], earphones: ['earbuds', 'headphones'], headphones: ['headset', 'earphones'], speaker: ['bluetooth speaker'],
  toy: ['toys', 'kids toy'], puzzle: ['brain teaser', 'jigsaw'], doll: ['soft toy'], car: ['toy car', 'remote car'],
  cream: ['moisturiser', 'lotion'], oil: ['hair oil', 'massage oil'], soap: ['bathing bar', 'soap bar'], shampoo: ['hair wash'], serum: ['face serum'],
  tea: ['chai', 'green tea'], coffee: ['filter coffee'], spice: ['masala'], masala: ['spice mix', 'powder'], rice: ['chawal', 'arisi'], honey: ['raw honey'], pickle: ['achar'],
  planter: ['flower pot', 'gamla', 'plant pot'], pot_plant: ['planter'], seeds: ['seed packet'], fertilizer: ['manure', 'khad', 'plant food'],
  ladder: ['step ladder', 'folding ladder'], stool: ['step stool', 'seat'], chair: ['seat'], table: ['desk'], hanger: ['cloth hanger', 'hangers'], bucket: ['balti'], mop: ['floor cleaner', 'pocha'], broom: ['jhadu', 'sweeper'],
  strainer_food: ['colander'], sheet: ['bedsheet'], cover_mobile: ['back cover', 'phone case'],
  diya: ['deepam', 'oil lamp'], idol: ['statue', 'murti'], rangoli: ['kolam'], incense: ['agarbatti', 'dhoop'], candle: ['scented candle'],
};

/* Categories → extra keyword hints (only used when the seller gives no keywords for that idea). */
export const CATEGORY_HINTS = {
  'kitchen': ['kitchen tools', 'cooking', 'home kitchen', 'kitchenware'], 'home': ['home decor', 'household', 'home essentials'], 'fashion': ['latest', 'stylish', 'trendy', 'daily wear'],
  'jewellery': ['jewelry', 'traditional', 'ethnic', 'party wear', 'gift for women'], 'grocery': ['natural', 'homemade', 'organic', 'traditional'], 'electronics': ['compatible', 'portable', 'wireless'],
  'beauty': ['skin care', 'natural', 'for men and women'], 'toys': ['kids', 'children', 'learning', 'gift'], 'garden': ['gardening', 'indoor plants', 'balcony'],
  'footwear': ['comfortable', 'daily use', 'lightweight', 'anti slip'], 'stationery': ['office', 'school', 'students'], 'sports': ['fitness', 'gym', 'outdoor'], 'pet': ['pets', 'dog', 'cat'],
  'auto': ['car accessories', 'bike accessories'], 'baby': ['newborn', 'infant', 'kids'], 'health': ['wellness', 'ayurvedic', 'herbal'],
};

/* ───────────────────────── text helpers ───────────────────────── */
export const bytes = s => new TextEncoder().encode(String(s || '')).length;
export const words = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\p{M}'.%+-]+/gu, ' ').trim().split(/\s+/).filter(Boolean);
export const contentWords = s => words(s).filter(w => !STOP_WORDS.has(w) && w.length > 1);
const norm = w => String(w || '').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]/gu, '');
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const list = v => Array.isArray(v) ? v.map(clean).filter(Boolean) : clean(v) ? clean(v).split(/[|,\n;]+/).map(clean).filter(Boolean) : [];

export function titleCase(s) {
  return clean(s).split(' ').map(w => {
    if (!w) return w;
    if (ACRONYMS.has(w.toUpperCase()) && w === w.toUpperCase()) return w;
    if (/^[A-Z0-9]{2,}$/.test(w) && w.length <= 4) return w; // model codes like X200
    if (/\d/.test(w)) return w;
    if (w.includes('-')) return w.split('-').map(cap).join('-');
    return cap(w.toLowerCase());
  }).join(' ');
}

export function trimTo(s, max, { sentence = false } = {}) {
  s = clean(s);
  if (s.length <= max) return s;
  let cut = s.slice(0, max);
  if (sentence) { const i = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n')); if (i > max * 0.6) return cut.slice(0, i + 1); }
  const sp = cut.lastIndexOf(' ');
  cut = sp > max * 0.6 ? cut.slice(0, sp) : cut;
  return cut.replace(/[\s,;:|·(\-–—]+$/g, '');
}

export function trimBytes(s, maxB) {
  s = clean(s);
  while (bytes(s) > maxB) { const sp = s.lastIndexOf(' '); s = sp > 0 ? s.slice(0, sp) : s.slice(0, -1); }
  return s;
}

function countRepeats(s) {
  const c = {};
  for (const w of contentWords(s)) { const k = norm(w); if (k) c[k] = (c[k] || 0) + 1; }
  return c;
}

/* ───────────────────────── product model ───────────────────────── */
export function blankProduct() {
  return {
    id: '', sku: '', brand: '', productType: '', name: '', category: '', subcategory: '', keyFeatures: [], material: '', colour: '', size: '',
    lengthCm: '', breadthCm: '', heightCm: '', weightG: '', netQuantity: '', packSize: 1, useCases: [], audience: '', model: '', partNumber: '',
    certifications: [], warranty: '', care: '', countryOfOrigin: 'India', manufacturerName: '', manufacturerAddress: '', packerName: '', packerAddress: '', importerName: '', importerAddress: '',
    consumerCare: '', mrp: '', sellingPrice: '', gst: '', hsn: '', gtin: '', gtinType: 'EAN', stock: '', images: [], keywords: [], notes: '', variants: [],
    createdAt: '', updatedAt: '',
  };
}

export function normalizeProduct(p) {
  const n = Object.assign(blankProduct(), p || {});
  for (const k of ['keyFeatures', 'useCases', 'certifications', 'keywords']) n[k] = list(n[k]);
  n.images = (Array.isArray(n.images) ? n.images : list(n.images)).map(i => typeof i === 'string' ? { url: i, alt: '' } : i).filter(i => i && (i.url || i.data));
  n.variants = Array.isArray(n.variants) ? n.variants : [];
  for (const k of ['brand', 'productType', 'name', 'category', 'subcategory', 'material', 'colour', 'size', 'audience', 'model', 'partNumber', 'warranty', 'care', 'countryOfOrigin', 'manufacturerName', 'manufacturerAddress', 'packerName', 'packerAddress', 'importerName', 'importerAddress', 'consumerCare', 'hsn', 'gtin', 'sku', 'netQuantity', 'notes'])
    n[k] = clean(n[k]);
  for (const k of ['lengthCm', 'breadthCm', 'heightCm', 'weightG', 'mrp', 'sellingPrice', 'gst', 'stock']) { const v = parseFloat(n[k]); n[k] = isNaN(v) ? '' : v; }
  n.packSize = Math.max(1, parseInt(n.packSize, 10) || 1);
  if (!n.productType && n.name) n.productType = n.name;
  return n;
}

/* ───────────────────────── keyword pool ───────────────────────── */
/* Returns [{term, weight, source}] sorted by weight. `extra` = live suggestions
 * from /api/suggest and `perf` = performance boosts (see boostFromPerformance). */
export function keywordPool(product, { suggestions = [], boosts = {}, includeBrand = false } = {}) {
  const p = normalizeProduct(product);
  const pool = new Map();
  const add = (term, weight, source) => {
    term = clean(term).toLowerCase().replace(/[,|]+/g, ' ');
    if (!term || term.length < 2) return;
    const key = norm(term.replace(/\s+/g, ''));
    if (!key || (!includeBrand && p.brand && key === norm(p.brand))) return;
    const cur = pool.get(key);
    if (cur) { cur.weight = Math.max(cur.weight, weight) + weight * 0.25; if (!cur.sources.includes(source)) cur.sources.push(source); }
    else pool.set(key, { term, weight, sources: [source] });
  };
  add(p.productType, 10, 'product');
  contentWords(p.productType).forEach(w => { add(w, 6, 'product'); (SYNONYMS[w] || []).forEach(s => add(s, 5, 'synonym')); });
  p.keywords.forEach((k, i) => add(k, 9 - Math.min(i, 4) * 0.5, 'seller'));
  if (p.material) { add(p.material, 5, 'attribute'); add(`${p.material} ${p.productType}`, 6, 'attribute'); }
  p.useCases.forEach(u => { add(u, 5, 'use'); add(`${p.productType} for ${u}`, 4.5, 'use'); });
  p.keyFeatures.forEach(f => contentWords(f).slice(0, 3).forEach(w => add(w, 3, 'feature')));
  if (p.audience) add(`${p.productType} for ${p.audience}`, 5, 'audience');
  if (p.colour) add(`${p.colour} ${p.productType}`, 3.5, 'attribute');
  if (p.size) add(`${p.size} ${p.productType}`, 3, 'attribute');
  p.certifications.forEach(c => add(`${c} certified`, 3, 'cert'));
  const catKey = Object.keys(CATEGORY_HINTS).find(k => (p.category + ' ' + p.subcategory).toLowerCase().includes(k));
  if (catKey) CATEGORY_HINTS[catKey].forEach(h => add(h, 2.5, 'category'));
  suggestions.forEach((s, i) => add(typeof s === 'string' ? s : s.term, 8.8 - Math.min(i, 8) * 0.4, 'live'));
  for (const item of pool.values()) {
    const b = boosts[norm(item.term.replace(/\s+/g, ''))];
    if (b) { item.weight += b; if (!item.sources.includes('performance')) item.sources.push('performance'); }
    if (PROMO_WORDS.some(pw => item.term.includes(pw))) item.weight = 0; // never rank promo words
  }
  return [...pool.values()].filter(i => i.weight > 0).sort((a, b) => b.weight - a.weight);
}

/* ───────────────────────── slot values ───────────────────────── */
function slotValues(p, ch) {
  const dims = [p.lengthCm, p.breadthCm, p.heightCm].filter(v => v !== '' && v != null);
  const sizeText = p.size || (dims.length === 3 ? `${dims[0]}x${dims[1]}x${dims[2]} cm` : dims.length ? `${dims[0]} cm` : '');
  return {
    brand: p.brand && !/^(generic|unbranded|no brand)$/i.test(p.brand) ? p.brand : '',
    productType: titleCase(p.productType),
    keyFeature: p.keyFeatures[0] ? titleCase(splitFeature(p.keyFeatures[0])[0] || shortPhrase(p.keyFeatures[0], 3)) : '',
    material: p.material ? titleCase(p.material) : '',
    certification: p.certifications[0] ? p.certifications[0].toUpperCase().replace(/ CERTIFIED$/i, '') : '',
    size: sizeText,
    useCase: p.useCases[0] ? titleCase(shortPhrase(p.useCases[0], 3)) : '',
    colour: p.colour ? titleCase(p.colour) : '',
    model: p.model ? p.model : '',
    packSize: p.packSize > 1 ? `Pack of ${p.packSize}` : '',
    audience: p.audience ? `for ${titleCase(p.audience)}` : '',
  };
}

function shortPhrase(s, maxWords) {
  const w = clean(s).replace(/[.:;,(].*$/, '').split(' ').filter(Boolean);
  return w.slice(0, maxWords).join(' ').replace(/[\s,;:.\-–—]+$/g, '');
}

/* Join clauses while the result fits; the first clause always survives. */
function fit(clauses, max, joiner = ', ') {
  let s = '';
  for (const c of clauses.filter(Boolean)) { const n = s ? s + joiner + c : c; if (n.length > max) { if (!s) s = trimTo(c, max); break; } s = n; }
  return s;
}

/* Turn "Fine mesh drains rice, pasta and vegetables fast" into ["Fine mesh", "drains rice, pasta and vegetables fast"]. */
function splitFeature(kf) {
  const s = clean(kf).replace(/[.!?]+$/, '');
  const w = s.split(' ');
  if (w.length >= 5) { const n = /^(and|of|or|&|-)$/i.test(w[1]) ? 3 : 2; return [cap(w.slice(0, n).join(' ')), w.slice(n).join(' ')]; }
  return ['', s];
}

/* ───────────────────────── composers ───────────────────────── */
export function composeTitle(product, channel, pool) {
  const p = normalizeProduct(product), ch = resolveChannel(channel), f = ch.fields.title;
  const vals = slotValues(p, ch), join = ch.titleJoin || ' ', paren = ch.titleParen || [];
  const parts = [], parenParts = [];
  const rules = f.rules || [];
  const used = new Set();
  assemble.brand = vals.brand || null;
  const tryAdd = (slot) => {
    let v = vals[slot]; if (!v) return;
    if (rules.includes('noPackInTitle') && slot === 'packSize') return;
    if (rules.includes('noSymbols')) v = v.replace(/[^\p{L}\p{N}\p{M}\s.\-,()/&']/gu, '').trim();
    if (rules.includes('amazonChars')) v = v.replace(/[!$?_{}^¬¦]/g, '');
    const k = v.toLowerCase(); if (used.has(k)) return;
    // repetition guard: never introduce a 3rd occurrence of a content word
    const candidate = assemble([...parts, v], paren.includes(slot) ? [...parenParts] : parenParts, join, paren.includes(slot) ? v : null);
    const reps = countRepeats(candidate);
    if (rules.includes('maxRepeat2') && Object.values(reps).some(n => n > 2)) return;
    if (candidate.length > f.target[1]) return;
    if (paren.includes(slot)) parenParts.push(v); else parts.push(v);
    used.add(k);
  };
  for (const slot of ch.titleSlots) tryAdd(slot);
  // fill the band with the strongest keywords not yet present (synonyms customers type)
  let title = assemble(parts, parenParts, join);
  if (pool && title.length < f.target[0]) {
    for (const kw of pool) {
      const tw = contentWords(title).map(norm);
      const kws = contentWords(kw.term).map(norm);
      if (!kws.length || kws.every(w => tw.includes(w))) continue;
      if (kw.term.split(' ').length > 3) continue;
      const v = titleCase(kw.term);
      const candidate = assemble([...parts, v], parenParts, join);
      if (candidate.length > f.target[1]) continue;
      if (rules.includes('maxRepeat2') && Object.values(countRepeats(candidate)).some(n => n > 2)) continue;
      parts.push(v); title = candidate;
      if (title.length >= f.target[0]) break;
    }
  }
  // dynamic SEO: a performance-boosted or live-suggested term earns a place even if an optional slot has to go (seller keywords enter via the band fill above)
  if (pool) {
    const essential = new Set([vals.brand, vals.productType].filter(Boolean));
    const priority = pool.filter(k => (k.sources.includes('performance') && k.weight > 6) || k.sources.includes('live')).slice(0, 2);
    for (const kw of priority) {
      const kws = contentWords(kw.term).map(norm); const tw = contentWords(assemble(parts, parenParts, join)).map(norm);
      if (!kws.length || kws.every(w => tw.includes(w)) || kw.term.split(' ').length > 3) continue;
      const v = titleCase(kw.term); const trial = [...parts]; let pops = 0;
      while (assemble([...trial, v], parenParts, join).length > f.target[1] && pops < 2 && trial.length > 1 && !essential.has(trial[trial.length - 1])) { trial.pop(); pops++; }
      const candidate = assemble([...trial, v], parenParts, join);
      if (candidate.length <= f.target[1] && !(rules.includes('maxRepeat2') && Object.values(countRepeats(candidate)).some(n => n > 2))) { parts.length = 0; parts.push(...trial, v); }
    }
    title = assemble(parts, parenParts, join);
  }
  title = trimTo(title, f.max);
  if (rules.includes('noAllCaps')) title = title.split(' ').map(w => (/^[A-Z]{4,}$/.test(w) && !ACRONYMS.has(w)) ? titleCase(w) : w).join(' ');
  return title;
}

/* Brand and product type always sit together with a space; the channel joiner applies after that. */
function assemble(parts, parenParts, join, extraParen) {
  const pp = extraParen ? [...parenParts, extraParen] : parenParts;
  let s = parts.length > 1 && parts[0] === assemble.brand ? parts[0] + ' ' + parts.slice(1).join(join) : parts.join(join);
  if (pp.length) s += ` (${pp.join(', ')})`;
  return clean(s);
}

const HL_FILLER = new Set(['build', 'weight', 'size', 'net', 'certified', 'cm', 'g', 'kg']);

export function composeHighlights(product, channel, title, pool) {
  const p = normalizeProduct(product), ch = resolveChannel(channel), f = ch.fields.highlights;
  if (!f) return '';
  const rules = f.rules || [], sep = f.sep || ' · ';
  if (sep === ' ' && f.max <= 60) { // Google-title style
    const bits = [p.brand, titleCase(p.productType), p.keyFeatures[0] ? titleCase(shortPhrase(p.keyFeatures[0], 3)) : '', p.material ? titleCase(p.material) : ''].filter(Boolean);
    let s = ''; for (const b of bits) { const c = s ? `${s} ${b}` : b; if (c.length > f.max) break; s = c; }
    return s;
  }
  const titleWords = new Set(contentWords(title).map(norm));
  const brandWords = new Set(contentWords(p.brand).map(norm));
  const cand = [];
  const push = (s) => { s = clean(s); if (s) cand.push(s); };
  if (p.material) push(`${titleCase(p.material)} build`);
  p.keyFeatures.forEach(k => push(titleCase(shortPhrase(k, 4))));
  p.useCases.forEach(u => push(titleCase(shortPhrase(u, 4))));
  if (p.audience) push(`For ${titleCase(p.audience)}`);
  if (p.packSize > 1) push(`Pack of ${p.packSize}`);
  if (p.netQuantity) push(`Net ${p.netQuantity}`);
  if (p.weightG) push(`${fmtWeight(p.weightG)} weight`);
  const dims = [p.lengthCm, p.breadthCm, p.heightCm].filter(v => v !== '');
  if (dims.length === 3) push(`${dims.join('x')} cm size`);
  p.certifications.forEach(c => push(`${c} certified`));
  if (p.warranty) push(titleCase(shortPhrase(p.warranty, 4)));
  if (p.care) push(titleCase(shortPhrase(p.care, 4)));
  (pool || []).slice(0, 12).forEach(k => { if (k.term.split(' ').length <= 4) push(titleCase(k.term)); });
  const out = [], seen = new Set();
  for (let ph of cand) {
    if (rules.includes('noBrand') && contentWords(ph).some(w => brandWords.has(norm(w)))) continue;
    if (rules.includes('noTitleWords')) { const ws = ph.split(' ').filter(w => STOP_WORDS.has(w.toLowerCase()) || !w.split('-').some(part => titleWords.has(norm(part)))); const dropped = ws.length < ph.split(' ').length; ph = ws.join(' '); if (contentWords(ph).filter(w => !HL_FILLER.has(w)).length === 0 || (dropped && contentWords(ph).length < 2)) continue; }
    if (rules.includes('noPromo') && hasPromo(ph)) continue;
    ph = ph.replace(/[.!?]+$/, '');
    const k = ph.toLowerCase(); if (seen.has(k) || ph.split(' ').length > 5) continue;
    const next = [...out, ph].join(sep);
    if (next.length > f.max) continue;
    out.push(ph); seen.add(k);
    if (next.length >= f.target[1] - 4) break;
  }
  return out.join(sep);
}

export function composeBullets(product, channel, pool) {
  const p = normalizeProduct(product), ch = resolveChannel(channel), f = ch.fields.bullets;
  if (!f) return [];
  const rules = f.rules || [], out = [];
  if (rules.includes('noMrpClaims')) p.warranty = '';
  const pt = titleCase(p.productType), brand = p.brand ? `${p.brand} ` : '';
  const label = (l, body) => f.maxEach >= 100 ? `${l}: ${body}` : body;
  if (ch.id === 'ebay') { // item specifics
    const specs = [['Brand', p.brand || 'Unbranded'], ['Type', pt], ['Material', p.material], ['Colour', p.colour], ['Size', p.size], ['Model', p.model], ['Country/Region of Manufacture', p.countryOfOrigin], ['Features', p.keyFeatures.slice(0, 2).map(k => shortPhrase(k, 3)).join(', ')]];
    return specs.filter(s => s[1]).map(s => trimTo(`${s[0]}: ${s[1]}`, f.maxEach)).slice(0, f.count);
  }
  const tMin = f.targetEach ? f.targetEach[0] : 0;
  const support = [ // factual support sentences used to bring a short bullet up to the band, each used once
    p.useCases[0] ? `Made for ${p.useCases[0].toLowerCase()}${p.useCases[1] ? ` and ${p.useCases[1].toLowerCase()}` : ''}` : '',
    p.audience ? `Sized for ${p.audience.toLowerCase()}` : '', p.material ? `${cap(p.material)} throughout, no coating to wear off` : '',
    p.certifications.length ? `${p.certifications.join(' and ')} certified` : '', p.countryOfOrigin ? `Made in ${p.countryOfOrigin}` : '', p.warranty ? cap(p.warranty.replace(/[.!?]$/, '')) : '',
    p.care ? cap(p.care.replace(/[.!?]$/, '')) : '', p.colour ? `Colour ${p.colour.toLowerCase()}` : '', p.netQuantity ? `Net quantity ${p.netQuantity}` : '', p.useCases[2] ? `Also handy for ${p.useCases[2].toLowerCase()}` : '',
  ].filter(Boolean);
  const pad = (b) => { let s = b; while (s.length < tMin && support.length) { const add = support.shift(); const n = `${s.replace(/[.!?]$/, '')}. ${add}.`; if (n.length > f.maxEach) break; s = n; } return s; };
  if (p.material) out.push(label('Material and build', fit([`${p.material} ${p.productType.toLowerCase()}`, p.keyFeatures[0] ? `with ${shortPhrase(p.keyFeatures[0], 6).toLowerCase()}` : 'made for daily use', p.certifications.length ? `${p.certifications.join(' and ')} certified` : ''], f.maxEach - 22, ', ') + '.'));
  p.keyFeatures.forEach((kf) => { if (out.length >= f.count + 2) return; const [lab, body] = splitFeature(kf); out.push(label(lab || 'Key feature', `${cap(body)}.`)); });
  const dims = [p.lengthCm, p.breadthCm, p.heightCm].filter(v => v !== '');
  const sizeBits = [p.size && `size ${p.size}`, dims.length === 3 && `${dims.join(' x ')} cm`, p.weightG && `${fmtWeight(p.weightG)}`, p.netQuantity && `net quantity ${p.netQuantity}`].filter(Boolean);
  if (sizeBits.length) out.push(label('Size and weight', `${cap(sizeBits.join(', '))}; check the measurements against your need before ordering.`));
  if (p.useCases.length) out.push(label('Use it for', `${p.useCases.map(u => u.toLowerCase()).join(', ')}${p.audience ? ` — suited for ${p.audience.toLowerCase()}` : ''}.`));
  if (p.packSize > 1) out.push(label('In the box', `${p.packSize} x ${brand}${pt}${p.colour ? ` in ${p.colour.toLowerCase()}` : ''}.`));
  if (p.care || p.warranty) out.push(label('Care and support', [p.care, p.warranty].filter(Boolean).map(s => cap(clean(s)).replace(/[.!?]$/, '')).join('. ') + '.'));
  if (out.length < f.count && p.countryOfOrigin) out.push(label('Made in', `${p.countryOfOrigin}${p.manufacturerName ? ` by ${p.manufacturerName}` : ''}; sold with the full Legal Metrology declaration on the pack.`));
  if (out.length < f.count && pool) { const kw = pool.filter(k => k.sources.includes('synonym') || k.sources.includes('use')).slice(0, 3).map(k => k.term); if (kw.length) out.push(label('Also known as', `${kw.join(', ')} — the same ${p.productType.toLowerCase()} by another name.`)); }
  out.splice(0, out.length, ...out.map(pad));
  return out.slice(0, f.count).map(b => {
    let s = clean(b);
    if (rules.includes('amazonChars')) s = s.replace(/[!$?_{}^¬¦]/g, '');
    if (rules.includes('noSymbols')) s = s.replace(/[^\p{L}\p{N}\p{M}\s.,:;()\-\/%&'"]/gu, '');
    if (rules.includes('noMrpClaims') || rules.includes('noPromo')) s = stripClaims(s, rules);
    return trimTo(s, f.maxEach, { sentence: true });
  });
}

export function composeDescription(product, channel, pool, bullets) {
  const p = normalizeProduct(product), ch = resolveChannel(channel), f = ch.fields.description;
  if (!f) return '';
  const rules = f.rules || [];
  if (rules.includes('noMrpClaims')) p.warranty = '';
  const pt = p.productType.toLowerCase(), brand = p.brand && !/^(generic|unbranded)$/i.test(p.brand) ? p.brand : '';
  const paras = [];
  const kwTop = (pool || []).slice(0, 8).map(k => k.term);
  paras.push(clean(`${brand ? `${brand} ` : ''}${titleCase(p.productType)}${p.material ? ` in ${p.material.toLowerCase()}` : ''}${p.useCases[0] ? `, made for ${p.useCases[0].toLowerCase()}` : ''}. ${p.notes ? cap(clean(p.notes)) + (/[.!?]$/.test(p.notes) ? '' : '.') : `A practical ${pt} that does one job well and keeps doing it.`}`));
  if (p.keyFeatures.length) paras.push(`What you get: ${p.keyFeatures.map(k => k.replace(/[.!?]$/, '').toLowerCase()).join('; ')}.`);
  const spec = [['Material', p.material], ['Colour', p.colour], ['Size', p.size], ['Dimensions', [p.lengthCm, p.breadthCm, p.heightCm].every(v => v !== '') ? `${p.lengthCm} x ${p.breadthCm} x ${p.heightCm} cm` : ''], ['Weight', p.weightG ? fmtWeight(p.weightG) : ''], ['Net quantity', p.netQuantity], ['Pack', p.packSize > 1 ? `${p.packSize} units` : ''], ['Model', p.model], ['Certification', p.certifications.join(', ')], ['Country of origin', p.countryOfOrigin]].filter(s => s[1]);
  if (spec.length) paras.push(`Specifications: ${spec.map(s => `${s[0]} ${s[1]}`).join(' | ')}.`);
  if (p.useCases.length > 1 || p.audience) paras.push(`Ideal for ${p.useCases.map(u => u.toLowerCase()).join(', ') || pt}${p.audience ? `; a good fit for ${p.audience.toLowerCase()}` : ''}.`);
  if (p.care || p.warranty) paras.push(clean([p.care, p.warranty].filter(Boolean).map(s => cap(clean(s)).replace(/[.!?]$/, '')).join('. ') + '.'));
  paras.push(`In the box: ${p.packSize} x ${brand ? `${brand} ` : ''}${titleCase(p.productType)}${p.colour ? ` (${p.colour})` : ''}${p.certifications.length ? `, ${p.certifications.join(' and ')} certified` : ''}${p.warranty ? `, ${p.warranty.toLowerCase().replace(/[.!?]$/, '')}` : ''}.`);
  if (p.manufacturerName) paras.push(`Manufactured / packed by ${p.manufacturerName}${p.manufacturerAddress ? `, ${p.manufacturerAddress}` : ''}.${p.consumerCare ? ` Consumer care: ${p.consumerCare}.` : ''}`);
  if (rules.includes('weaveKeywords') || !ch.fields.keywords) {
    const extra = kwTop.filter(k => !paras.join(' ').toLowerCase().includes(k)).slice(0, 6);
    if (extra.length) paras.push(`Searching for ${extra.join(', ')}? This ${pt} is the one.`);
  }
  let d = paras.join('\n\n');
  if (d.length < f.target[0]) {
    const fillers = [
      p.material ? `The ${p.material.toLowerCase()} ${pt} is chosen for how it wears in real kitchens and homes, not for a photo.` : `Every ${pt} is checked before it is packed.`,
      p.useCases[0] ? `Use it for ${p.useCases[0].toLowerCase()} today and it will still be in service next year.` : `Simple to use, simple to clean, simple to store.`,
      p.packSize > 1 ? `The pack of ${p.packSize} covers a household or a small business without reordering.` : `One ${pt} for one job, sized so it earns its place.`,
      kwTop.length ? `People also call this a ${kwTop.filter(k => k !== pt).slice(0, 3).join(', ')}.` : '',
    ].filter(Boolean);
    for (const s of fillers) { if (d.length >= f.target[0]) break; d += `\n\n${s}`; }
  }
  if (rules.includes('noMrpClaims') || rules.includes('noPromo')) d = stripClaims(d, rules);
  return trimTo(d, f.max, { sentence: true });
}

export function composeKeywords(product, channel, title, pool) {
  const p = normalizeProduct(product), ch = resolveChannel(channel), f = ch.fields.keywords;
  if (!f) return '';
  const rules = f.rules || [];
  const titleWords = new Set(contentWords(title).map(norm));
  const brandWords = new Set(contentWords(p.brand).map(norm));
  const seen = new Set(), terms = [];
  for (const k of pool || []) {
    let ws = contentWords(k.term);
    if (rules.includes('noBrand')) ws = ws.filter(w => !brandWords.has(norm(w)));
    if (rules.includes('noTitleWords')) ws = ws.filter(w => !titleWords.has(norm(w)));
    ws = ws.filter(w => !seen.has(norm(w)));
    if (!ws.length) continue;
    if (rules.includes('noPromo') && hasPromo(ws.join(' '))) continue;
    if (f.tagMax) { const tag = ws.join(' ').slice(0, f.tagMax); if (terms.length < (f.tagCount || 13)) { terms.push(tag); ws.forEach(w => seen.add(norm(w))); } continue; }
    ws.forEach(w => { seen.add(norm(w)); terms.push(w); });
  }
  const joiner = rules.includes('noCommas') ? ' ' : (f.tagMax ? ', ' : ' ');
  let s = terms.join(joiner);
  s = trimBytes(s, f.maxBytes);
  return s;
}

export function composeMeta(product, channel, title, bullets, description) {
  const ch = resolveChannel(channel), f = ch.fields.metaDescription;
  if (!f) return '';
  const p = normalizeProduct(product);
  let s = clean(`${title}. ${p.useCases[0] ? `For ${p.useCases[0].toLowerCase()}. ` : ''}${p.keyFeatures[0] ? cap(p.keyFeatures[0].toLowerCase()) : (description || '').split('.')[0]}`);
  return trimTo(s, f.max, { sentence: true });
}

/* ───────────────────────── validation ───────────────────────── */
export function hasClaim(s, lst) { const t = ` ${String(s).toLowerCase()} `; return lst.some(w => new RegExp(`(^|[\s(,;])${w.replace(/[.*+?^${}()|[\]\%]/g, '\$&')}(?=$|[\s),;.!?])`).test(t)) || (lst === MRP_CLAIM_WORDS && /\d\s*%\s*off/.test(t)); }
export function hasPromo(s) { const l = ` ${String(s).toLowerCase()} `; return PROMO_WORDS.some(p => l.includes(` ${p} `) || l.includes(` ${p},`) || l.includes(` ${p}.`)); }
function stripClaims(s, rules) {
  let out = s;
  const wordsToDrop = new Set([...(rules.includes('noPromo') ? PROMO_WORDS : []), ...(rules.includes('noMrpClaims') ? MRP_CLAIM_WORDS : [])]);
  for (const w of wordsToDrop) { const re = new RegExp(`(^|[\\s(,;])${w.replace(/[.*+?^${}()|[\]\\%]/g, '\\$&')}(?=$|[\\s),;.!?])`, 'gi'); out = out.replace(re, '$1'); }
  return clean(out).replace(/\s+([,.;])/g, '$1');
}

export function validateField(ch, key, value, ctx) {
  const f = ch.fields[key]; const issues = [];
  if (!f) return issues;
  const rules = f.rules || [];
  const push = (level, msg) => issues.push({ level, field: key, msg });
  if (key === 'bullets') {
    const arr = Array.isArray(value) ? value : [];
    if (arr.length < f.count) push(ch.compliance.includes('bulletsAll5') ? 'warn' : 'info', `${f.label}: ${arr.length}/${f.count} filled`);
    arr.forEach((b, i) => { if (b.length > f.maxEach) push('error', `${f.label} ${i + 1}: ${b.length} chars, max ${f.maxEach}`); else if (f.targetEach && b.length < f.targetEach[0]) push('info', `${f.label} ${i + 1}: short (${b.length} < ${f.targetEach[0]})`); if (rules.includes('noPromo') && hasPromo(b)) push('error', `${f.label} ${i + 1}: promotional wording`); if (rules.includes('noMrpClaims') && hasClaim(b, MRP_CLAIM_WORDS)) push('error', `${f.label} ${i + 1}: MRP / discount / guarantee claim`); });
    return issues;
  }
  const s = clean(value);
  const len = f.maxBytes ? bytes(s) : s.length, unit = f.maxBytes ? 'bytes' : 'chars', max = f.maxBytes || f.max;
  if (!s) { push(key === 'title' ? 'error' : 'warn', `${f.label} is empty`); return issues; }
  if (len > max) push('error', `${f.label}: ${len} ${unit}, max ${max}${key === 'title' && ch.id.startsWith('amazon') ? ' — Amazon rewrites longer titles' : ''}`);
  else if (f.min && len < f.min) push('error', `${f.label}: ${len} ${unit}, minimum ${f.min}`);
  else if (f.target && len < f.target[0]) push('info', `${f.label}: ${len} ${unit}, band is ${f.target[0]}–${f.target[1]}`);
  else if (f.target && len > f.target[1]) push('warn', `${f.label}: ${len} ${unit}, past the visible band (${f.target[1]}) though under the limit`);
  if (rules.includes('noPromo') && hasPromo(s)) push('error', `${f.label}: promotional wording (${PROMO_WORDS.filter(p => ` ${s.toLowerCase()} `.includes(` ${p} `)).join(', ')})`);
  if (rules.includes('maxRepeat2')) { const r = Object.entries(countRepeats(s)).filter(e => e[1] > 2); if (r.length) push('error', `${f.label}: "${r[0][0]}" repeated ${r[0][1]} times (max 2)`); }
  if (rules.includes('amazonChars') && /[!$?_{}^¬¦]/.test(s)) push('error', `${f.label}: contains a banned character (! $ ? _ { } ^ ¬ ¦)`);
  if (rules.includes('noAllCaps')) { const caps = s.split(' ').filter(w => /^[A-Z]{4,}$/.test(w) && !ACRONYMS.has(w)); if (caps.length) push('warn', `${f.label}: ALL-CAPS word ${caps[0]}`); }
  if (rules.includes('noSymbols') && /[!@#$%^*_{}[\]<>~`|\\]/.test(s)) push('warn', `${f.label}: symbols are stripped by the platform`);
  if (rules.includes('noMrpClaims') && hasClaim(s, MRP_CLAIM_WORDS)) push('error', `${f.label}: MRP / discount / guarantee claim is a catalogue rejection`);
  if (rules.includes('noUnverifiable') && UNVERIFIABLE.some(w => s.toLowerCase().includes(w))) push('warn', `${f.label}: unverifiable claim wording`);
  if (rules.includes('noSentence') && /[.!?]\s+\p{Lu}/u.test(s)) push('info', `${f.label}: reads like sentences; use short phrases`);
  if (rules.includes('noCommas') && s.includes(',')) push('warn', `${f.label}: use spaces, not commas`);
  if (rules.includes('noPackInTitle') && /\b(\d+\s?(g|gm|gram|grams|kg|ml|l|ltr|litre|pcs|pieces?)|pack of|\d+\s?qty|\d+\s?x\s?\d+\s?x\s?\d+)\b/i.test(s)) push('warn', `${f.label}: weight / pack / full dimensions belong in attributes and highlights, not the title`);
  if ((rules.includes('noTitleWords')) && ctx && ctx.title) { const tw = new Set(contentWords(ctx.title).map(norm)); const dup = contentWords(s).filter(w => tw.has(norm(w))); if (dup.length) push('warn', `${f.label}: repeats title words (${[...new Set(dup)].slice(0, 3).join(', ')})`); }
  if (rules.includes('noBrand') && ctx && ctx.brand && contentWords(s).some(w => norm(w) === norm(ctx.brand))) push('warn', `${f.label}: contains the brand name`);
  return issues;
}

export function validateProduct(product, ch) {
  const p = normalizeProduct(product), issues = [];
  const push = (level, msg, field) => issues.push({ level, field: field || 'product', msg });
  if (!p.sku) push('warn', 'SKU is empty — every sheet needs one', 'sku');
  if (!p.productType) push('error', 'Product type is required', 'productType');
  if (p.images.length < ch.images.min) push('error', `Needs ${ch.images.min} image URL${ch.images.min > 1 ? 's' : ''} (has ${p.images.length})`, 'images');
  else if (p.images.length > ch.images.max) push('info', `${ch.name} shows only the first ${ch.images.max} images`, 'images');
  if (ch.price.requireMRP && p.mrp === '') push('error', 'MRP is required', 'mrp');
  if (p.sellingPrice === '') push('error', 'Selling price is required', 'sellingPrice');
  if (ch.price.sellLteMrp && p.mrp !== '' && p.sellingPrice !== '' && p.sellingPrice > p.mrp) push('error', 'Selling price is above MRP', 'sellingPrice');
  if (ch.price.maxSell && p.sellingPrice !== '' && p.sellingPrice > ch.price.maxSell) push('warn', `${ch.price.maxSellNote || `Above ₹${ch.price.maxSell}`}`, 'sellingPrice');
  const comp = ch.compliance || [];
  if (comp.includes('hsn') && !/^\d{4}(\d{2})?(\d{2})?$/.test(p.hsn)) push('error', 'HSN must be 4, 6 or 8 digits', 'hsn');
  if (comp.includes('gstRate') && ![0, 5, 12, 18, 28, 3, 0.25].includes(p.gst)) push('error', 'GST % must be 0, 3, 5, 12, 18 or 28', 'gst');
  if (comp.includes('gtin') && !p.gtin) push('warn', 'No GTIN/EAN — apply for a GTIN exemption or add the barcode', 'gtin');
  if (comp.includes('manufacturer') && !p.manufacturerName) push('error', 'Manufacturer / packer name is a Legal Metrology declaration', 'manufacturerName');
  if (comp.includes('manufacturer') && p.manufacturerName && !p.manufacturerAddress) push('warn', 'Manufacturer address missing (Legal Metrology needs the full address)', 'manufacturerAddress');
  if (comp.includes('netQuantity') && !p.netQuantity) push('warn', 'Net quantity (e.g. "1 N", "500 g") is a Legal Metrology declaration', 'netQuantity');
  if (comp.includes('countryOfOrigin') && !p.countryOfOrigin) push('error', 'Country of origin is mandatory', 'countryOfOrigin');
  if (comp.includes('consumerCare') && !p.consumerCare) push('warn', 'Consumer care contact (phone/email) is a Legal Metrology declaration', 'consumerCare');
  if (comp.includes('commonName') && !p.productType) push('error', 'Common/generic name of the commodity is required', 'productType');
  if (comp.includes('warranty') && !p.warranty) push('info', 'Warranty summary is empty (Flipkart asks for it)', 'warranty');
  if (p.weightG === '') push('warn', 'Package weight missing — shipping fee tables need it', 'weightG');
  if ([p.lengthCm, p.breadthCm, p.heightCm].some(v => v === '')) push('info', 'Package dimensions incomplete', 'lengthCm');
  return issues;
}

/* ───────────────────────── scoring ───────────────────────── */
export function scoreListing(ch, listing, product, issues, pool) {
  const parts = [];
  const band = (key, val) => {
    const f = ch.fields[key]; if (!f) return null;
    if (key === 'bullets') { const arr = val || []; if (!arr.length) return 0; const ok = arr.filter(b => b.length >= (f.targetEach ? f.targetEach[0] : 1) && b.length <= f.maxEach).length; return (arr.length / f.count) * 0.5 + (ok / Math.max(arr.length, 1)) * 0.5; }
    const len = f.maxBytes ? bytes(val) : String(val || '').length, max = f.maxBytes || f.max;
    if (!len) return 0; if (len > max) return 0.3;
    if (!f.target) return 1; if (len >= f.target[0] && len <= f.target[1]) return 1;
    if (len < f.target[0]) return Math.max(0.35, len / f.target[0]); return 0.8;
  };
  const w = { title: 22, highlights: 10, bullets: 15, description: 13, keywords: 10, metaDescription: 5 };
  let lenScore = 0, lenMax = 0;
  for (const k of Object.keys(w)) { const b = band(k, listing[k]); if (b == null) continue; lenScore += b * w[k]; lenMax += w[k]; }
  parts.push({ name: 'Length bands', got: Math.round(lenScore / lenMax * 40), max: 40 });
  const all = [listing.title, listing.highlights, ...(listing.bullets || []), listing.description, listing.keywords].join(' ').toLowerCase();
  const top = (pool || []).slice(0, 8);
  const covered = top.filter(k => contentWords(k.term).every(wd => all.includes(wd))).length;
  parts.push({ name: 'Keyword coverage', got: top.length ? Math.round(covered / top.length * 20) : 12, max: 20 });
  const errs = issues.filter(i => i.level === 'error').length, warns = issues.filter(i => i.level === 'warn').length;
  parts.push({ name: 'Compliance', got: Math.max(0, 25 - errs * 8 - warns * 3), max: 25 });
  const p = normalizeProduct(product);
  const imgScore = Math.min(1, p.images.length / Math.min(ch.images.max, 5));
  parts.push({ name: 'Images', got: Math.round(imgScore * 10), max: 10 });
  const attrs = ['material', 'colour', 'size', 'weightG', 'hsn', 'manufacturerName'].filter(k => p[k] !== '' && p[k] != null).length;
  parts.push({ name: 'Attributes', got: Math.round(attrs / 6 * 5), max: 5 });
  const total = parts.reduce((s, x) => s + x.got, 0);
  return { total, parts, grade: total >= 85 ? 'A' : total >= 70 ? 'B' : total >= 50 ? 'C' : 'D' };
}

/* ───────────────────────── generation ───────────────────────── */
export function resolveChannel(channel, registry) {
  if (typeof channel === 'string') { const ch = (registry || CHANNEL_MAP)[channel]; if (!ch) throw new Error(`Unknown channel ${channel}`); return ch; }
  return channel;
}

export function generateListing(product, channel, opts = {}) {
  const ch = resolveChannel(channel, opts.registry), p = normalizeProduct(product);
  const pool = keywordPool(p, { suggestions: opts.suggestions || [], boosts: opts.boosts || {} });
  const title = composeTitle(p, ch, pool);
  const highlights = composeHighlights(p, ch, title, pool);
  const bullets = composeBullets(p, ch, pool);
  const description = composeDescription(p, ch, pool, bullets);
  const keywords = composeKeywords(p, ch, title, pool);
  const metaDescription = composeMeta(p, ch, title, bullets, description);
  const listing = { channel: ch.id, title, highlights, bullets, description, keywords, metaDescription, engine: ENGINE_VERSION, generatedAt: new Date().toISOString(), source: 'rules' };
  return finishListing(ch, listing, p, pool);
}

export function finishListing(ch, listing, product, pool) {
  const p = normalizeProduct(product);
  const ctx = { title: listing.title, brand: p.brand };
  const issues = [...validateProduct(p, ch)];
  for (const k of Object.keys(ch.fields)) issues.push(...validateField(ch, k, listing[k], ctx));
  listing.issues = issues;
  listing.score = scoreListing(ch, listing, p, issues, pool || keywordPool(p));
  listing.pool = (pool || []).slice(0, 20).map(k => ({ term: k.term, weight: +k.weight.toFixed(2), sources: k.sources }));
  return listing;
}

/* Hard-limit enforcement for AI output (or hand edits). Never throws; always returns channel-legal text. */
export function enforceLimits(channel, draft, product) {
  const ch = resolveChannel(channel), out = { ...draft };
  for (const [k, f] of Object.entries(ch.fields)) {
    if (k === 'bullets') { out.bullets = (Array.isArray(out.bullets) ? out.bullets : list(out.bullets)).map(b => trimTo(clean(b), f.maxEach, { sentence: true })).filter(Boolean).slice(0, f.count); continue; }
    let v = clean(out[k]);
    if (f.rules && f.rules.includes('amazonChars')) v = v.replace(/[!$?_{}^¬¦]/g, '');
    if (f.rules && (f.rules.includes('noPromo') || f.rules.includes('noMrpClaims'))) v = stripClaims(v, f.rules);
    v = f.maxBytes ? trimBytes(v, f.maxBytes) : trimTo(v, f.max, { sentence: k === 'description' });
    if (k === 'highlights' && f.sep && f.sep !== ' ') { // drop whole phrases past the limit
      const phrases = v.split(f.sep.trim()).map(clean).filter(Boolean); let acc = [];
      for (const ph of phrases) { const next = [...acc, ph].join(f.sep); if (next.length > f.max) break; acc.push(ph); }
      v = acc.join(f.sep);
    }
    out[k] = v;
  }
  return out;
}

/* ───────────────────────── performance loop ───────────────────────── */
/* records: [{channel, listingId, version, title, impressions, clicks, orders}] */
export function boostFromPerformance(records) {
  const rows = (records || []).filter(r => r.impressions > 0);
  if (rows.length < 2) return { boosts: {}, insights: rows.length ? ['Log at least two rows (two versions or two channels) to compare.'] : [] };
  const ctr = r => r.clicks / r.impressions, cvr = r => r.clicks ? (r.orders || 0) / r.clicks : 0;
  const med = arr => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const medCtr = rows.reduce((s, r) => s + r.clicks, 0) / rows.reduce((s, r) => s + r.impressions, 0), boosts = {}, insights = [];
  const wordStats = {};
  for (const r of rows) {
    const lift = medCtr ? (ctr(r) - medCtr) / medCtr : 0;
    for (const w of new Set(contentWords(r.title).map(norm))) { const s = wordStats[w] || (wordStats[w] = { n: 0, lift: 0 }); s.n++; s.lift += lift; }
  }
  for (const [w, s] of Object.entries(wordStats)) { if (s.n >= 1 && Math.abs(s.lift) > 0.05) boosts[w] = +Math.max(-3, Math.min(4, s.lift * 4)).toFixed(2); }
  const best = [...rows].sort((a, b) => ctr(b) - ctr(a))[0];
  insights.push(`Best CTR so far: ${(ctr(best) * 100).toFixed(2)}% on ${best.channel}${best.version ? ` (version ${best.version})` : ''}: "${best.title}"`);
  const winners = Object.entries(boosts).filter(e => e[1] > 0.5).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
  const losers = Object.entries(boosts).filter(e => e[1] < -0.5).sort((a, b) => a[1] - b[1]).slice(0, 5).map(e => e[0]);
  if (winners.length) insights.push(`Words that ride with higher CTR: ${winners.join(', ')} — the composer now ranks them earlier.`);
  if (losers.length) insights.push(`Words in the weaker titles: ${losers.join(', ')} — moved later or dropped.`);
  const lowCvr = rows.filter(r => r.clicks >= 20 && cvr(r) < 0.02);
  if (lowCvr.length) insights.push(`${lowCvr.length} row(s) get clicks but few orders — a price, image or bullet problem rather than a title problem.`);
  return { boosts, insights, medianCtr: medCtr };
}

/* ───────────────────────── export rows ───────────────────────── */
export function fmtWeight(g) { g = parseFloat(g); if (isNaN(g)) return ''; return g >= 1000 ? `${+(g / 1000).toFixed(2)} kg` : `${g} g`; }
const taxCode = g => { g = parseFloat(g); return isNaN(g) ? '' : `GST_${g === 0.25 ? '0_25' : g}`; };
const details = (n, a) => [n, a].filter(Boolean).join(', ');
const nq = s => { const m = String(s || '').match(/^\s*([\d.]+)\s*([a-zA-Z]+)?/); return m ? { v: m[1], u: (m[2] || 'count').toLowerCase() } : { v: '', u: '' }; };
const slug = s => clean(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function resolveExportField(key, ctx) {
  const { product: p, listing: L, variant: v } = ctx;
  if (key.startsWith('const:')) return key.slice(6);
  const img = i => (p.images[i] && (p.images[i].url || '')) || '';
  const bl = L.bullets || [];
  const V = v || {};
  switch (key) {
    case 'sku': return V.sku || p.sku;
    case 'brand': return p.brand;
    case 'title': return L.title;
    case 'highlights': return L.highlights || '';
    case 'metaDescription': return L.metaDescription || '';
    case 'description': return L.description;
    case 'descriptionWithBullets': return [L.description, bl.length ? 'Highlights:\n' + bl.map(b => `• ${b}`).join('\n') : ''].filter(Boolean).join('\n\n');
    case 'descriptionHtml': return `<p>${L.description.split('\n\n').join('</p><p>')}</p>${bl.length ? `<ul>${bl.map(b => `<li>${b}</li>`).join('')}</ul>` : ''}`;
    case 'bullet1': case 'bullet2': case 'bullet3': case 'bullet4': case 'bullet5': return bl[+key.slice(-1) - 1] || '';
    case 'bulletsJoined': return bl.join('\n');
    case 'bulletsPipe': return bl.join(' | ');
    case 'keywords': return L.keywords || '';
    case 'keywordsComma': return (L.keywords || '').split(/[\s,]+/).filter(Boolean).join(', ');
    case 'sellingPrice': return V.sellingPrice != null && V.sellingPrice !== '' ? V.sellingPrice : p.sellingPrice;
    case 'mrp': return V.mrp != null && V.mrp !== '' ? V.mrp : p.mrp;
    case 'stock': return V.stock != null && V.stock !== '' ? V.stock : p.stock;
    case 'image1': case 'image2': case 'image3': case 'image4': case 'image5': case 'image6': case 'image7': case 'image8': case 'image9': return (V.image && +key.slice(-1) === 1) ? V.image : img(+key.slice(-1) - 1);
    case 'imagesPipe': return p.images.map(i => i.url).filter(Boolean).join('|');
    case 'imagesComma': return p.images.map(i => i.url).filter(Boolean).join(', ');
    case 'colour': return V.colour || p.colour;
    case 'size': return V.size || p.size;
    case 'material': return p.material;
    case 'packSize': return p.packSize;
    case 'netQuantity': return p.netQuantity;
    case 'netQuantityValue': return nq(p.netQuantity).v || p.packSize;
    case 'netQuantityUnit': return nq(p.netQuantity).u || 'count';
    case 'countryOfOrigin': return p.countryOfOrigin;
    case 'hsn': return p.hsn;
    case 'gst': return p.gst;
    case 'taxCode': return taxCode(p.gst);
    case 'weightG': return p.weightG;
    case 'weightKg': return p.weightG === '' ? '' : +(p.weightG / 1000).toFixed(3);
    case 'lengthCm': return p.lengthCm; case 'breadthCm': return p.breadthCm; case 'heightCm': return p.heightCm;
    case 'warranty': return p.warranty;
    case 'gtin': return V.gtin || p.gtin;
    case 'gtinType': return (V.gtin || p.gtin) ? (p.gtinType || 'EAN') : '';
    case 'manufacturerName': return p.manufacturerName; case 'manufacturerAddress': return p.manufacturerAddress;
    case 'manufacturerDetails': return details(p.manufacturerName, p.manufacturerAddress);
    case 'packerName': return p.packerName || p.manufacturerName; case 'packerAddress': return p.packerAddress || p.manufacturerAddress;
    case 'packerDetails': return details(p.packerName || p.manufacturerName, p.packerAddress || p.manufacturerAddress);
    case 'importerDetails': return details(p.importerName, p.importerAddress);
    case 'partNumber': return p.partNumber || p.model || p.sku;
    case 'model': return p.model;
    case 'productType': return p.productType;
    case 'feedProductType': return slug(p.subcategory || p.category || p.productType).replace(/-/g, '');
    case 'category': return p.category; case 'subcategory': return p.subcategory;
    case 'salesPackage': return `${p.packSize} ${p.productType}`;
    case 'handle': return slug(`${p.brand} ${p.productType} ${V.colour || p.colour} ${V.size || p.size}`);
    default: return '';
  }
}

/* One row per variant (or one row when there are none). */
export function buildExportRows(channel, product, listing, registry) {
  const ch = resolveChannel(channel, registry), spec = exportSpec(ch, registry), p = normalizeProduct(product);
  const variants = p.variants.length ? p.variants : [null];
  const rows = variants.map(v => spec.map.map(k => resolveExportField(k, { product: p, listing, variant: v })));
  return { headerRow: spec.headerRow, rows, format: spec.format, sheet: spec.sheet || 'Sheet1' };
}

export function toCsv(headerRow, rows) {
  const esc = v => { const s = String(v == null ? '' : v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return '﻿' + [headerRow, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
}

/* ───────────────────────── sample product ───────────────────────── */
export const SAMPLE_PRODUCT = {
  sku: 'IBI-STRN-27', brand: 'iINTELLIGENCEi', productType: 'Food Strainer Colander', category: 'Kitchen', subcategory: 'Kitchen Tools', material: 'Aluminium', colour: 'Silver', size: '27 cm',
  keyFeatures: ['Fine mesh drains rice, pasta and vegetables fast', 'Riveted handle stays cool on the stove', 'Rust-free food-grade aluminium'], useCases: ['rice washing', 'pasta draining', 'vegetable rinsing'], audience: 'home kitchens',
  lengthCm: 27, breadthCm: 27, heightCm: 7.5, weightG: 198, netQuantity: '1 N', packSize: 1, certifications: ['BIS'], warranty: '6 months manufacturing warranty', care: 'Rinse and dry after use; dishwasher safe',
  countryOfOrigin: 'India', manufacturerName: 'CPM Metals', manufacturerAddress: 'Coimbatore, Tamil Nadu 641001', consumerCare: '+91 8939414799 / indiabusinessinternational@gmail.com', mrp: 499, sellingPrice: 349, gst: 12, hsn: '761510', stock: 40,
  images: [{ url: 'https://www.indiabusinessinternational.online/images/strainer-1.jpg', alt: 'Aluminium food strainer front' }, { url: 'https://www.indiabusinessinternational.online/images/strainer-2.jpg', alt: 'Strainer with rice' }],
  keywords: ['rice chalni', 'strainer for kitchen', 'colander steel', 'chana strainer', 'pasta strainer'], notes: 'Made by a BIS-licensed foundry in Coimbatore; the mesh is pressed, not welded, so there are no rough edges.',
  variants: [],
};
