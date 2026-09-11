/* IBI Product Listings Master — channel registry
 * One object per marketplace. Everything the engine, the validator and the
 * exporter need to know about a channel lives here, so adding a marketplace
 * is adding an object (or building one in the app's Custom Channel screen).
 *
 * Field spec keys:
 *   max        hard character limit (bytes for *Bytes)
 *   target     [min,max] band the composer fills towards (the "visible" band)
 *   rules      validator rule ids (see engine.js RULES)
 *   sep        joiner for phrase lists (highlights)
 * titleSlots   ordered composer slots; the composer keeps adding slots while
 *              the title stays inside target[1], then trims to max.
 */

export const CHANNEL_SCHEMA_VERSION = 1;

const LEGAL_METROLOGY = ['manufacturer', 'netQuantity', 'mrp', 'countryOfOrigin', 'consumerCare', 'commonName'];

export const CHANNELS = [
  {
    id: 'amazon_in', name: 'Amazon India', short: 'Amazon.in', group: 'India', accent: '#FF9900',
    site: 'https://sellercentral.amazon.in', status: 'live', policyDate: '2026-07-27',
    summary: 'Item Name ≤75 chars + the 125-char searchable Item Highlights (policy of 27 Jul 2026). Titles over 75 are rewritten by Amazon without asking.',
    fields: {
      title: { label: 'Item Name', max: 75, target: [62, 75], rules: ['noPromo', 'maxRepeat2', 'amazonChars', 'noAllCaps', 'noPackInTitle'] },
      highlights: { label: 'Item Highlights', max: 125, target: [105, 125], sep: ' · ', rules: ['noTitleWords', 'noBrand', 'noPromo', 'noSentence'] },
      bullets: { label: 'Bullet Points', count: 5, maxEach: 250, targetEach: [110, 200], rules: ['noPromo', 'amazonChars'] },
      description: { label: 'Product Description', max: 2000, target: [900, 2000], rules: ['noPromo'] },
      keywords: { label: 'Generic Keywords (backend)', maxBytes: 249, target: [150, 240], rules: ['noTitleWords', 'noBrand', 'noCommas', 'noPromo'] },
    },
    titleSlots: ['brand', 'productType', 'keyFeature', 'material', 'certification', 'size', 'useCase', 'colour', 'model'],
    titleJoin: ', ',
    images: { min: 1, max: 9, minPx: 1000, recPx: 2000, mainWhiteBg: true, note: 'Main image on pure white, product ≥85% of frame, 1000px+ (2000px for zoom).' },
    price: { requireMRP: true, sellLteMrp: true },
    compliance: [...LEGAL_METROLOGY, 'hsn', 'gtin', 'bulletsAll5'],
    export: {
      format: 'xlsx', sheet: 'Template', headerRow: ['feed_product_type', 'item_sku', 'brand_name', 'item_name', 'item_highlights', 'external_product_id', 'external_product_id_type', 'manufacturer', 'part_number', 'item_type_keyword', 'model', 'product_description', 'bullet_point1', 'bullet_point2', 'bullet_point3', 'bullet_point4', 'bullet_point5', 'generic_keywords', 'standard_price', 'list_price_with_tax', 'quantity', 'main_image_url', 'other_image_url1', 'other_image_url2', 'other_image_url3', 'other_image_url4', 'other_image_url5', 'other_image_url6', 'other_image_url7', 'other_image_url8', 'color_name', 'material_type', 'size_name', 'number_of_items', 'unit_count', 'unit_count_type', 'country_of_origin', 'hsn_code', 'item_package_weight', 'item_package_weight_unit_of_measure', 'package_length', 'package_width', 'package_height', 'package_dimensions_unit_of_measure', 'warranty_description', 'condition_type', 'fulfillment_latency'],
      map: ['feedProductType', 'sku', 'brand', 'title', 'highlights', 'gtin', 'gtinType', 'manufacturerName', 'partNumber', 'productType', 'model', 'description', 'bullet1', 'bullet2', 'bullet3', 'bullet4', 'bullet5', 'keywords', 'sellingPrice', 'mrp', 'stock', 'image1', 'image2', 'image3', 'image4', 'image5', 'image6', 'image7', 'image8', 'image9', 'colour', 'material', 'size', 'packSize', 'netQuantityValue', 'netQuantityUnit', 'countryOfOrigin', 'hsn', 'weightG', 'const:GR', 'lengthCm', 'breadthCm', 'heightCm', 'const:CM', 'warranty', 'const:New', 'const:2'],
    },
  },
  {
    id: 'amazon_bazaar', name: 'Amazon Bazaar', short: 'Bazaar', group: 'India', accent: '#E47911',
    site: 'https://sellercentral.amazon.in', status: 'live', policyDate: '2026-07-27',
    summary: 'Amazon\'s value store inside the Amazon app. Same title policy as Amazon.in, unbranded/value items, low price points, simplified listing with 3 bullets.',
    fields: {
      title: { label: 'Item Name', max: 75, target: [55, 75], rules: ['noPromo', 'maxRepeat2', 'amazonChars', 'noAllCaps', 'noPackInTitle'] },
      highlights: { label: 'Item Highlights', max: 125, target: [90, 125], sep: ' · ', rules: ['noTitleWords', 'noBrand', 'noPromo', 'noSentence'] },
      bullets: { label: 'Bullet Points', count: 3, maxEach: 200, targetEach: [80, 160], rules: ['noPromo', 'amazonChars'] },
      description: { label: 'Product Description', max: 1200, target: [500, 1000], rules: ['noPromo'] },
      keywords: { label: 'Generic Keywords (backend)', maxBytes: 249, target: [120, 240], rules: ['noTitleWords', 'noBrand', 'noCommas', 'noPromo'] },
    },
    titleSlots: ['productType', 'keyFeature', 'material', 'size', 'useCase', 'colour', 'audience'],
    titleJoin: ', ',
    images: { min: 1, max: 7, minPx: 1000, recPx: 1600, mainWhiteBg: true },
    price: { requireMRP: true, sellLteMrp: true, maxSell: 600, maxSellNote: 'Bazaar is positioned for value items; most listings sell under ₹600.' },
    compliance: [...LEGAL_METROLOGY, 'hsn'],
    export: {
      format: 'xlsx', sheet: 'Template', headerRow: ['item_sku', 'item_name', 'item_highlights', 'product_description', 'bullet_point1', 'bullet_point2', 'bullet_point3', 'generic_keywords', 'standard_price', 'list_price_with_tax', 'quantity', 'main_image_url', 'other_image_url1', 'other_image_url2', 'other_image_url3', 'color_name', 'size_name', 'material_type', 'country_of_origin', 'hsn_code', 'item_package_weight', 'package_length', 'package_width', 'package_height'],
      map: ['sku', 'title', 'highlights', 'description', 'bullet1', 'bullet2', 'bullet3', 'keywords', 'sellingPrice', 'mrp', 'stock', 'image1', 'image2', 'image3', 'image4', 'colour', 'size', 'material', 'countryOfOrigin', 'hsn', 'weightG', 'lengthCm', 'breadthCm', 'heightCm'],
    },
  },
  {
    id: 'flipkart', name: 'Flipkart', short: 'Flipkart', group: 'India', accent: '#2874F0',
    site: 'https://seller.flipkart.com', status: 'live', policyDate: '2026-09-01',
    summary: 'Search and the app truncate titles around 100 characters. No ALL-CAPS words, no symbols. Misleading or unverifiable claims are the top rejection reason.',
    fields: {
      title: { label: 'Product Title', max: 200, target: [80, 100], rules: ['noPromo', 'noAllCaps', 'noSymbols', 'maxRepeat2'] },
      highlights: { label: 'Highlights strip', max: 125, target: [90, 125], sep: ' | ', rules: ['noTitleWords', 'noPromo', 'noSentence'] },
      bullets: { label: 'Key Features', count: 5, maxEach: 200, targetEach: [80, 160], rules: ['noPromo', 'noSymbols'] },
      description: { label: 'Description', max: 3000, target: [700, 2000], rules: ['noPromo', 'noUnverifiable'] },
      keywords: { label: 'Search Keywords', maxBytes: 200, target: [80, 180], rules: ['noBrand', 'noPromo'] },
    },
    titleSlots: ['brand', 'productType', 'material', 'keyFeature', 'colour', 'size', 'packSize', 'useCase'],
    titleJoin: ' ',
    titleParen: ['colour', 'size', 'packSize'],
    images: { min: 1, max: 5, minPx: 500, recPx: 1000, mainWhiteBg: true },
    price: { requireMRP: true, sellLteMrp: true },
    compliance: [...LEGAL_METROLOGY, 'hsn', 'gstRate', 'warranty'],
    export: {
      format: 'xlsx', sheet: 'Listing', headerRow: ['Seller SKU ID', 'Listing Status', 'MRP (INR)', 'Your selling price (INR)', 'Fullfilment by', 'Procurement type', 'Procurement SLA (DAY)', 'Stock', 'Shipping provider', 'Length (CM)', 'Breadth (CM)', 'Height (CM)', 'Weight (KG)', 'HSN', 'Tax Code', 'Country Of Origin', 'Manufacturer Details', 'Packer Details', 'Importer Details', 'Brand', 'Model Name', 'Model Number', 'Color', 'Size', 'Product Title', 'Description', 'Search Keywords', 'Key Features', 'Main Image URL', 'Other Image URL 1', 'Other Image URL 2', 'Other Image URL 3', 'Other Image URL 4', 'Warranty Summary', 'Warranty Service Type', 'Sales Package'],
      map: ['sku', 'const:ACTIVE', 'mrp', 'sellingPrice', 'const:SELLER', 'const:REGULAR', 'const:1', 'stock', 'const:FLIPKART', 'lengthCm', 'breadthCm', 'heightCm', 'weightKg', 'hsn', 'taxCode', 'countryOfOrigin', 'manufacturerDetails', 'packerDetails', 'importerDetails', 'brand', 'model', 'partNumber', 'colour', 'size', 'title', 'description', 'keywords', 'bulletsJoined', 'image1', 'image2', 'image3', 'image4', 'image5', 'warranty', 'const:Manufacturer', 'salesPackage'],
    },
  },
  {
    id: 'shopsy', name: 'Shopsy', short: 'Shopsy', group: 'India', accent: '#F7A700',
    site: 'https://seller.flipkart.com', status: 'live', policyDate: '2026-09-01',
    summary: 'Flipkart\'s zero-commission value app. Same catalogue sheet as Flipkart, but mobile-first: keep the title short and lead with the words a bargain shopper types.',
    fields: {
      title: { label: 'Product Title', max: 200, target: [55, 80], rules: ['noPromo', 'noAllCaps', 'noSymbols', 'maxRepeat2'] },
      highlights: { label: 'Highlights strip', max: 125, target: [80, 125], sep: ' | ', rules: ['noTitleWords', 'noPromo', 'noSentence'] },
      bullets: { label: 'Key Features', count: 4, maxEach: 160, targetEach: [60, 140], rules: ['noPromo', 'noSymbols'] },
      description: { label: 'Description', max: 2000, target: [400, 1200], rules: ['noPromo', 'noUnverifiable'] },
      keywords: { label: 'Search Keywords', maxBytes: 200, target: [80, 180], rules: ['noBrand', 'noPromo'] },
    },
    titleSlots: ['productType', 'keyFeature', 'material', 'colour', 'size', 'audience', 'useCase'],
    titleJoin: ' ',
    images: { min: 1, max: 5, minPx: 500, recPx: 1000, mainWhiteBg: true },
    price: { requireMRP: true, sellLteMrp: true, maxSell: 1000, maxSellNote: 'Shopsy surfaces price-led listings; items above ₹1,000 rarely rank.' },
    compliance: [...LEGAL_METROLOGY, 'hsn', 'gstRate'],
    export: { inherit: 'flipkart' },
  },
  {
    id: 'meesho', name: 'Meesho', short: 'Meesho', group: 'India', accent: '#9F2089',
    site: 'https://supplier.meesho.com', status: 'live', policyDate: '2026-09-01',
    summary: 'Product name 50–120 characters (60–80 ideal), plain and keyword-led. No backend keyword field, so search terms must live in the name and description. No guarantee, MRP or discount claims.',
    fields: {
      title: { label: 'Product Name', min: 50, max: 120, target: [60, 80], rules: ['noPromo', 'noAllCaps', 'noSymbols', 'maxRepeat2', 'noMrpClaims'] },
      bullets: { label: 'Key highlights', count: 4, maxEach: 120, targetEach: [40, 100], rules: ['noPromo', 'noMrpClaims'] },
      description: { label: 'Product Description', max: 1500, target: [600, 1200], rules: ['noPromo', 'noMrpClaims', 'weaveKeywords'] },
    },
    titleSlots: ['productType', 'material', 'keyFeature', 'audience', 'colour', 'size', 'useCase', 'packSize'],
    titleJoin: ' ',
    images: { min: 1, max: 4, minPx: 500, recPx: 1000, ratio: '1:1', mainWhiteBg: false, note: 'Square photos, real product shots; the first photo is the catalogue cover.' },
    price: { requireMRP: true, sellLteMrp: true },
    compliance: [...LEGAL_METROLOGY, 'hsn', 'gstRate'],
    export: {
      format: 'xlsx', sheet: 'Catalog', headerRow: ['Style Code / SKU', 'Product Name', 'Category', 'Sub Category', 'Product Description', 'Meesho Price (Supplier Price)', 'MRP', 'GST %', 'HSN Code', 'Product Weight (gm)', 'Size', 'Color', 'Material / Fabric', 'Net Quantity', 'Country of Origin', 'Manufacturer Name', 'Manufacturer Address', 'Packer Name', 'Packer Address', 'Inventory', 'Image 1', 'Image 2', 'Image 3', 'Image 4'],
      map: ['sku', 'title', 'category', 'subcategory', 'descriptionWithBullets', 'sellingPrice', 'mrp', 'gst', 'hsn', 'weightG', 'size', 'colour', 'material', 'netQuantity', 'countryOfOrigin', 'manufacturerName', 'manufacturerAddress', 'packerName', 'packerAddress', 'stock', 'image1', 'image2', 'image3', 'image4'],
    },
  },
  {
    id: 'shopclues', name: 'ShopClues', short: 'ShopClues', group: 'India', accent: '#F26522',
    site: 'https://seller.shopclues.com', status: 'live', policyDate: '2026-09-01',
    summary: 'Product name up to 150 characters, key features as bullets, search tags field, HTML allowed in the description. Value-led marketplace, so lead with the product type and price-relevant attributes.',
    fields: {
      title: { label: 'Product Name', max: 150, target: [80, 120], rules: ['noPromo', 'noAllCaps', 'maxRepeat2'] },
      highlights: { label: 'Short highlights', max: 150, target: [90, 150], sep: ' | ', rules: ['noTitleWords', 'noPromo', 'noSentence'] },
      bullets: { label: 'Key Features', count: 5, maxEach: 200, targetEach: [60, 160], rules: ['noPromo'] },
      description: { label: 'Product Description', max: 4000, target: [800, 2000], rules: ['noPromo'] },
      keywords: { label: 'Search Tags', maxBytes: 250, target: [100, 240], rules: ['noPromo'] },
    },
    titleSlots: ['brand', 'productType', 'keyFeature', 'material', 'colour', 'size', 'packSize', 'useCase', 'audience'],
    titleJoin: ' ',
    titleParen: ['colour', 'size', 'packSize'],
    images: { min: 1, max: 5, minPx: 500, recPx: 1000, mainWhiteBg: true },
    price: { requireMRP: true, sellLteMrp: true },
    compliance: [...LEGAL_METROLOGY, 'hsn', 'gstRate'],
    export: {
      format: 'xlsx', sheet: 'Products', headerRow: ['Seller SKU', 'Product Name', 'Brand', 'Category', 'Model No', 'Product Description', 'Key Features', 'Search Tags', 'MRP', 'Selling Price', 'Quantity', 'HSN', 'Tax %', 'Weight (g)', 'Length (cm)', 'Breadth (cm)', 'Height (cm)', 'Color', 'Size', 'Warranty', 'Country of Origin', 'Image 1', 'Image 2', 'Image 3', 'Image 4', 'Image 5'],
      map: ['sku', 'title', 'brand', 'category', 'partNumber', 'description', 'bulletsJoined', 'keywords', 'mrp', 'sellingPrice', 'stock', 'hsn', 'gst', 'weightG', 'lengthCm', 'breadthCm', 'heightCm', 'colour', 'size', 'warranty', 'countryOfOrigin', 'image1', 'image2', 'image3', 'image4', 'image5'],
    },
  },
  {
    id: 'ibi', name: 'IBI eCommerce Marketplace', short: 'IBI', group: 'India', accent: '#7F00FF',
    site: 'https://www.indiabusinessinternational.online', status: 'live', policyDate: '2026-09-06',
    summary: 'Our own marketplace. The sheet below is exactly the Bulk Upload template Seller Central accepts: one row per colour × size, rows with the same title merge into one listing.',
    fields: {
      title: { label: 'Product Title', max: 150, target: [60, 110], rules: ['noPromo', 'noAllCaps', 'maxRepeat2'] },
      highlights: { label: 'Google title (≤60)', max: 60, target: [45, 60], sep: ' ', rules: ['noPromo'] },
      bullets: { label: 'Key Features (| separated)', count: 5, maxEach: 160, targetEach: [40, 120], rules: ['noPromo'] },
      description: { label: 'Description', max: 3000, target: [500, 1500], rules: ['noPromo'] },
      keywords: { label: 'Search Keywords', maxBytes: 300, target: [80, 250], rules: ['noPromo'] },
      metaDescription: { label: 'Meta description', max: 160, target: [120, 160], rules: ['noPromo'] },
    },
    titleSlots: ['brand', 'productType', 'material', 'keyFeature', 'useCase', 'colour', 'size'],
    titleJoin: ' ',
    titleParen: ['colour', 'size'],
    images: { min: 1, max: 5, minPx: 800, recPx: 1200, mainWhiteBg: false },
    price: { requireMRP: true, sellLteMrp: true },
    compliance: ['hsn', 'gstRate', 'manufacturer', 'countryOfOrigin'],
    export: {
      format: 'xlsx', sheet: 'Products', headerRow: ['Product Title', 'Brand', 'Category', 'Description', 'Key Features', 'Search Keywords', 'HSN', 'GST %', 'SKU', 'Colour', 'Size', 'MRP', 'Selling Price', 'Stock', 'Weight (g)', 'Package Length (cm)', 'Package Breadth (cm)', 'Package Height (cm)', 'Image URL 1', 'Image URL 2', 'Image URL 3', 'Image URL 4', 'Image URL 5'],
      map: ['title', 'brand', 'category', 'description', 'bulletsPipe', 'keywordsComma', 'hsn', 'gst', 'sku', 'colour', 'size', 'mrp', 'sellingPrice', 'stock', 'weightG', 'lengthCm', 'breadthCm', 'heightCm', 'image1', 'image2', 'image3', 'image4', 'image5'],
    },
  },

  /* ── Preview channels: limits from each platform's public seller guidelines; export is that platform's common sheet layout. ── */
  {
    id: 'jiomart', name: 'JioMart', short: 'JioMart', group: 'India', accent: '#0078AD', status: 'preview', policyDate: '2026-06-01',
    site: 'https://seller.jiomart.com',
    summary: 'Grocery-to-general marketplace. Concise titles, spec-driven descriptions, mandatory Legal Metrology declarations.',
    fields: {
      title: { label: 'Product Title', max: 150, target: [60, 100], rules: ['noPromo', 'noAllCaps', 'maxRepeat2'] },
      bullets: { label: 'Key Features', count: 5, maxEach: 200, targetEach: [60, 150], rules: ['noPromo'] },
      description: { label: 'Description', max: 3000, target: [600, 1500], rules: ['noPromo'] },
      keywords: { label: 'Search Keywords', maxBytes: 250, target: [80, 200], rules: ['noPromo'] },
    },
    titleSlots: ['brand', 'productType', 'keyFeature', 'material', 'size', 'colour', 'packSize'],
    titleJoin: ' ',
    images: { min: 1, max: 6, minPx: 500, recPx: 1000, mainWhiteBg: true },
    price: { requireMRP: true, sellLteMrp: true },
    compliance: [...LEGAL_METROLOGY, 'hsn', 'gstRate'],
    export: { format: 'xlsx', sheet: 'Products', headerRow: ['SKU', 'Product Title', 'Brand', 'Category', 'Description', 'Key Features', 'Search Keywords', 'MRP', 'Selling Price', 'Stock', 'HSN', 'GST %', 'Weight (g)', 'Length (cm)', 'Breadth (cm)', 'Height (cm)', 'Colour', 'Size', 'Net Quantity', 'Country of Origin', 'Manufacturer', 'Image 1', 'Image 2', 'Image 3', 'Image 4', 'Image 5', 'Image 6'], map: ['sku', 'title', 'brand', 'category', 'description', 'bulletsJoined', 'keywords', 'mrp', 'sellingPrice', 'stock', 'hsn', 'gst', 'weightG', 'lengthCm', 'breadthCm', 'heightCm', 'colour', 'size', 'netQuantity', 'countryOfOrigin', 'manufacturerDetails', 'image1', 'image2', 'image3', 'image4', 'image5', 'image6'] },
  },
  {
    id: 'snapdeal', name: 'Snapdeal', short: 'Snapdeal', group: 'India', accent: '#E40046', status: 'preview', policyDate: '2026-06-01',
    site: 'https://sellers.snapdeal.com',
    summary: 'Value marketplace. Product name plus highlights and a plain description; strong on price-led fashion and home.',
    fields: {
      title: { label: 'Product Name', max: 150, target: [60, 100], rules: ['noPromo', 'noAllCaps', 'maxRepeat2'] },
      bullets: { label: 'Highlights', count: 5, maxEach: 150, targetEach: [50, 120], rules: ['noPromo'] },
      description: { label: 'Description', max: 3000, target: [500, 1500], rules: ['noPromo'] },
      keywords: { label: 'Search Keywords', maxBytes: 250, target: [80, 200], rules: ['noPromo'] },
    },
    titleSlots: ['brand', 'productType', 'keyFeature', 'material', 'colour', 'size', 'packSize'],
    titleJoin: ' ',
    images: { min: 1, max: 5, minPx: 500, recPx: 1000, mainWhiteBg: true },
    price: { requireMRP: true, sellLteMrp: true },
    compliance: [...LEGAL_METROLOGY, 'hsn', 'gstRate'],
    export: { format: 'xlsx', sheet: 'Products', headerRow: ['Seller SKU', 'Product Name', 'Brand', 'Category', 'Highlights', 'Description', 'Search Keywords', 'MRP', 'Selling Price', 'Stock', 'HSN', 'GST %', 'Weight (g)', 'Colour', 'Size', 'Country of Origin', 'Image 1', 'Image 2', 'Image 3', 'Image 4', 'Image 5'], map: ['sku', 'title', 'brand', 'category', 'bulletsJoined', 'description', 'keywords', 'mrp', 'sellingPrice', 'stock', 'hsn', 'gst', 'weightG', 'colour', 'size', 'countryOfOrigin', 'image1', 'image2', 'image3', 'image4', 'image5'] },
  },
  {
    id: 'amazon_com', name: 'Amazon.com (US)', short: 'Amazon US', group: 'Global', accent: '#FF9900', status: 'preview', policyDate: '2026-07-27',
    site: 'https://sellercentral.amazon.com',
    summary: 'Same 75/125 title policy as Amazon India. Prices in USD; imperial units in the sheet.',
    fields: {
      title: { label: 'Item Name', max: 75, target: [62, 75], rules: ['noPromo', 'maxRepeat2', 'amazonChars', 'noAllCaps', 'noPackInTitle'] },
      highlights: { label: 'Item Highlights', max: 125, target: [105, 125], sep: ' · ', rules: ['noTitleWords', 'noBrand', 'noPromo', 'noSentence'] },
      bullets: { label: 'Bullet Points', count: 5, maxEach: 250, targetEach: [110, 200], rules: ['noPromo', 'amazonChars'] },
      description: { label: 'Product Description', max: 2000, target: [900, 2000], rules: ['noPromo'] },
      keywords: { label: 'Generic Keywords', maxBytes: 249, target: [150, 240], rules: ['noTitleWords', 'noBrand', 'noCommas', 'noPromo'] },
    },
    titleSlots: ['brand', 'productType', 'keyFeature', 'material', 'size', 'useCase', 'colour'],
    titleJoin: ', ',
    images: { min: 1, max: 9, minPx: 1000, recPx: 2000, mainWhiteBg: true },
    price: { requireMRP: false, currency: 'USD' },
    compliance: ['gtin', 'bulletsAll5', 'countryOfOrigin'],
    export: { inherit: 'amazon_in' },
  },
  {
    id: 'ebay', name: 'eBay', short: 'eBay', group: 'Global', accent: '#E53238', status: 'preview', policyDate: '2026-06-01',
    site: 'https://www.ebay.com/sh',
    summary: '80-character title, item specifics drive search (Cassini). No promotional words in the title; subtitle is a paid extra.',
    fields: {
      title: { label: 'Title', max: 80, target: [65, 80], rules: ['noPromo', 'noAllCaps', 'maxRepeat2'] },
      bullets: { label: 'Item specifics (Key: Value)', count: 8, maxEach: 65, targetEach: [10, 60], rules: [] },
      description: { label: 'Description', max: 4000, target: [600, 2000], rules: ['noPromo'] },
    },
    titleSlots: ['brand', 'productType', 'keyFeature', 'material', 'size', 'colour', 'audience', 'useCase'],
    titleJoin: ' ',
    images: { min: 1, max: 24, minPx: 500, recPx: 1600, mainWhiteBg: true },
    price: { requireMRP: false, currency: 'USD' },
    compliance: ['gtin', 'countryOfOrigin'],
    export: { format: 'csv', headerRow: ['*Action(SiteID=US|Country=US|Currency=USD|Version=1193)', 'CustomLabel', '*Category', '*Title', '*Description', '*ConditionID', 'PicURL', '*Quantity', '*StartPrice', 'C:Brand', 'C:Material', 'C:Color', 'C:Size', 'Product:UPC', 'Product:MPN'], map: ['const:Add', 'sku', 'category', 'title', 'description', 'const:1000', 'imagesPipe', 'stock', 'sellingPrice', 'brand', 'material', 'colour', 'size', 'gtin', 'partNumber'] },
  },
  {
    id: 'etsy', name: 'Etsy', short: 'Etsy', group: 'Global', accent: '#F1641E', status: 'preview', policyDate: '2026-06-01',
    site: 'https://www.etsy.com/your/shops/me',
    summary: '140-character title, first 40 characters matter most, 13 tags of ≤20 characters each. Handmade, vintage or craft supplies only.',
    fields: {
      title: { label: 'Title', max: 140, target: [90, 140], rules: ['noPromo', 'noAllCaps', 'maxRepeat2'] },
      description: { label: 'Description', max: 5000, target: [600, 2000], rules: ['noPromo'] },
      keywords: { label: 'Tags (13 × ≤20 chars)', maxBytes: 280, target: [120, 260], rules: ['noPromo'], tagMax: 20, tagCount: 13 },
    },
    titleSlots: ['productType', 'keyFeature', 'material', 'useCase', 'audience', 'colour', 'size', 'brand'],
    titleJoin: ', ',
    images: { min: 1, max: 10, minPx: 2000, recPx: 3000, mainWhiteBg: false },
    price: { requireMRP: false, currency: 'USD' },
    compliance: [],
    export: { format: 'csv', headerRow: ['TITLE', 'DESCRIPTION', 'PRICE', 'CURRENCY_CODE', 'QUANTITY', 'TAGS', 'MATERIALS', 'IMAGE1', 'IMAGE2', 'IMAGE3', 'IMAGE4', 'IMAGE5', 'SKU'], map: ['title', 'description', 'sellingPrice', 'const:USD', 'stock', 'keywordsComma', 'material', 'image1', 'image2', 'image3', 'image4', 'image5', 'sku'] },
  },
  {
    id: 'shopify', name: 'Shopify store', short: 'Shopify', group: 'Own store', accent: '#96BF48', status: 'preview', policyDate: '2026-06-01',
    site: 'https://admin.shopify.com',
    summary: 'Your own store: Google-facing SEO title ≤60 and meta description ≤160 matter more than any marketplace limit. Export is Shopify\'s product CSV.',
    fields: {
      title: { label: 'Product title', max: 255, target: [50, 70], rules: ['noPromo', 'noAllCaps'] },
      highlights: { label: 'SEO title (≤60)', max: 60, target: [45, 60], sep: ' ', rules: ['noPromo'] },
      metaDescription: { label: 'Meta description', max: 160, target: [120, 160], rules: ['noPromo'] },
      bullets: { label: 'Feature list', count: 5, maxEach: 200, targetEach: [60, 150], rules: [] },
      description: { label: 'Description (HTML)', max: 6000, target: [600, 2000], rules: [] },
      keywords: { label: 'Tags', maxBytes: 255, target: [60, 200], rules: [] },
    },
    titleSlots: ['brand', 'productType', 'keyFeature', 'material', 'size'],
    titleJoin: ' ',
    images: { min: 1, max: 20, minPx: 1024, recPx: 2048, mainWhiteBg: false },
    price: { requireMRP: false },
    compliance: [],
    export: { format: 'csv', headerRow: ['Handle', 'Title', 'Body (HTML)', 'Vendor', 'Product Category', 'Type', 'Tags', 'Published', 'Option1 Name', 'Option1 Value', 'Option2 Name', 'Option2 Value', 'Variant SKU', 'Variant Grams', 'Variant Inventory Qty', 'Variant Price', 'Variant Compare At Price', 'Image Src', 'SEO Title', 'SEO Description', 'Status'], map: ['handle', 'title', 'descriptionHtml', 'brand', 'category', 'productType', 'keywordsComma', 'const:TRUE', 'const:Color', 'colour', 'const:Size', 'size', 'sku', 'weightG', 'stock', 'sellingPrice', 'mrp', 'image1', 'highlights', 'metaDescription', 'const:active'] },
  },
  {
    id: 'woocommerce', name: 'WooCommerce', short: 'Woo', group: 'Own store', accent: '#7F54B3', status: 'preview', policyDate: '2026-06-01',
    site: 'https://woocommerce.com',
    summary: 'WordPress store. Export is the WooCommerce product importer CSV; SEO title and meta description feed Yoast/RankMath.',
    fields: {
      title: { label: 'Product name', max: 255, target: [50, 70], rules: ['noPromo', 'noAllCaps'] },
      highlights: { label: 'SEO title (≤60)', max: 60, target: [45, 60], sep: ' ', rules: ['noPromo'] },
      metaDescription: { label: 'Meta description', max: 160, target: [120, 160], rules: ['noPromo'] },
      bullets: { label: 'Short description points', count: 5, maxEach: 200, targetEach: [60, 150], rules: [] },
      description: { label: 'Description', max: 6000, target: [600, 2000], rules: [] },
      keywords: { label: 'Tags', maxBytes: 255, target: [60, 200], rules: [] },
    },
    titleSlots: ['brand', 'productType', 'keyFeature', 'material', 'size'],
    titleJoin: ' ',
    images: { min: 1, max: 20, minPx: 800, recPx: 1600, mainWhiteBg: false },
    price: { requireMRP: false },
    compliance: [],
    export: { format: 'csv', headerRow: ['Type', 'SKU', 'Name', 'Published', 'Short description', 'Description', 'Tax status', 'In stock?', 'Stock', 'Weight (kg)', 'Length (cm)', 'Width (cm)', 'Height (cm)', 'Regular price', 'Sale price', 'Categories', 'Tags', 'Images', 'Attribute 1 name', 'Attribute 1 value(s)', 'Attribute 2 name', 'Attribute 2 value(s)', 'Meta: _yoast_wpseo_title', 'Meta: _yoast_wpseo_metadesc'], map: ['const:simple', 'sku', 'title', 'const:1', 'bulletsJoined', 'description', 'const:taxable', 'const:1', 'stock', 'weightKg', 'lengthCm', 'breadthCm', 'heightCm', 'mrp', 'sellingPrice', 'category', 'keywordsComma', 'imagesComma', 'const:Colour', 'colour', 'const:Size', 'size', 'highlights', 'metaDescription'] },
  },
];

