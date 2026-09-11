/* Security headers on every response. The site is public; there is no gate here (accounts are app-level). */
export const onRequest = async ({ request, next }) => {
  const res = await next();
  const h = new Headers(res.headers);
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('X-Frame-Options', 'SAMEORIGIN');
  h.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  const path = new URL(request.url).pathname;
  if (path.startsWith('/api/')) h.set('Cache-Control', 'no-store');
  /* ⚠ Do NOT try to set Cache-Control on the app's static files here or in _headers.
     Cloudflare Pages overwrites it for assets (measured: every other header set in this
     same block is applied, that one is not — /app/store.js stays max-age=14400 even on
     an edge MISS). What actually keeps a release consistent is the service worker:
     bumping CACHE_NAME re-precaches the whole shell with {cache:'reload'}, which
     bypasses the HTTP cache and swaps every module together. Bump it every release. */
  if (path === '/admin' || path === '/admin.html') h.set('X-Robots-Tag', 'noindex');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
};
