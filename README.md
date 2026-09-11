# IBI Product Listings Master v1.1.0

**List once, sell everywhere.** A SaaS web app by India Business International: one master product record in, marketplace-ready listings out for Amazon India, Amazon Bazaar, Flipkart, Shopsy, Meesho, ShopClues, the IBI eCommerce Marketplace and more (JioMart, Snapdeal, Amazon.com, eBay, Etsy, Shopify, WooCommerce as preview channels, plus a no-code custom-channel builder), with dynamic SEO, compliance checks, a 0–100 listing score, exact upload sheets and a performance feedback loop.

Live: `https://listingsmaster.indiabusinessinternational.online` (Cloudflare Pages). App at `/app/`, owner console at `/admin`.

## Layout

```
index.html, terms/privacy/refunds/contact.html, legal.css   marketing site + legal pages
app/                 the application (vanilla ES modules, PWA, IndexedDB local-first)
  channels.js        channel registry — one object per marketplace (limits, rules, slots, sheet columns)
  engine.js          rule engine: keyword pool, slot title composer, validators, score, performance boosts, export rows
  help.js            Help assistant: the knowledge base + retrieval. Grounded — AI may only rephrase what it retrieves
  app.js             UI (hash router, views, every control via data-act → A.*)
  store.js           IndexedDB + cloud sync client;  exporter.js  SheetJS/CSV;  ai.js  AI client
  sw.js              service worker (CACHE_NAME moves with the version)
functions/           Cloudflare Pages Functions (backend, raw HTTP to providers, KV storage)
  api/_lib.js        VERSION, plans, PBKDF2 passwords, HMAC sessions, KV user model, rate limits
  api/version.js     GET  → version + configured features  (the app shows "Backend vX ✓ in step")
  api/auth/[action]  signup · login · logout · me · password · delete
  api/data.js        GET/PUT the signed-in user's workspace (plan product limit enforced)
  api/ai.js          POST server-side AI enhancement (Anthropic / Gemini / DeepSeek / local), monthly quota per plan
  api/suggest.js     GET ?q= live Google + Amazon.in autocomplete for the keyword pool (KV-cached 24 h)
                     (api/ai.js also serves task:'help' — no sign-in, no listing quota, 25/hour per IP)
  api/billing/       order (Razorpay order, amount set server-side) · webhook (HMAC-verified, idempotent) · status
  api/admin.js       owner console API (x-admin-token)
tests/               node --test tests/   and   node tests/audit_actions.mjs (dead-control audit)
```

## Cloudflare Pages setup (one-time, dashboard)

1. Workers & Pages → Create → Pages → connect this repo. Build command: none. Output directory: `/`.
2. KV: create a namespace (e.g. `plm-data`) and bind it as **`PLM_KV`** (Production).
3. Environment variables (Production):
   - `SESSION_SECRET` — long random string (accounts fail closed without it)
   - `ADMIN_TOKEN` — for `/admin`
   - AI (any one; `AI_PROVIDER` picks when several exist): `ANTHROPIC_API_KEY` (+ optional `ANTHROPIC_MODEL`, default `claude-opus-5`), `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, or `LOCAL_AI_URL` + `LOCAL_AI_CODE`
   - Billing (optional): `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`; webhook URL `https://<host>/api/billing/webhook`, event `payment.captured`
4. Custom domain `listingsmaster.indiabusinessinternational.online`.

Without any of this the site still works fully in local mode (rule engine, exports, backups); `/api/version` reports which features are configured and the app adapts.

## Plans (GST inclusive, monthly, no auto-renew)

| Plan | Price | Cloud products | AI / month | Custom channels | Seats |
|---|---|---|---|---|---|
| Free | ₹0 | 25 | 10 | 1 | 1 |
| Starter | ₹499 | 300 | 150 | 3 | 1 |
| Pro | ₹1,499 | 3,000 | 600 | unlimited | 3 |
| Business | ₹3,999 | 25,000 | 2,500 | unlimited | 10 |

Local use is unlimited on every plan. Limits live in `functions/api/_lib.js` (enforced) and `app/app.js` (displayed) — change both.

## Releasing

Bump the same string in: `app/index.html` badge, `app/store.js` APP_VERSION, `app/sw.js` CACHE_NAME, `functions/api/_lib.js` VERSION, the root pages' `.ver` badge, `package.json`, this heading; then `git tag -a vX.Y.Z`.

## Tests

```
npm test                       # engine + channels, backend Functions, help assistant
node tests/audit_actions.mjs   # every data-act has a handler
```

## Help assistant

A floating ? button on every screen, and the Help page, answer from `app/help.js` — a knowledge
base of ~26 articles with keyword retrieval and marketplace synonyms. It works offline and never
invents a feature. When an AI engine is available the retrieved articles are sent to it to rephrase,
grounded, with an explicit instruction to refuse anything the articles do not contain; a failure
there silently leaves the knowledge-base answer standing. `?help=1` opens the assistant,
`?help=<article-id>` opens it on that answer — send a seller that link instead of typing the answer.
