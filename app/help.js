/* IBI Product Listings Master — Help assistant knowledge base + retrieval
 *
 * DESIGN NOTE (read before changing): this is a RETRIEVAL-GROUNDED help bot, not a
 * free-form chatbot. Every answer comes from an article below, so it works offline,
 * costs nothing, and can never invent a feature the app does not have. The optional
 * AI pass (functions/api/ai.js, task:'help') is only allowed to REPHRASE the articles
 * retrieved here — it is given them as the only source and told to refuse otherwise.
 *
 * Adding a topic = adding an object to HELP_ARTICLES. Keep `route` pointing at a real
 * hash route so the answer can offer to open the screen it describes.
 */

export const HELP_VERSION = '1.0.0';

/* ── knowledge base ─────────────────────────────────────────────────────────
 * id     stable key
 * title  the question as a seller would ask it
 * tags   extra words that should match this article (weighted above the body)
 * route  optional hash route the answer offers to open
 * body   plain text; blank line = paragraph, "- " = bullet, "1. " = numbered, **bold**
 */
export const HELP_ARTICLES = [
  {
    id: 'what-is-this', title: 'What does Listings Master do?', tags: ['about', 'overview', 'purpose', 'introduction', 'start here', 'what is this', 'what does it do', 'what is the app', 'this app', 'this tool', 'software'], route: '#/dashboard',
    body: `You enter a product **once**. Listings Master then writes the listing each marketplace wants and hands you that marketplace's own upload sheet.

For every channel it writes the title, the highlights line, the bullet points, the description and the search keywords **inside that platform's own character limits**, past its banned-word and repetition rules, and it checks the Legal Metrology declarations India requires. Each listing gets a score out of 100 so you can see what is still missing.

Thirteen channels are built in: Amazon India, Amazon Bazaar, Flipkart, Shopsy, Meesho, ShopClues, the IBI eCommerce Marketplace, JioMart, Snapdeal, Amazon.com, eBay, Etsy, Shopify and WooCommerce. You can add your own.

It does not upload for you. You download the sheet and upload it in the marketplace's own seller panel, which is one step.`,
  },
  {
    id: 'first-product', title: 'How do I create my first listing?', tags: ['getting started', 'first', 'begin', 'new product', 'add product', 'how to use', 'steps', 'tutorial'], route: '#/products/new',
    body: `Five steps, about ten minutes for the first one.

1. Open **Settings** and fill the business defaults once: brand, manufacturer name and address, consumer care contact, country of origin, default GST. Every new product inherits them, so you never type them again.
2. Go to **Products → + New product**. Fill at least the product type, one or two key features, material, size, price, MRP, HSN and one image URL.
3. Press **Save & open Studio**.
4. In the Studio press **Generate all**. Every enabled channel gets a complete listing.
5. Go to **Exports**, pick the channels and press **Download sheets**.

If you would rather see it working first, press **Load sample product** on the Dashboard. It creates a real product with everything filled in, so you can watch the whole flow before typing anything.`,
  },
  {
    id: 'import-sheet', title: 'Can I import the sheet I already use on Meesho or Flipkart?', tags: ['import', 'upload sheet', 'excel', 'xlsx', 'csv', 'bulk', 'existing catalogue', 'migrate'], route: '#/products',
    body: `Yes. **Products → Import sheet** reads .xlsx, .xls and .csv and maps the columns for you.

It recognises the usual header names from Amazon flat files, Flipkart listing sheets, Meesho catalogues, ShopClues and the IBI bulk template: SKU, product name or title, brand, category, description, key features, keywords, HSN, GST, colour, size, material, MRP, selling price, stock, weight, dimensions, country of origin, manufacturer, warranty, EAN and any column with "image" in its name.

Rows that share the same product title are merged into **one product with variants**, one variant per colour and size. The first image column becomes the main photo.

After importing, open a few products and check the key features and keywords: those are the fields that drive the writing, and most marketplace sheets carry them in a form the importer can only partly read.`,
  },
  {
    id: 'generate', title: 'How do I generate the listings?', tags: ['generate', 'studio', 'create listing', 'write', 'regenerate', 'all channels'], route: '#/studio',
    body: `Open **Listing Studio** and pick the product.

- **Generate all** writes every channel you have selected in the left panel.
- **Generate** on a single card rewrites just that channel.
- **Regenerate** is the same button once a listing exists. It rewrites every field **except the ones you locked**.

Each card shows the score, a length meter under every field, and the checks that passed or failed. Nothing is sent anywhere while you do this: the rule engine runs in your browser.

Use the channel chips in the left panel to work on a few channels at a time. **All / none** flips the whole set.`,
  },
  {
    id: 'edit-lock', title: 'I edited a field. Will Generate overwrite it?', tags: ['edit', 'lock', 'locked', 'padlock', 'overwrite', 'keep my text', 'manual'], route: '#/studio',
    body: `No, once it is locked.

The moment you type in a field it **locks itself** and the padlock beside it closes (🔒). Generate and Regenerate skip every locked field and rewrite only the rest.

Click the padlock to unlock a field again, and the next Generate will rewrite it.

Every generation is kept as a version. The dropdown at the top of each card (v1, v2, v3…) puts an earlier version back on screen, so an edit you regret is never lost. The last twenty versions per channel are kept.`,
  },
  {
    id: 'score', title: 'What does the score out of 100 mean?', tags: ['score', 'grade', 'rating', '100', 'quality', 'low score', 'improve'], route: '#/studio',
    body: `The score tells you how complete and compliant that listing is. It is made of five parts:

- **Length bands, 40 points.** Each field has a band — Amazon's Item Name is 62 to 75 characters, Flipkart's title around 80 to 100, Meesho's name 60 to 80. A field inside its band scores full marks; a short field scores less because you are wasting indexed space.
- **Keyword coverage, 20 points.** How many of the top ranked keywords actually appear in the listing.
- **Compliance, 25 points.** Every error costs 8, every warning 3. Errors are things the marketplace will reject or rewrite.
- **Images, 10 points.** Against that channel's expected count.
- **Attributes, 5 points.** Material, colour, size, weight, HSN, manufacturer.

A score below 70 almost always means the product record is thin, not that the writing is bad. Add key features, use cases, material and the compliance fields, then regenerate.`,
  },
  {
    id: 'amazon-rules', title: 'What are the Amazon title rules?', tags: ['amazon', 'item name', 'highlights', '75', '125', 'bullet points', 'generic keywords', 'bazaar', 'flat file'], route: '#/channels',
    body: `Amazon India's policy of **27 July 2026**, which the app enforces:

- **Item Name: 75 characters maximum.** Anything longer is rewritten by Amazon's own AI without asking you. Brand-registered sellers get a 14-day review window, others get none.
- **Item Highlights: a 125-character field** shown beside the title and **indexed for search just like the title**. Best form is 3 to 5 attribute phrases separated by " · ". Never repeat a title word, never the brand, never a full sentence.
- None of these characters unless they are part of a brand name: ! $ ? _ { } ^
- **No word more than twice** (articles and prepositions are exempt).
- No promotional wording: best, cheap, sale, free, guarantee, No.1, 100%.
- Five bullet points, description up to 2000 characters, backend Generic Keywords under 249 bytes with no brand and no word already in the title.

**Amazon Bazaar** follows the same title policy but is the value store inside the Amazon app: shorter titles, three bullets, and most items sell under ₹600. The app warns you if the price is above that.`,
  },
  {
    id: 'meesho-rules', title: 'Why is Meesho different from the others?', tags: ['meesho', 'no keywords', 'mrp claim', 'rejection', 'catalogue', 'supplier panel'], route: '#/channels',
    body: `Meesho has two rules that trip up sellers who copy an Amazon listing across:

- **There is no backend keyword field.** Search reads the product name and the description only. So the app weaves the search terms into the description instead, and leaves the keywords field empty on purpose.
- **No guarantee, warranty, MRP or discount claims anywhere.** Those cause catalogue rejection. The app strips those words from Meesho text automatically, which is why the Meesho description is shorter than the Flipkart one for the same product.

The product name must be **50 to 120 characters** (60 to 80 reads best), plain, keyword-led, no ALL-CAPS and no symbols. Photos should be square, and the first photo is the catalogue cover.`,
  },
  {
    id: 'flipkart-rules', title: 'What about Flipkart and Shopsy?', tags: ['flipkart', 'shopsy', 'title length', 'claims', 'rejection', 'seller hub'], route: '#/channels',
    body: `**Flipkart** accepts a long title field but search and the app truncate it around **100 characters**, so that is the band the app fills. No ALL-CAPS words, no symbols. The top reason Flipkart rejects text is a **misleading or unverifiable claim** — "world's best", "No.1", "clinically proven" — so the app flags those wordings.

**Shopsy** is Flipkart's zero-commission value app and uses the **same catalogue sheet**. What changes is the writing: mobile-first, shorter title (55 to 80 characters), and the words a bargain shopper types come first. Items above about ₹1,000 rarely rank there, and the app says so.

One export covers both: download the Flipkart sheet and it works for Shopsy.`,
  },
  {
    id: 'keywords-seo', title: 'How does the dynamic SEO work?', tags: ['seo', 'keywords', 'ranking', 'search terms', 'pool', 'synonyms', 'dynamic'], route: '#/keywords',
    body: `Every listing is written from a **ranked keyword pool**, rebuilt each time you generate. Five sources feed it, in weight order:

1. **Your own seller keywords** on the product — the words you know customers type.
2. **The product type and its words**, plus **marketplace synonyms** the app knows: chalni for strainer, dabba for container, jhumka for earrings, payal for anklet, and so on.
3. **Use cases, material, audience and category hints.**
4. **Live search suggestions** — real Google and Amazon.in autocomplete for your product, fetched on demand. These enter near the top and can push an optional title slot out.
5. **Performance boosts** from your own impressions and clicks, once you log them.

Each channel then fills its own visible band from that ranked pool, stopping at its limit and never repeating a word more than the platform allows.

The **Keywords & SEO** screen shows the whole pool with weights and where each term came from.`,
  },
  {
    id: 'live-suggest', title: 'What are live search suggestions?', tags: ['live', 'suggestions', 'autocomplete', 'google', 'trending', 'fetch'], route: '#/keywords',
    body: `They are the real autocomplete phrases Google and Amazon.in offer for your product right now — what people are actually typing this week.

Press **Live keywords** in the Studio, or **Fetch** on the Keywords & SEO screen. They enter the keyword pool with a high weight and are marked green.

Click any suggestion to add it to the product's own seller keywords permanently.

This needs the internet and the online service. Offline, the synonyms and your own keywords still work, so the app keeps writing.`,
  },
  {
    id: 'ai', title: 'What does the AI button do?', tags: ['ai', 'enhance', 'gemini', 'api key', 'polish', 'rewrite', 'quota'], route: '#/settings',
    body: `**✦ Enhance with AI** asks a language model to rewrite the listing more naturally, then puts every field it returns **back through the rule engine**. So the AI can improve the wording but can never push a field over a limit, past a banned word, or outside a marketplace rule. Locked fields are left alone.

Two ways to power it, chosen in **Settings → AI**:

- **The Listings Master service.** A monthly quota per plan: 10 on Free, 150 on Starter, 600 on Pro, 2500 on Business. Nothing to set up.
- **Your own Gemini API key.** Free from aistudio.google.com. The key is stored **only in this browser**, never synced, never in a backup, and the request goes from your device straight to Google.

Use AI when the rule-engine text reads flat. For a well-filled product record the difference is small: the rules do most of the work.`,
  },
  {
    id: 'export', title: 'How do I upload the listings to the marketplace?', tags: ['export', 'download', 'sheet', 'xlsx', 'csv', 'upload', 'flat file', 'bulk upload', 'seller central'], route: '#/exports',
    body: `Go to **Exports**, tick the channels and the products, then **Download sheets**. You get one file per channel, in that marketplace's own column layout, one row per variant.

Where each one goes:

- **Amazon India / Bazaar** — Seller Central → Catalogue → Add Products via Upload. Open your category's flat file, paste these columns into the Template sheet, upload. Columns your category template does not have are simply ignored.
- **Flipkart / Shopsy** — Seller Hub → Listings → Add new listings → bulk. One sheet serves both apps.
- **Meesho** — Supplier Panel → Catalog Upload → Bulk.
- **ShopClues** — Seller Panel → Bulk Upload.
- **IBI eCommerce Marketplace** — Seller Central → Bulk Upload accepts the sheet as it is.
- **Shopify / WooCommerce** — their own product importer CSV.

Every sheet carries a "Read me" tab with the same instructions and the date it was generated.`,
  },
  {
    id: 'images', title: 'Why do my images not appear in the export?', tags: ['image', 'photo', 'url', 'upload picture', 'drive', 'missing image', 'blank'], route: '#/products',
    body: `Marketplace sheets need a **public image URL**, not a file. A picture you upload with "Upload for preview" is stored on this device only, shows in the app, and is deliberately left out of the sheet and out of cloud sync.

Use a link anyone can open: a Google Drive file set to "anyone with the link", your own website, or any image host. Paste it into the URL box and press **Add URL**.

The order matters: **the first image is the main photo** on every marketplace. Use the "◀ earlier" and "later ▶" buttons to reorder.

What each channel expects is on its card in **Channels** — Amazon wants 1000px or more on a pure white background with the product filling at least 85% of the frame, Meesho wants square photos, Flipkart 500px or more.`,
  },
  {
    id: 'variants', title: 'How do I handle colours and sizes?', tags: ['variant', 'colour', 'color', 'size', 'options', 'matrix', 'multiple sku'], route: '#/products',
    body: `Use the **Variants** section at the bottom of the product form. One row per colour and size combination, each with its own SKU, and optionally its own price, MRP and stock.

Every variant becomes **one row** in every export sheet, which is exactly what the marketplaces expect. A variant that leaves price or stock empty inherits the product's own.

Leave the section empty for a single-SKU product and the sheet gets one row.

When you import a sheet, rows sharing the same product title are turned into variants automatically.`,
  },
  {
    id: 'compliance', title: 'What are the Legal Metrology fields for?', tags: ['legal metrology', 'compliance', 'manufacturer', 'net quantity', 'country of origin', 'consumer care', 'mandatory', 'declaration', 'hsn', 'gst'], route: '#/settings',
    body: `Indian marketplaces enforce the Legal Metrology (Packaged Commodities) Rules on every listing. Six declarations are mandatory:

- Name and address of the **manufacturer, packer or importer**
- The **common or generic name** of the commodity
- **Net quantity** (for example "1 N", "500 g")
- **MRP**, inclusive of all taxes
- **Country of origin**
- **Consumer care** contact, a phone number or email

Fill them once in **Settings → Business defaults** and every new product inherits them. The app checks them per channel and writes them into the sheet columns that need them. A missing one shows as a red error on the listing card, because the marketplace will reject or suppress the listing.

**HSN** must be 4, 6 or 8 digits and **GST** one of 0, 3, 5, 12, 18 or 28.`,
  },
  {
    id: 'performance', title: 'How does the performance loop improve my titles?', tags: ['performance', 'ctr', 'impressions', 'clicks', 'orders', 're-optimise', 'reoptimise', 'data', 'improve ranking'], route: '#/performance',
    body: `After a listing has been live for a week or two, take the numbers from the marketplace's own report and log them here.

1. Open **Performance**, pick the product.
2. Choose the channel, press **Use current title** so the exact live title is recorded, and enter impressions, clicks and orders for the period.
3. Add a second row later, or for another channel, so there is something to compare.

The app then compares click-through rates and works out which **words** ride with the better performing titles. Those words move earlier in the keyword pool; words that sit in the weaker titles move later or drop out. Press **Re-optimise titles** and every unlocked title is rewritten with that knowledge.

It also tells you when a listing gets clicks but few orders — that is a price, photo or bullet problem, not a title problem.`,
  },
  {
    id: 'custom-channel', title: 'Can I add a marketplace that is not in the list?', tags: ['custom channel', 'new marketplace', 'add channel', 'own store', 'other platform'], route: '#/channels',
    body: `Yes, with no code. **Channels → + Custom channel**, or **Duplicate as custom** on a built-in channel that is close to what you need.

You define: the character limit and target band for each field, which rules apply (no promotional words, no ALL-CAPS, no word more than twice, and so on), the order of the title slots, the image and price requirements, the compliance declarations, and the **exact column headers of that platform's sheet** with which field fills each column.

The engine then treats it like any built-in marketplace: generation, validation, scoring and export all work.

How many custom channels you may keep depends on your plan: one on Free, three on Starter, unlimited on Pro and Business.`,
  },
  {
    id: 'plans', title: 'What do the plans cost and what are the limits?', tags: ['plan', 'price', 'pricing', 'upgrade', 'free', 'starter', 'pro', 'business', 'billing', 'payment', 'subscription', 'cost'], route: '#/account',
    body: `All prices include GST and are for one month. Plans do not renew automatically.

- **Free, ₹0** — every channel, unlimited products on this device, 25 products in cloud sync, 10 AI enhancements a month, 1 custom channel.
- **Starter, ₹499** — 300 products in sync, 150 AI a month, 3 custom channels.
- **Pro, ₹1,499** — 3,000 products, 600 AI, unlimited custom channels, 3 seats.
- **Business, ₹3,999** — 25,000 products, 2,500 AI, unlimited custom channels, 10 seats.

**Local use is unlimited on every plan.** The product limit applies only to the cloud copy, so the Free plan never stops you working — it limits how much syncs between devices.

Payment is by card, UPI or netbanking where checkout is enabled; otherwise pay by UPI to indiabusinessinternational@okicici and send the reference on WhatsApp, and the plan is switched on within 12 hours.`,
  },
  {
    id: 'account-sync', title: 'Do I need an account? What does syncing do?', tags: ['account', 'sign in', 'login', 'sync', 'devices', 'cloud', 'password'], route: '#/account',
    body: `No account is needed. Everything works in this browser and stays there — that is **local mode**, and it never expires.

An account adds three things: the workspace syncs across your laptop, phone and staff devices; server-side AI with a plan quota; and plan upgrades.

Sync merges rather than overwrites: for each record the newer edit wins, so working on two devices does not lose anything. It runs a few seconds after a change when **Auto-sync** is on, and **Sync now** forces it.

The cloud icon in the top bar is the status: green is synced, grey is local mode, red means the last sync failed — hover it for the reason.

Your password is stored only as a salted hash. Changing it signs out other devices.`,
  },
  {
    id: 'backup', title: 'How do I back up or move my data?', tags: ['backup', 'restore', 'export data', 'json', 'transfer', 'new computer', 'lost data'], route: '#/settings',
    body: `**Settings → Download backup** (also on the Account page) writes one JSON file containing every product, listing, performance row, custom channel and setting.

**Restore backup** reads that file back and merges it into the current workspace, so you can move to another computer or browser without an account.

API keys are never included in a backup, by design.

**Reset this device** wipes the local copy only. If you are signed in, the cloud copy is untouched and comes back on the next sync.`,
  },
  {
    id: 'offline', title: 'Does it work offline?', tags: ['offline', 'internet', 'no connection', 'pwa', 'install', 'app', 'mobile'], route: '#/dashboard',
    body: `Yes. The rule engine, all your products, generation, scoring and CSV export run entirely in the browser with no network.

What needs the internet: live search suggestions, AI enhancement, cloud sync, plan changes, and the spreadsheet library used for .xlsx export (CSV export still works offline).

You can install it like an app: in Chrome open the menu and choose "Install" or "Add to Home screen". It then opens in its own window and works without a connection.`,
  },
  {
    id: 'privacy', title: 'Where is my data stored? Is it private?', tags: ['privacy', 'data', 'secure', 'security', 'safe', 'is my data safe', 'confidential', 'dpdp', 'delete account', 'where stored', 'who can see'], route: '#/account',
    body: `In local mode your data never leaves the browser: it is held in IndexedDB on this device.

If you sign in and sync, a copy is stored in IBI's cloud (Cloudflare KV, edge storage with India points of presence). Local image previews are stripped from that copy on purpose.

An API key you paste for AI stays in this browser's local storage. It is never synced, never backed up and never sent to IBI.

You can export everything at any time, and **Account → Delete account** removes the cloud copy; the local copy stays until you reset the device. The full detail is in the privacy policy linked from the site footer.`,
  },
  {
    id: 'trouble-ai', title: 'The AI button says it is not available', tags: ['ai not working', 'error', 'quota', 'not configured', 'failed', 'trouble'], route: '#/settings',
    body: `Three usual reasons:

- **You are offline.** Server AI needs a connection. The rule engine still generates complete listings.
- **Your monthly quota is used up.** The Account page shows how many are left. Either upgrade, or switch **Settings → AI** to "My own Gemini API key" and paste a free key from aistudio.google.com.
- **Server AI is not configured on this deployment.** Same fix: use your own key.

If a single channel fails and others work, the model returned something unusable for that one. Press ✦ AI on that card again.`,
  },
  {
    id: 'trouble-general', title: 'Something is wrong — export empty, sync failing, score stuck', tags: ['problem', 'bug', 'not working', 'empty', 'failed', 'stuck', 'error', 'troubleshoot'], route: '#/help',
    body: `- **The sheet downloads empty or without images** — the products had no public image URLs, or no listing was generated. Generate first; the exporter will generate on the fly, but photos must be http links.
- **.xlsx will not download** — the spreadsheet library needs one online load. Offline, the app falls back to CSV, which every marketplace accepts.
- **Sync failed** — hover the cloud icon for the reason. "Plan limit" means more products than your plan syncs; local work is unaffected.
- **The score will not rise** — read the checks under the fields. Info lines are suggestions, amber is a warning, red is something the marketplace will reject. Most stuck scores are a missing manufacturer address, net quantity or HSN.
- **A field looks wrong and Generate will not fix it** — it is locked. Click the padlock, then Generate.

Still stuck: WhatsApp +91 89394 14799 with the product name and the channel.`,
  },
  {
    id: 'contact', title: 'How do I contact a human?', tags: ['support', 'contact', 'whatsapp', 'email', 'talk to someone', 'human', 'call', 'phone number'], route: '#/help',
    body: `WhatsApp **+91 89394 14799** or email **indiabusinessinternational@gmail.com**, Monday to Saturday, Indian business hours. Paid plans are answered first.

Tell us the product name, the channel and what you expected — that is usually enough to answer in one reply.`,
  },
];