export const CHANNEL_MAP = Object.fromEntries(CHANNELS.map(c => [c.id, c]));

/* Resolve `export.inherit` so callers always get a concrete export block. */
export function exportSpec(ch, registry) {
  const reg = registry || CHANNEL_MAP;
  let e = ch.export, guard = 0;
  while (e && e.inherit && guard++ < 5) e = (reg[e.inherit] || {}).export;
  return e || { format: 'csv', headerRow: ['SKU', 'Title', 'Description'], map: ['sku', 'title', 'description'] };
}

/* A blank custom channel the app's builder starts from. */
export function blankChannel(id) {
  return {
    id, name: 'New channel', short: 'New', group: 'Custom', accent: '#5B6B7F', status: 'custom', policyDate: new Date().toISOString().slice(0, 10),
    site: '', summary: '',
    fields: {
      title: { label: 'Title', max: 150, target: [60, 100], rules: ['noPromo', 'noAllCaps', 'maxRepeat2'] },
      bullets: { label: 'Key Features', count: 5, maxEach: 200, targetEach: [60, 160], rules: ['noPromo'] },
      description: { label: 'Description', max: 3000, target: [600, 1500], rules: ['noPromo'] },
      keywords: { label: 'Search Keywords', maxBytes: 250, target: [80, 200], rules: ['noPromo'] },
    },
    titleSlots: ['brand', 'productType', 'keyFeature', 'material', 'colour', 'size'],
    titleJoin: ' ',
    images: { min: 1, max: 5, minPx: 500, recPx: 1000, mainWhiteBg: true },
    price: { requireMRP: true, sellLteMrp: true },
    compliance: ['hsn'],
    export: { format: 'xlsx', sheet: 'Products', headerRow: ['SKU', 'Title', 'Brand', 'Category', 'Description', 'Key Features', 'Search Keywords', 'MRP', 'Selling Price', 'Stock', 'HSN', 'GST %', 'Image 1', 'Image 2', 'Image 3'], map: ['sku', 'title', 'brand', 'category', 'description', 'bulletsJoined', 'keywords', 'mrp', 'sellingPrice', 'stock', 'hsn', 'gst', 'image1', 'image2', 'image3'] },
  };
}

export const SLOT_LABELS = {
  brand: 'Brand', productType: 'Product type', keyFeature: 'Key feature', material: 'Material', certification: 'Certification',
  size: 'Size', useCase: 'Use case', colour: 'Colour', model: 'Model', packSize: 'Pack size', audience: 'Audience',
};

export const RULE_LABELS = {
  noPromo: 'No promotional words', maxRepeat2: 'No word more than twice', amazonChars: 'No ! $ ? _ { } ^ ¬ ¦', noAllCaps: 'No ALL-CAPS words',
  noPackInTitle: 'Weight / pack count not in title', noTitleWords: 'No words already in the title', noBrand: 'No brand name', noSentence: 'Phrases, not sentences',
  noCommas: 'Space-separated, no commas', noSymbols: 'No symbols', noUnverifiable: 'No unverifiable claims', noMrpClaims: 'No MRP / discount / guarantee claims',
  weaveKeywords: 'Keywords woven into the text',
};
