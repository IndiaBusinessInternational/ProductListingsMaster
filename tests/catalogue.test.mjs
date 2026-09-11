/* Taxonomy, SKU derivation, GST 2.0 slabs, HSN suggestion and the MRP rule. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { TAXONOMY, CATEGORY_NAMES, subsFor, isKnownCategory, isKnownSub, guessCategory, GST_RATES, GST_VALUES, GST_WITHDRAWN, suggestHsn } from '../app/taxonomy.js';
import { deriveSku, deriveVariantSku, generateListing, GST_VALID, SAMPLE_PRODUCT } from '../app/engine.js';
import { isIbiWorkspace, matchStock } from '../app/ibistock.js';

test('the taxonomy is well formed and every sub-category is unique in its category', () => {
  assert.ok(CATEGORY_NAMES.length >= 20);
  const seen = new Set();
  for (const c of TAXONOMY) {
    assert.ok(c.name && c.subs.length >= 3, c.name); // 3 is fine for a thin department; padding a list to hit a number helps nobody
    assert.ok(!seen.has(c.name), 'duplicate category ' + c.name); seen.add(c.name);
    assert.equal(new Set(c.subs).size, c.subs.length, 'duplicate sub in ' + c.name);
  }
  assert.deepEqual(subsFor('Nothing Like This'), []);
  assert.ok(subsFor('Home & Kitchen').includes('Cookware'));
  assert.ok(isKnownCategory('home & kitchen'), 'category match is case-insensitive');
  assert.ok(isKnownSub('Jewellery', 'earrings'));
});

test('GST 2.0 slabs: 12% is gone, 40% exists, 3% and 0.25% survive', () => {
  assert.ok(!GST_VALUES.includes(12), '12% must not be offered');
  assert.deepEqual(GST_WITHDRAWN, [12]);
  for (const v of [0, 0.25, 3, 5, 18, 40]) assert.ok(GST_VALUES.includes(v), v + ' must be offered');
  assert.ok(GST_VALUES.includes(28), '28% survives for tobacco and pan masala');
  assert.ok(GST_RATES.find(r => r.v === 28).label.toLowerCase().includes('tobacco'), '28% must say what it is for');
  assert.ok(!GST_VALID.includes(12));
});

test('a 12% product is rejected with the reason, 40% is accepted', () => {
  const bad = generateListing({ ...SAMPLE_PRODUCT, gst: 12 }, 'flipkart').issues.filter(i => i.field === 'gst');
  assert.equal(bad.length, 1);
  assert.match(bad[0].msg, /withdrawn on 22 Sep 2025/);
  assert.equal(bad[0].level, 'error');
  assert.equal(generateListing({ ...SAMPLE_PRODUCT, gst: 40 }, 'flipkart').issues.filter(i => i.field === 'gst').length, 0);
  assert.equal(generateListing({ ...SAMPLE_PRODUCT, gst: 5 }, 'flipkart').issues.filter(i => i.field === 'gst').length, 0);
});

test('SKU is derived from what the seller already typed', () => {
  assert.equal(deriveSku(SAMPLE_PRODUCT), 'IINT-FSC-ALM-27CM-SLV');
  assert.ok(!deriveSku({ ...SAMPLE_PRODUCT, brand: 'Generic' }).startsWith('GENERIC'), 'an unbranded product gets no brand prefix');
  assert.equal(deriveSku({}), '', 'nothing to derive from gives nothing, not junk');
  assert.ok(deriveSku(SAMPLE_PRODUCT).length <= 40);
  assert.match(deriveSku({ productType: 'Cotton Kurti', colour: 'Blue', size: 'XL' }), /^[A-Z0-9-]+$/);
  const packed = deriveSku({ ...SAMPLE_PRODUCT, packSize: 4 });
  assert.ok(packed.endsWith('-P4'), 'a multi-pack is visible in the code: ' + packed);
});

test('variant SKUs replace the parent colour and size, never stack them', () => {
  const a = deriveVariantSku(SAMPLE_PRODUCT, { colour: 'Silver', size: '22 cm' }, 0);
  assert.equal((a.match(/SLV/g) || []).length, 1, 'colour appears once: ' + a);
  assert.ok(a.includes('22CM') && !a.includes('27CM'), a);
  assert.notEqual(a, deriveVariantSku(SAMPLE_PRODUCT, { colour: 'Black', size: '27 cm' }, 1));
  assert.ok(deriveVariantSku(SAMPLE_PRODUCT, {}, 2).endsWith('-03'), 'a variant with no options still gets a unique tail');
});

test('HSN follows the sub-category and shifts with the material', () => {
  assert.equal(suggestHsn({ subcategory: 'Cookware', material: 'Aluminium' }).hsn, '7615');
  assert.equal(suggestHsn({ subcategory: 'Cookware', material: 'Stainless Steel' }).hsn, '7323');
  assert.equal(suggestHsn({ subcategory: 'Earrings', material: 'Brass' }).hsn, '7117', 'imitation jewellery');
  assert.equal(suggestHsn({ subcategory: 'Earrings', material: 'Silver' }).hsn, '7113', 'precious metal');
  assert.equal(suggestHsn({ subcategory: 'Rice & Grains' }).gst, 5, 'a settled rate is prefilled');
  assert.equal(suggestHsn({ subcategory: 'Cookware', material: 'Aluminium' }).gst, '', 'an unsettled rate is left blank on purpose');
  assert.equal(suggestHsn({ category: 'Toys & Games' }).hsn, '9503', 'falls back to the category');
  assert.equal(suggestHsn({}), null);
  for (const c of TAXONOMY) for (const sub of c.subs) {
    const g = suggestHsn({ category: c.name, subcategory: sub });
    assert.ok(g && /^\d{4}$/.test(g.hsn), `${c.name} / ${sub} has no 4-digit HSN`);
  }
});

test('an imported row gets a taxonomy guess', () => {
  assert.deepEqual(guessCategory('Aluminium Food Strainer Colander kitchen'), { category: 'Home & Kitchen', subcategory: 'Kitchen & Dining' });
  assert.equal(guessCategory('zzzz qqqq'), null, 'no match is null, not a wrong guess');
});

test('the IBI stock link is gated to IBI, and matching is honest about doubt', () => {
  assert.ok(isIbiWorkspace({ business: { brand: 'iINTELLIGENCEi' } }));
  assert.ok(isIbiWorkspace({ business: { brand: '', manufacturerName: 'India Business International' } }));
  assert.ok(!isIbiWorkspace({ business: { brand: 'WUGO' } }), 'a paying customer must not see it');
  assert.ok(!isIbiWorkspace({}));
  const items = [
    { product: 'Aluminium Food Strainer, 27 cm', packed: 3, loose: 2, total: 5, hsn: '7615', n: 'aluminium food strainer 27 cm', t: ['aluminium', 'food', 'strainer', '27', 'cm'] },
    { product: 'Aluminium Bucket 11.5 Liters', packed: 1, loose: 0, total: 1, hsn: '', n: 'aluminium bucket 11 5 liters', t: ['aluminium', 'bucket', '11', 'liters'] },
  ];
  assert.equal(matchStock(items, 'Aluminium Food Strainer, 27 cm').kind, 'exact');
  assert.equal(matchStock(items, 'aluminium food strainer 27 cm!!').kind, 'exact', 'punctuation does not break the match');
  assert.equal(matchStock(items, 'Aluminium').kind, 'weak', 'a vague name asks rather than guesses');
  assert.equal(matchStock(items, 'Silk Saree').kind, 'none');
  assert.equal(matchStock([], 'anything').kind, 'none');
});
