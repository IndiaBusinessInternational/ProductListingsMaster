/* IBI Product Listings Master — product taxonomy (category → sub-category)
 *
 * SOURCE: the department names are Amazon.in's own, read from the live site on
 * 11 Sep 2026 (the "All Categories" search scope on amazon.in). Departments that a
 * third-party seller of physical goods cannot list in are left out — Alexa Skills,
 * Amazon Devices, Amazon Fresh, Amazon Pharmacy, Apps & Games, Audible, Collectibles,
 * Deals, Gift Cards, Kindle Store, MP3 Music, Prime Video, Subscribe & Save, Under ₹500.
 *
 * Sub-categories are the PRODUCT-TYPE level, because that is what drives the keyword
 * pool and what Flipkart, Meesho and ShopClues ask for. Amazon's own level 2 is used
 * where it is already product-type shaped (Home & Kitchen and Jewellery were read from
 * the live refinement panel); where Amazon's level 2 is a gender split (Clothing,
 * Shoes), the product-type level below it is used instead.
 *
 * ⚠ This is a two-level working taxonomy, not a mirror of Amazon's full browse tree —
 * every marketplace maps categories differently, so the seller still picks the exact
 * node inside each seller panel. Keep it that way; deeper here is false precision.
 */

export const TAXONOMY_VERSION = '2026-09-11';
export const OTHER = '__other__';

