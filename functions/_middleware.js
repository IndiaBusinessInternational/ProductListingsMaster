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
  if (path === '/admin' || path === '/admin.html') h.set('X-Robots-Tag', 'noindex');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
};
