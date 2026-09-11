/* /api/auth/{signup|login|logout|me|password|delete} */
import { json, err, notConfigured, readJson, isEmail, userKey, getUserByEmail, getUserById, putUser, hashPassword, randomHex, safeEq, makeSession, cookieHeader, sessionUser, rateLimit, clientIp, publicUser, aiUsed, SESSION_DAYS, handle } from '../_lib.js';

export const onRequest = handle(async ({ request, env, params }) => {
  const action = params.action;
  if (!env.PLM_KV || !env.SESSION_SECRET) return action === 'me' ? json({ user: null, code: 'not_configured' }) : notConfigured('Accounts');
  const ip = clientIp(request);

  if (action === 'me') {
    if (request.method !== 'GET') return err('GET only', 405);
    const u = await sessionUser(request, env); if (!u) return json({ user: null }, 401);
    return json({ user: publicUser(u, await aiUsed(env, u.id)) });
  }
  if (request.method !== 'POST') return err('POST only', 405);

  if (action === 'signup') {
    if (!await rateLimit(env, 'signup:' + ip, 10, 3600)) return err('Too many sign-ups from this network; try later', 429);
    const b = await readJson(request) || {}; const email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || '');
    if (!isEmail(email)) return err('Enter a valid email address');
    if (pw.length < 8) return err('Password must be at least 8 characters');
    if (await getUserByEmail(env, email)) return err('An account with that email already exists — sign in instead', 409);
    const salt = randomHex(16), u = { id: randomHex(12), email, name: String(b.name || '').trim().slice(0, 80), salt, pwHash: await hashPassword(pw, salt), sessionSalt: randomHex(8), plan: 'free', planUntil: null, createdAt: new Date().toISOString() };
    await putUser(env, u);
    return json({ ok: true, user: publicUser(u, 0) }, 200, { 'Set-Cookie': cookieHeader(await makeSession(env, u), SESSION_DAYS * 86400) });
  }
  if (action === 'login') {
    const b = await readJson(request) || {}; const email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || '');
    if (!await rateLimit(env, 'login:' + ip, 30, 900) || !await rateLimit(env, 'login:' + email, 10, 900)) return err('Too many attempts; wait 15 minutes', 429);
    const u = await getUserByEmail(env, email);
    const ok = u && safeEq(await hashPassword(pw, u.salt), u.pwHash);
    if (!ok) return err('Email or password is wrong', 401);
    return json({ ok: true, user: publicUser(u, await aiUsed(env, u.id)) }, 200, { 'Set-Cookie': cookieHeader(await makeSession(env, u), SESSION_DAYS * 86400) });
  }
  if (action === 'logout') return json({ ok: true }, 200, { 'Set-Cookie': cookieHeader('', 0) });

  const u = await sessionUser(request, env); if (!u) return err('Sign in required', 401);
  if (action === 'password') {
    const b = await readJson(request) || {};
    if (!safeEq(await hashPassword(String(b.oldPassword || ''), u.salt), u.pwHash)) return err('Current password is wrong', 401);
    if (String(b.newPassword || '').length < 8) return err('New password must be at least 8 characters');
    u.salt = randomHex(16); u.pwHash = await hashPassword(String(b.newPassword), u.salt); u.sessionSalt = randomHex(8); // rotates every other session
    await putUser(env, u);
    return json({ ok: true }, 200, { 'Set-Cookie': cookieHeader(await makeSession(env, u), SESSION_DAYS * 86400) });
  }
  if (action === 'delete') {
    const b = await readJson(request) || {};
    if (!safeEq(await hashPassword(String(b.password || ''), u.salt), u.pwHash)) return err('Password is wrong', 401);
    await env.PLM_KV.delete(await userKey(u.email)); await env.PLM_KV.delete('uid:' + u.id); await env.PLM_KV.delete('ws:' + u.id);
    return json({ ok: true }, 200, { 'Set-Cookie': cookieHeader('', 0) });
  }
  return err('Unknown auth action', 404);
});
