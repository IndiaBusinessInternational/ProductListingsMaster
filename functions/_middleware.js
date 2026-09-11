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
  /* The app's filenames are not content-hashed, and Cloudflare Pages serves static
     assets with max-age=14400 — a Cache-Control line in _headers is ignored for them,
     so after a release a returning visitor could run a fresh index.html against four
     hours of stale modules (seen live: badge v1.1.2 beside "App v1.1.0"). Middleware
     headers do win, so revalidate the shell every load. The ETag makes that a 304 of a
     few bytes, and the service worker still serves these from its own cache offline. */
  if (/^\/app\/.*\.(?:js|css|webmanifest)$/.test(path) || path === '/app/' || path === '/app/index.html') h.set('Cache-Control', 'no-cache');
  if (path === '/admin' || path === '/admin.html') h.set('X-Robots-Tag', 'noindex');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
};