export const TAXONOMY = [
  { name: 'Home & Kitchen', subs: ['Kitchen & Dining', 'Cookware', 'Bakeware', 'Tableware & Serveware', 'Kitchen Tools & Gadgets', 'Kitchen Storage & Containers', 'Water Bottles & Flasks', 'Home & Décor', 'Home Furnishing', 'Bath', 'Bedding & Linen', 'Curtains & Accessories', 'Home Storage & Organisation', 'Cleaning Supplies', 'Indoor Lighting', 'Artwork', 'Craft Materials', 'Religious & Spiritual Items', 'Heating, Cooling & Air Quality'] },
  { name: 'Kitchen & Home Appliances', subs: ['Small Kitchen Appliances', 'Mixers & Grinders', 'Induction Cooktops & Stoves', 'Water Purifiers', 'Vacuum Cleaners', 'Irons & Garment Care', 'Fans', 'Air Coolers & Purifiers', 'Large Appliances'] },
  { name: 'Clothing & Accessories', subs: ['Men Topwear', 'Men Bottomwear', 'Men Innerwear & Sleepwear', 'Women Ethnic Wear', 'Women Western Wear', 'Women Innerwear & Sleepwear', 'Sarees & Dress Material', 'Kurtas & Kurtis', 'Kids Clothing', 'Winterwear', 'Sportswear & Activewear', 'Fashion Accessories', 'Belts, Wallets & Caps', 'Stoles, Scarves & Dupattas'] },
  { name: 'Jewellery', subs: ['Earrings', 'Necklaces & Chains', 'Bangles & Bracelets', 'Rings', 'Anklets & Toe Rings', 'Mangalsutra', 'Nose Pins', 'Jewellery Sets', 'Hair Jewellery', 'Men Jewellery', 'Kids Jewellery', 'Jewellery Storage & Accessories'] },
  { name: 'Shoes & Handbags', subs: ['Men Footwear', 'Women Footwear', 'Kids Footwear', 'Sports Shoes', 'Sandals & Floaters', 'Slippers & Flip-Flops', 'Formal Shoes', 'Casual Shoes', 'Handbags & Clutches', 'Backpacks', 'Wallets & Card Holders', 'Shoe Care & Accessories'] },
  { name: 'Beauty & Personal Care', subs: ['Skin Care', 'Hair Care', 'Bath & Body', 'Make-up', 'Fragrances', 'Men Grooming', 'Oral Care', 'Beauty Tools & Accessories', 'Ayurveda & Natural Care'] },
  { name: 'Health & Personal Care', subs: ['Vitamins & Supplements', 'Ayurvedic & Herbal Products', 'Health Monitors & Devices', 'Medical Supplies', 'Sexual Wellness', 'Baby & Child Care', 'Personal Care Appliances', 'Mobility & Daily Living Aids'] },
  { name: 'Grocery & Gourmet Foods', subs: ['Rice & Grains', 'Pulses & Dals', 'Flours & Atta', 'Spices & Masalas', 'Cooking Oils & Ghee', 'Dry Fruits & Nuts', 'Snacks & Namkeen', 'Tea, Coffee & Beverages', 'Sweeteners, Jaggery & Honey', 'Pickles, Chutneys & Pastes', 'Ready to Cook & Eat', 'Bakery & Breakfast', 'Organic & Natural Foods'] },
  { name: 'Sports, Fitness & Outdoors', subs: ['Fitness Equipment', 'Yoga & Exercise Accessories', 'Cricket', 'Badminton & Racquet Sports', 'Football & Team Sports', 'Cycling', 'Camping & Hiking', 'Swimming', 'Sports Nutrition', 'Sports Accessories'] },
  { name: 'Toys & Games', subs: ['Learning & Educational Toys', 'Soft Toys', 'Dolls & Action Figures', 'Building & Construction Toys', 'Puzzles & Board Games', 'Remote Control & Play Vehicles', 'Outdoor Play & Ride-Ons', 'Arts & Crafts for Kids', 'Baby & Toddler Toys', 'Party Supplies'] },
  { name: 'Baby', subs: ['Diapers & Wipes', 'Baby Feeding', 'Baby Bath & Skin Care', 'Baby Clothing', 'Strollers & Prams', 'Cribs, Bedding & Furniture', 'Baby Safety', 'Baby Health Care'] },
  { name: 'Garden & Outdoors', subs: ['Plants & Seeds', 'Pots & Planters', 'Fertilisers & Soil', 'Gardening Tools', 'Watering & Irrigation', 'Pest Control', 'Outdoor Furniture', 'Outdoor Lighting & Décor'] },
  { name: 'Tools & Home Improvement', subs: ['Hand Tools', 'Power Tools', 'Tool Kits & Sets', 'Hardware & Fasteners', 'Electrical & Wiring', 'Plumbing & Sanitary', 'Paints & Painting Supplies', 'Safety & Security', 'Measuring & Layout Tools', 'Adhesives & Sealants'] },
  { name: 'Office Products', subs: ['Paper & Notebooks', 'Pens & Writing Instruments', 'Office Supplies & Organisers', 'Files & Folders', 'School Supplies', 'Art & Drawing Supplies', 'Printers & Ink', 'Calculators', 'Labels, Tapes & Packaging'] },
  { name: 'Pet Supplies', subs: ['Dog Food & Treats', 'Cat Food & Treats', 'Pet Grooming', 'Pet Bowls & Feeders', 'Pet Beds & Furniture', 'Collars, Leashes & Harnesses', 'Pet Toys', 'Aquarium & Fish Supplies', 'Bird Supplies'] },
  { name: 'Electronics', subs: ['Mobile Phones', 'Mobile Accessories', 'Headphones & Earphones', 'Speakers & Home Audio', 'Cameras & Photography', 'Televisions', 'Smart Watches & Wearables', 'Power Banks & Chargers', 'Cables & Adapters', 'Home Entertainment Accessories'] },
  { name: 'Computers & Accessories', subs: ['Laptops', 'Desktops & Monitors', 'Computer Accessories', 'Keyboards & Mice', 'Storage & Pen Drives', 'Networking Devices', 'Components', 'Printers & Scanners', 'Laptop Bags & Sleeves'] },
  { name: 'Furniture', subs: ['Living Room Furniture', 'Bedroom Furniture', 'Kitchen & Dining Furniture', 'Office Furniture', 'Kids Furniture', 'Outdoor Furniture', 'Mattresses', 'Shoe Racks & Wardrobes'] },
  { name: 'Luggage & Bags', subs: ['Suitcases & Trolley Bags', 'Backpacks', 'Duffel & Travel Bags', 'Laptop Bags', 'School Bags', 'Travel Accessories', 'Shopping & Tote Bags'] },
  { name: 'Car & Motorbike', subs: ['Car Accessories', 'Car Care & Cleaning', 'Bike Accessories', 'Helmets & Riding Gear', 'Car & Bike Spare Parts', 'Car Electronics', 'Oils & Lubricants', 'Tyres & Rims'] },
  { name: 'Watches', subs: ['Men Watches', 'Women Watches', 'Kids Watches', 'Smart Watches', 'Watch Straps & Accessories'] },
  { name: 'Musical Instruments', subs: ['Guitars & Strings', 'Keyboards & Pianos', 'Indian Classical Instruments', 'Percussion & Drums', 'Wind Instruments', 'Studio & Recording Equipment', 'Instrument Accessories'] },
  { name: 'Industrial & Scientific', subs: ['Industrial Tools & Equipment', 'Lab & Scientific Supplies', 'Safety Equipment & PPE', 'Packaging & Shipping Supplies', 'Material Handling', 'Test & Measurement', 'Janitorial & Sanitation', 'Agricultural Equipment'] },
  { name: 'Books', subs: ['Academic & Textbooks', 'Exam Preparation', 'Fiction', 'Non-fiction', 'Children Books', 'Regional Language Books', 'Comics & Graphic Novels'] },
  { name: 'Video Games', subs: ['Consoles', 'Games', 'Controllers & Accessories', 'Gaming Merchandise'] },
  { name: 'Movies & Music', subs: ['Movies & TV Shows', 'Music CDs & Vinyl', 'Musical Media Accessories'] },
];