/* ── retrieval ──────────────────────────────────────────────────────────── */
const STOP = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'do', 'does', 'did', 'how', 'what', 'why', 'when', 'where', 'which', 'who', 'can', 'i', 'my', 'me', 'you', 'your', 'we', 'it', 'its', 'to', 'of', 'for', 'in', 'on', 'at', 'and', 'or', 'but', 'with', 'from', 'by', 'this', 'that', 'these', 'those', 'be', 'been', 'have', 'has', 'had', 'will', 'would', 'should', 'could', 'please', 'help', 'about', 'there', 'their', 'not', 'no', 'yes', 'if', 'so', 'then', 'than', 'as', 'get', 'got', 'want', 'need', 'tell', 'show', 'explain', 'am']);

/* Words a seller uses → words the articles use. */
const SYN = {
  upload: ['export', 'sheet', 'download'], publish: ['export', 'upload'], list: ['listing'], listings: ['listing'],
  photo: ['image'], photos: ['image'], picture: ['image'], pictures: ['image'], pic: ['image'],
  price: ['mrp', 'pricing', 'plan'], cost: ['price', 'plan', 'pricing'], money: ['price', 'plan'], pay: ['billing', 'plan', 'payment'], buy: ['plan', 'billing'], subscribe: ['plan', 'billing'],
  keyword: ['keywords', 'seo'], seo: ['keywords', 'ranking'], rank: ['ranking', 'seo'], ranking: ['seo', 'keywords'], search: ['keywords', 'seo'],
  amazon: ['amazon'], flipkart: ['flipkart'], meesho: ['meesho'], shopsy: ['shopsy'], shopclues: ['shopclues'], bazaar: ['amazon'],
  title: ['title', 'item name'], name: ['title'], bullet: ['bullets'], bullets: ['bullets'], description: ['description'],
  chatbot: ['help'], bot: ['help'], assistant: ['help', 'ai'],
  begin: ['getting started', 'first'], start: ['getting started', 'first'], started: ['getting started'], new: ['first', 'new product'],
  excel: ['xlsx', 'sheet', 'import'], spreadsheet: ['sheet', 'xlsx'], csv: ['csv', 'sheet'], file: ['sheet', 'export'],
  variant: ['variants'], colour: ['variants', 'colour'], color: ['variants', 'colour'], size: ['variants', 'size'],
  save: ['backup'], backup: ['backup'], lost: ['backup', 'restore'], transfer: ['backup'],
  secure: ['privacy'], private: ['privacy'], safe: ['privacy'], data: ['privacy', 'backup'],
  broken: ['problem', 'troubleshoot'], wrong: ['problem'], error: ['problem'], fail: ['problem'], failing: ['problem'], fix: ['problem'],
  edit: ['edit', 'lock'], change: ['edit'], overwrite: ['lock'], locked: ['lock'],
  compliance: ['legal metrology'], legal: ['legal metrology'], mandatory: ['legal metrology'], gst: ['gst', 'legal metrology'], hsn: ['hsn'],
  free: ['plan', 'free'], limit: ['plan', 'limits'], quota: ['plan', 'ai'],
  account: ['account'], login: ['account', 'sign in'], signin: ['account'], password: ['account'], sync: ['sync', 'account'],
  offline: ['offline'], internet: ['offline'], install: ['offline', 'pwa'], mobile: ['offline'], phone: ['offline', 'contact'],
  score: ['score'], improve: ['score', 'performance'], better: ['score', 'performance'],
  ctr: ['performance'], clicks: ['performance'], impressions: ['performance'], sales: ['performance'],
};

