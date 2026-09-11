import test from 'node:test';
import assert from 'node:assert/strict';
import { CHANNELS, CHANNEL_MAP, exportSpec, blankChannel } from '../app/channels.js';
import { generateListing, enforceLimits, boostFromPerformance, buildExportRows, toCsv, keywordPool, bytes, SAMPLE_PRODUCT, normalizeProduct, hasPromo } from '../app/engine.js';

const P = SAMPLE_PRODUCT;

test('every channel generates a listing inside its hard limits', () => {
  for (const ch of CHANNELS) {
    const L = generateListing(P, ch.id);
    const f = ch.fields;
    assert.ok(L.title.length > 0, `${ch.id} title empty`);
    assert.ok(L.title.length <= f.title.max, `${ch.id} title ${L.title.length} > ${f.title.max}: ${L.title}`);
    if (f.title.min) assert.ok(L.title.length >= f.title.min, `${ch.id} title ${L.title.length} < min ${f.title.min}: ${L.title}`);
    if (f.highlights) assert.ok(L.highlights.length <= f.highlights.max, `${ch.id} highlights ${L.highlights.length}`);
    if (f.bullets) { assert.ok(L.bullets.length <= f.bullets.count); for (const b of L.bullets) assert.ok(b.length <= f.bullets.maxEach, `${ch.id} bullet too long: ${b}`); }
    if (f.description) assert.ok(L.description.length <= f.description.max, `${ch.id} description ${L.description.length}`);
    if (f.keywords) assert.ok(bytes(L.keywords) <= f.keywords.maxBytes, `${ch.id} keywords ${bytes(L.keywords)}`);
    const errs = L.issues.filter(i => i.level === 'error');
    assert.equal(errs.length, 0, `${ch.id} errors: ${errs.map(e => e.msg).join(' | ')}`);
    assert.ok(L.score.total >= 60, `${ch.id} score ${L.score.total}`);
  }
});

test('Amazon title obeys the 75-char policy and fills the band', () => {
  const L = generateListing(P, 'amazon_in');
  assert.ok(L.title.length <= 75 && L.title.length >= 60, L.title);
  assert.ok(!/198|pack of|27x27x7\.5/i.test(L.title), 'weight/pack/dims must not be in the title: ' + L.title);
  assert.ok(L.highlights.length <= 125 && L.highlights.length >= 90, L.highlights);
  const tw = new Set(L.title.toLowerCase().split(/\W+/));
  for (const w of L.highlights.toLowerCase().split(/[^a-z0-9]+/)) if (w.length > 3) assert.ok(!tw.has(w) || ['with', 'for', 'and'].includes(w), `highlight repeats title word "${w}"`);
  assert.ok(!L.keywords.includes(','), 'generic keywords are space separated');
  assert.ok(!L.keywords.toLowerCase().includes('iintelligencei'), 'no brand in generic keywords');
  assert.equal(L.bullets.length, 5);
});

test('Meesho has no keyword field and no MRP claims', () => {
  const L = generateListing(P, 'meesho');
  assert.equal(L.keywords, '');
  assert.ok(!/guarantee|discount|mrp/i.test(L.description), L.description);
  assert.ok(L.title.length >= 50 && L.title.length <= 120);
});

test('promo words are stripped and flagged', () => {
  const p = { ...P, keyFeatures: ['Best quality mesh, free shipping guaranteed'], notes: 'Cheapest strainer on sale today.' };
  const L = generateListing(p, 'amazon_in');
  assert.ok(!hasPromo(L.description), L.description);
  for (const b of L.bullets) assert.ok(!hasPromo(b), b);
  const draft = enforceLimits('amazon_in', { title: 'Best Cheap Strainer! Buy Now $$$ ' + 'x'.repeat(100), bullets: ['a'.repeat(400)], description: 'ok', keywords: 'k '.repeat(300) }, p);
  assert.ok(draft.title.length <= 75 && !/[!$]/.test(draft.title) && !/best|cheap/i.test(draft.title), draft.title);
  assert.ok(draft.bullets[0].length <= 250);
  assert.ok(bytes(draft.keywords) <= 249);
});

test('missing compliance data is reported as errors', () => {
  const p = { ...P, hsn: '', mrp: '', images: [] };
  const L = generateListing(p, 'flipkart');
  const msgs = L.issues.filter(i => i.level === 'error').map(i => i.msg).join(' | ');
  assert.match(msgs, /HSN/); assert.match(msgs, /MRP/); assert.match(msgs, /image/);
});

test('export rows follow each channel sheet, variants expand to rows', () => {
  const p = { ...P, variants: [{ sku: 'IBI-STRN-27-S', colour: 'Silver', size: '27 cm', stock: 20 }, { sku: 'IBI-STRN-22-S', colour: 'Silver', size: '22 cm', stock: 10, sellingPrice: 299 }] };
  for (const ch of CHANNELS) {
    const L = generateListing(p, ch.id);
    const X = buildExportRows(ch.id, p, L);
    assert.equal(X.headerRow.length, exportSpec(ch).map.length, `${ch.id} header/map length mismatch`);
    assert.equal(X.rows.length, 2);
    for (const r of X.rows) assert.equal(r.length, X.headerRow.length);
  }
  const ibi = buildExportRows('ibi', p, generateListing(p, 'ibi'));
  assert.equal(ibi.headerRow[0], 'Product Title');
  assert.equal(ibi.rows[1][8], 'IBI-STRN-22-S');
  assert.equal(ibi.rows[1][12], 299);
  const csv = toCsv(ibi.headerRow, ibi.rows);
  assert.ok(csv.charCodeAt(0) === 0xFEFF, 'CSV carries a BOM for Excel');
  const shopsy = buildExportRows('shopsy', p, generateListing(p, 'shopsy'));
  assert.equal(shopsy.headerRow[0], 'Seller SKU ID', 'Shopsy inherits the Flipkart sheet');
});

test('performance loop boosts words from higher-CTR titles', () => {
  const r = boostFromPerformance([
    { channel: 'amazon_in', version: 1, title: 'Aluminium Food Strainer Colander BIS 27 cm', impressions: 1000, clicks: 20 },
    { channel: 'amazon_in', version: 2, title: 'Rice Chalni Strainer Colander 27 cm Kitchen', impressions: 1000, clicks: 45 },
  ]);
  assert.ok(r.boosts.chalni > 0, JSON.stringify(r.boosts));
  assert.ok(r.boosts.aluminium < 0);
  const L = generateListing(P, 'amazon_in', { boosts: r.boosts });
  assert.ok(/chalni/i.test(L.title), 'boosted keyword reaches the title: ' + L.title);
});

test('live suggestions enter the pool ranked high', () => {
  const pool = keywordPool(P, { suggestions: ['strainer for rice', 'steel chalni big'] });
  assert.ok(pool.slice(0, 5).some(k => k.sources.includes('live')));
});

test('custom channel scaffold generates', () => {
  const c = blankChannel('mychan'); c.name = 'My Shop';
  const L = generateListing(P, c);
  assert.ok(L.title.length <= c.fields.title.max);
});

test('normalizeProduct tolerates strings and junk', () => {
  const n = normalizeProduct({ keyFeatures: 'a|b, c', images: 'https://x/1.jpg, https://x/2.jpg', mrp: '499', packSize: '0' });
  assert.deepEqual(n.keyFeatures, ['a', 'b', 'c']); assert.equal(n.images.length, 2); assert.equal(n.mrp, 499); assert.equal(n.packSize, 1);
});