export const CATEGORY_NAMES = TAXONOMY.map(c => c.name);
const BY_NAME = Object.fromEntries(TAXONOMY.map(c => [c.name.toLowerCase(), c]));

/* Sub-categories for a category name. Unknown or custom category → []. */
export function subsFor(category) {
  const c = BY_NAME[String(category || '').trim().toLowerCase()];
  return c ? c.subs : [];
}
export const isKnownCategory = c => !!BY_NAME[String(c || '').trim().toLowerCase()];
export function isKnownSub(category, sub) {
  return subsFor(category).some(s => s.toLowerCase() === String(sub || '').trim().toLowerCase());
}

/* Best-guess category for an imported product, so a bulk import is not left blank.
 * Matches the product type and existing free-text category against the taxonomy. */
export function guessCategory(text) {
  const t = ' ' + String(text || '').toLowerCase() + ' ';
  let best = null, bestScore = 0;
  for (const c of TAXONOMY) {
    for (const s of c.subs) {
      const words = s.toLowerCase().split(/[^a-z]+/).filter(w => w.length > 3);
      const hit = words.filter(w => t.includes(w)).length;
      if (hit > bestScore) { bestScore = hit; best = { category: c.name, subcategory: s }; }
    }
    const cw = c.name.toLowerCase().split(/[^a-z]+/).filter(w => w.length > 3);
    const chit = cw.filter(w => t.includes(w)).length;
    if (chit > bestScore) { bestScore = chit; best = { category: c.name, subcategory: '' }; }
  }
  return bestScore ? best : null;
}

/* ── GST slabs ───────────────────────────────────────────────────────────────
 * GST 2.0, in force from 22 September 2025 (56th GST Council). The 12% and 28%
 * GENERAL slabs were withdrawn — items moved to 5% or 18% — and a 40% demerit rate was
 * added for luxury and sin goods. 3% (gold, silver, jewellery) and 0.25% (rough
 * diamonds) were retained. 28% survives ONLY for tobacco and pan masala pending
 * notification, so it is offered but labelled; 12% is offered nowhere.
 * Verified 11 Sep 2026 against cleartax.in/s/gst-rates and the GST 2.0 coverage. */
export const GST_RATES = [
  { v: 0, label: '0% — nil rated (fresh produce, books, most dairy)' },
  { v: 0.25, label: '0.25% — rough and industrial diamonds' },
  { v: 3, label: '3% — gold, silver, precious-metal jewellery' },
  { v: 5, label: '5% — daily essentials, most packaged food, textiles' },
  { v: 18, label: '18% — standard rate, most manufactured goods' },
  { v: 40, label: '40% — luxury and sin goods' },
  { v: 28, label: '28% — tobacco and pan masala only' },
];
export const GST_VALUES = GST_RATES.map(r => r.v);
export const GST_WITHDRAWN = [12];