const tokens = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\p{M}\s.]+/gu, ' ').split(/\s+/).filter(w => w && w.length > 1 && !STOP.has(w));

function expand(ws) {
  const out = new Set(ws);
  for (const w of ws) {
    (SYN[w] || []).forEach(s => s.split(' ').forEach(x => out.add(x)));
    if (w.endsWith('s') && w.length > 3) out.add(w.slice(0, -1));
    else out.add(w + 's');
  }
  return [...out];
}

/* Returns [{article, score}] best first. */
export function searchHelp(query, limit = 4) {
  const raw = tokens(query);
  if (!raw.length) return [];
  const terms = expand(raw);
  const q = String(query || '').toLowerCase();
  const scored = HELP_ARTICLES.map(a => {
    const title = a.title.toLowerCase(), tags = a.tags.join(' ').toLowerCase(), body = a.body.toLowerCase();
    let s = 0;
    for (const t of terms) {
      if (title.includes(t)) s += 5;
      if (tags.includes(t)) s += 4;
      const n = body.split(t).length - 1;
      if (n) s += Math.min(3, n);
    }
    // whole-phrase bonus: the seller typed something close to the article's own words
    for (const tg of a.tags) if (tg.length > 4 && q.includes(tg)) s += 6;
    // normalise so long articles do not always win
    return { article: a, score: s / (1 + Math.log(1 + a.body.length / 400)) };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

export const CONFIDENT = 8;

/* Suggested questions. `route` lets the panel show what fits the screen you are on. */
export const STARTERS = [
  { q: 'How do I create my first listing?', route: 'dashboard' },
  { q: 'Can I import my Meesho or Flipkart sheet?', route: 'products' },
  { q: 'What are the Amazon title rules?', route: 'studio' },
  { q: 'Why is Meesho different?', route: 'studio' },
  { q: 'What does the score mean?', route: 'studio' },
  { q: 'How does the dynamic SEO work?', route: 'keywords' },
  { q: 'How do I upload the sheet to the marketplace?', route: 'exports' },
  { q: 'What do the plans cost?', route: 'account' },
  { q: 'Does it work offline?', route: 'settings' },
  { q: 'Where is my data stored?', route: 'settings' },
  { q: 'How does the performance loop work?', route: 'performance' },
  { q: 'Can I add another marketplace?', route: 'channels' },
];

/* What to offer first on a given screen. */
export function startersFor(routeName) {
  const mine = STARTERS.filter(s => s.route === routeName);
  const rest = STARTERS.filter(s => s.route !== routeName);
  return [...mine, ...rest].slice(0, 4);
}

/* Build an answer from the knowledge base alone. Always returns something usable. */
export function answerFromKb(query, ctx = {}) {
  const hits = searchHelp(query, 4);
  if (!hits.length || hits[0].score < 3) {
    return {
      kind: 'nomatch',
      text: `I could not match that to a help topic. Try one of these, or ask in other words — and if it is about your own account or an order, WhatsApp +91 89394 14799.`,
      related: startersFor(ctx.route).map(s => s.q),
      articles: [],
    };
  }
  const top = hits[0].article;
  return {
    kind: hits[0].score >= CONFIDENT ? 'answer' : 'maybe',
    text: top.body,
    title: top.title,
    route: top.route,
    articles: hits.map(h => h.article),
    related: hits.slice(1, 4).map(h => h.article.title),
  };
}

/* Prompt for the optional AI rephrase. The articles are the ONLY permitted source. */
export function buildHelpPrompt(query, articles, ctx = {}) {
  const src = articles.slice(0, 3).map((a, i) => `[${i + 1}] ${a.title}\n${a.body}`).join('\n\n---\n\n');
  return {
    system: `You are the help assistant inside IBI Product Listings Master, a SaaS app that turns one product record into marketplace-ready listings. Answer ONLY from the help articles provided. If the articles do not contain the answer, say so in one sentence and suggest contacting IBI on WhatsApp at +91 89394 14799 — never guess, never invent a feature, a price, a limit or a menu item. Write plain, calm English for an Indian e-commerce seller who is new to the app. Two to six short sentences, or a numbered list when the answer is a sequence of steps. No marketing language. Do not mention that you were given articles.`,
    user: `The seller is on the "${ctx.route || 'dashboard'}" screen and asks: "${query}"\n\nHelp articles:\n\n${src}`,
  };
}

/* Tiny safe renderer: escape first, then apply the few markers used in bodies. */
export function renderHelpText(text, esc) {
  const lines = String(text || '').split('\n');
  let html = '', list = null;
  const close = () => { if (list) { html += `</${list}>`; list = null; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { close(); continue; }
    const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
    const ol = line.match(/^(\d+)\.\s+(.*)$/);
    const ul = line.match(/^[-•]\s+(.*)$/);
    if (ol) { if (list !== 'ol') { close(); html += '<ol>'; list = 'ol'; } html += `<li>${inline(ol[2])}</li>`; }
    else if (ul) { if (list !== 'ul') { close(); html += '<ul>'; list = 'ul'; } html += `<li>${inline(ul[1])}</li>`; }
    else { close(); html += `<p>${inline(line)}</p>`; }
  }
  close();
  return html;
}