/* ── HSN suggestion ──────────────────────────────────────────────────────────
 * 4-digit headings per sub-category. Four digits is the level required below ₹5 crore
 * turnover, and it is the level that is safe to suggest: the 6- and 8-digit tail turns
 * on material and construction, which only the seller knows.
 * ⚠ A SUGGESTION, never an authority. HSN decides the tax you pay, so the app fills it
 * only when the field is empty and says on screen that it must be confirmed. */
const HSN = {
  'Kitchen & Dining': '7323', 'Cookware': '7323', 'Bakeware': '7323', 'Tableware & Serveware': '7323',
  'Kitchen Tools & Gadgets': '8205', 'Kitchen Storage & Containers': '3924', 'Water Bottles & Flasks': '9617',
  'Home & Décor': '6913', 'Home Furnishing': '6304', 'Bath': '6302', 'Bedding & Linen': '6302',
  'Curtains & Accessories': '6303', 'Home Storage & Organisation': '3924', 'Cleaning Supplies': '9603',
  'Indoor Lighting': '9405', 'Artwork': '9701', 'Craft Materials': '3926', 'Religious & Spiritual Items': '4421',
  'Heating, Cooling & Air Quality': '8415',
  'Small Kitchen Appliances': '8509', 'Mixers & Grinders': '8509', 'Induction Cooktops & Stoves': '8516',
  'Water Purifiers': '8421', 'Vacuum Cleaners': '8508', 'Irons & Garment Care': '8516', 'Fans': '8414',
  'Air Coolers & Purifiers': '8479', 'Large Appliances': '8418',
  'Men Topwear': '6109', 'Men Bottomwear': '6203', 'Men Innerwear & Sleepwear': '6107',
  'Women Ethnic Wear': '6204', 'Women Western Wear': '6204', 'Women Innerwear & Sleepwear': '6108',
  'Sarees & Dress Material': '5407', 'Kurtas & Kurtis': '6211', 'Kids Clothing': '6209',
  'Winterwear': '6110', 'Sportswear & Activewear': '6112', 'Fashion Accessories': '6217',
  'Belts, Wallets & Caps': '4203', 'Stoles, Scarves & Dupattas': '6214',
  'Earrings': '7117', 'Necklaces & Chains': '7117', 'Bangles & Bracelets': '7117', 'Rings': '7117',
  'Anklets & Toe Rings': '7117', 'Mangalsutra': '7117', 'Nose Pins': '7117', 'Jewellery Sets': '7117',
  'Hair Jewellery': '7117', 'Men Jewellery': '7117', 'Kids Jewellery': '7117', 'Jewellery Storage & Accessories': '4202',
  'Men Footwear': '6403', 'Women Footwear': '6402', 'Kids Footwear': '6402', 'Sports Shoes': '6404',
  'Sandals & Floaters': '6402', 'Slippers & Flip-Flops': '6402', 'Formal Shoes': '6403', 'Casual Shoes': '6404',
  'Handbags & Clutches': '4202', 'Backpacks': '4202', 'Wallets & Card Holders': '4202', 'Shoe Care & Accessories': '3405',
  'Skin Care': '3304', 'Hair Care': '3305', 'Bath & Body': '3401', 'Make-up': '3304', 'Fragrances': '3303',
  'Men Grooming': '3307', 'Oral Care': '3306', 'Beauty Tools & Accessories': '9615', 'Ayurveda & Natural Care': '3004',
  'Vitamins & Supplements': '2106', 'Ayurvedic & Herbal Products': '3004', 'Health Monitors & Devices': '9018',
  'Medical Supplies': '9018', 'Sexual Wellness': '4014', 'Baby & Child Care': '3401',
  'Personal Care Appliances': '8510', 'Mobility & Daily Living Aids': '8713',
  'Rice & Grains': '1006', 'Pulses & Dals': '0713', 'Flours & Atta': '1101', 'Spices & Masalas': '0910',
  'Cooking Oils & Ghee': '1512', 'Dry Fruits & Nuts': '0802', 'Snacks & Namkeen': '2106',
  'Tea, Coffee & Beverages': '0902', 'Sweeteners, Jaggery & Honey': '1701', 'Pickles, Chutneys & Pastes': '2001',
  'Ready to Cook & Eat': '2106', 'Bakery & Breakfast': '1905', 'Organic & Natural Foods': '2106',
  'Fitness Equipment': '9506', 'Yoga & Exercise Accessories': '9506', 'Cricket': '9506',
  'Badminton & Racquet Sports': '9506', 'Football & Team Sports': '9506', 'Cycling': '8712',
  'Camping & Hiking': '6306', 'Swimming': '9506', 'Sports Nutrition': '2106', 'Sports Accessories': '9506',
  'Learning & Educational Toys': '9503', 'Soft Toys': '9503', 'Dolls & Action Figures': '9503',
  'Building & Construction Toys': '9503', 'Puzzles & Board Games': '9504', 'Remote Control & Play Vehicles': '9503',
  'Outdoor Play & Ride-Ons': '9503', 'Arts & Crafts for Kids': '9503', 'Baby & Toddler Toys': '9503', 'Party Supplies': '9505',
  'Diapers & Wipes': '9619', 'Baby Feeding': '3924', 'Baby Bath & Skin Care': '3401', 'Baby Clothing': '6209',
  'Strollers & Prams': '8715', 'Cribs, Bedding & Furniture': '9403', 'Baby Safety': '3926', 'Baby Health Care': '9018',
  'Plants & Seeds': '1209', 'Pots & Planters': '3924', 'Fertilisers & Soil': '3105', 'Gardening Tools': '8201',
  'Watering & Irrigation': '8424', 'Pest Control': '3808', 'Outdoor Furniture': '9403', 'Outdoor Lighting & Décor': '9405',
  'Hand Tools': '8205', 'Power Tools': '8467', 'Tool Kits & Sets': '8206', 'Hardware & Fasteners': '7318',
  'Electrical & Wiring': '8536', 'Plumbing & Sanitary': '3917', 'Paints & Painting Supplies': '3209',
  'Safety & Security': '8301', 'Measuring & Layout Tools': '9017', 'Adhesives & Sealants': '3506',
  'Paper & Notebooks': '4820', 'Pens & Writing Instruments': '9608', 'Office Supplies & Organisers': '3926',
  'Files & Folders': '4820', 'School Supplies': '9608', 'Art & Drawing Supplies': '3213', 'Printers & Ink': '8443',
  'Calculators': '8470', 'Labels, Tapes & Packaging': '3919',
  'Dog Food & Treats': '2309', 'Cat Food & Treats': '2309', 'Pet Grooming': '3307', 'Pet Bowls & Feeders': '3924',
  'Pet Beds & Furniture': '6307', 'Collars, Leashes & Harnesses': '4201', 'Pet Toys': '9503',
  'Aquarium & Fish Supplies': '8413', 'Bird Supplies': '7326',
  'Mobile Phones': '8517', 'Mobile Accessories': '8517', 'Headphones & Earphones': '8518',
  'Speakers & Home Audio': '8518', 'Cameras & Photography': '8525', 'Televisions': '8528',
  'Smart Watches & Wearables': '8517', 'Power Banks & Chargers': '8507', 'Cables & Adapters': '8544',
  'Home Entertainment Accessories': '8529',
  'Laptops': '8471', 'Desktops & Monitors': '8471', 'Computer Accessories': '8473', 'Keyboards & Mice': '8471',
  'Storage & Pen Drives': '8523', 'Networking Devices': '8517', 'Components': '8473', 'Printers & Scanners': '8443',
  'Laptop Bags & Sleeves': '4202',
  'Living Room Furniture': '9403', 'Bedroom Furniture': '9403', 'Kitchen & Dining Furniture': '9403',
  'Office Furniture': '9403', 'Kids Furniture': '9403', 'Mattresses': '9404', 'Shoe Racks & Wardrobes': '9403',
  'Suitcases & Trolley Bags': '4202', 'Duffel & Travel Bags': '4202', 'Laptop Bags': '4202', 'School Bags': '4202',
  'Travel Accessories': '4202', 'Shopping & Tote Bags': '4202',
  'Car Accessories': '8708', 'Car Care & Cleaning': '3405', 'Bike Accessories': '8714',
  'Helmets & Riding Gear': '6506', 'Car & Bike Spare Parts': '8708', 'Car Electronics': '8512',
  'Oils & Lubricants': '2710', 'Tyres & Rims': '4011',
  'Men Watches': '9102', 'Women Watches': '9102', 'Kids Watches': '9102', 'Smart Watches': '8517',
  'Watch Straps & Accessories': '9113',
  'Guitars & Strings': '9202', 'Keyboards & Pianos': '9207', 'Indian Classical Instruments': '9206',
  'Percussion & Drums': '9206', 'Wind Instruments': '9205', 'Studio & Recording Equipment': '8518',
  'Instrument Accessories': '9209',
  'Industrial Tools & Equipment': '8207', 'Lab & Scientific Supplies': '7017', 'Safety Equipment & PPE': '6307',
  'Packaging & Shipping Supplies': '4819', 'Material Handling': '8428', 'Test & Measurement': '9031',
  'Janitorial & Sanitation': '3402', 'Agricultural Equipment': '8432',
  'Academic & Textbooks': '4901', 'Exam Preparation': '4901', 'Fiction': '4901', 'Non-fiction': '4901',
  'Children Books': '4901', 'Regional Language Books': '4901', 'Comics & Graphic Novels': '4901',
  'Consoles': '9504', 'Games': '9504', 'Controllers & Accessories': '9504', 'Gaming Merchandise': '9504',
  'Movies & TV Shows': '8523', 'Music CDs & Vinyl': '8523', 'Musical Media Accessories': '8523',
};
/* Material overrides — the same shelf item changes heading with what it is made of. */
const HSN_BY_MATERIAL = [
  [/aluminium|aluminum/i, { 'Kitchen & Dining': '7615', 'Cookware': '7615', 'Bakeware': '7615', 'Tableware & Serveware': '7615', 'Kitchen Tools & Gadgets': '7615' }],
  [/stainless steel|steel|iron/i, { 'Kitchen & Dining': '7323', 'Cookware': '7323', 'Water Bottles & Flasks': '7323' }],
  [/plastic|polypropylene|acrylic|melamine/i, { 'Kitchen & Dining': '3924', 'Tableware & Serveware': '3924', 'Water Bottles & Flasks': '3924' }],
  [/glass/i, { 'Tableware & Serveware': '7013', 'Kitchen Storage & Containers': '7013' }],
  [/ceramic|porcelain|stoneware/i, { 'Tableware & Serveware': '6912', 'Home & Décor': '6913' }],
  [/copper|brass/i, { 'Kitchen & Dining': '7418', 'Tableware & Serveware': '7418', 'Water Bottles & Flasks': '7418' }],
  [/wooden|wood|bamboo/i, { 'Home & Décor': '4420', 'Kitchen Tools & Gadgets': '4419', 'Tableware & Serveware': '4419' }],
  [/coir|jute|coconut fibre|coconut fiber/i, { 'Cleaning Supplies': '9603', 'Home Furnishing': '5702' }],
  [/silver|gold/i, { 'Earrings': '7113', 'Necklaces & Chains': '7113', 'Bangles & Bracelets': '7113', 'Rings': '7113', 'Anklets & Toe Rings': '7113', 'Jewellery Sets': '7113', 'Mangalsutra': '7113' }],
];
/* Rates that are settled post-GST-2.0 and safe to prefill. Everything else stays blank
 * on purpose — guessing a rate under a regime that changed in Sep 2025 is how a seller
 * files wrong. */
const GST_BY_HSN = { '7113': 3, '7117': 3, '4901': 0, '1006': 5, '0713': 5, '1101': 5, '0910': 5 };

/* Returns {hsn, gst, source} or null. `gst` is '' when we will not guess. */
export function suggestHsn(product) {
  const p = product || {};
  const sub = String(p.subcategory || '').trim();
  const mat = String(p.material || '') + ' ' + String(p.productType || '');
  let hsn = '', source = '';
  for (const [re, map] of HSN_BY_MATERIAL) {
    const m = mat.match(re);
    if (m && map[sub]) { hsn = map[sub]; source = `${sub} in ${m[0].toLowerCase()}`; break; }
  }
  if (!hsn && HSN[sub]) { hsn = HSN[sub]; source = sub; }
  if (!hsn) { const first = subsFor(p.category)[0]; if (first && HSN[first]) { hsn = HSN[first]; source = p.category; } }
  if (!hsn) return null;
  return { hsn, gst: GST_BY_HSN[hsn] != null ? GST_BY_HSN[hsn] : '', source };
}
