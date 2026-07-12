import {
  signJWT, verifyJWT, parseCookies,
  assertSecretStrength, JWT_EXPIRES_SEC,
} from '../../utils/jwt';
import {
  getSecurityHeaders, isOriginAllowed, isHumanUserAgent,
  checkRateLimit, tooManyRequests, forbidden,
  recordAuthFailure, isAuthLocked, clearAuthFailures, locked,
} from '../../utils/security';
import { logRequest } from '../../utils/logger';


interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID:     string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
  APP_URL: string;
}

/** Cryptographically random state string for OAuth CSRF protection */
function generateState(): string {
  const arr = new Uint8Array(18);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/** Build secure cookie flags for the current environment */
function cookieFlags(appUrl: string, path: string, maxAge: number): string {
  return `HttpOnly; Secure; SameSite=Lax; Path=${path}; Max-Age=${maxAge}`;
}

// ─── Revocation helpers ───────────────────────────────────────────────────────

/** Write jti to revoked_tokens and clean up already-expired rows in one batch. */
async function revokeToken(db: D1Database, jti: string, exp: number): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.batch([
    // Purge expired revocations first (housekeeping, free on every logout)
    db.prepare('DELETE FROM revoked_tokens WHERE exp < ?').bind(now),
    db.prepare('INSERT OR IGNORE INTO revoked_tokens (jti, exp) VALUES (?,?)').bind(jti, exp),
  ]);
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export const onRequestOptions: PagesFunction<Env> = (ctx) =>
  new Response(null, { headers: getSecurityHeaders(ctx.env.APP_URL) });

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;
  const url    = new URL(request.url);
  const action = url.pathname.split('/').pop();   // login | callback | me | logout
  const h      = getSecurityHeaders(env.APP_URL);

  // ── Startup guard: reject if JWT_SECRET is too weak ─────────────────────
  try { assertSecretStrength(env.JWT_SECRET, 'JWT_SECRET'); }
  catch (e: unknown) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), { status: 500, headers: h });
  }

  // ── Origin enforcement (me / logout are browser-initiated) ───────────────
  if (action === 'me' || action === 'logout') {
    if (!isOriginAllowed(request, env.APP_URL)) {
      return forbidden('Forbidden: invalid request origin', h);
    }
  }

  // ── Extract real client IP ────────────────────────────────────────────────
  const clientIp = request.headers.get('CF-Connecting-IP')
    ?? request.headers.get('X-Forwarded-For')?.split(',')[0].trim()
    ?? 'unknown';

  // ── Bot / headless scanner detection ─────────────────────────────────────
  // OAuth callback is browser-driven (no UA check) but all direct API calls
  // (me, logout) must come from a real browser.
  if (action !== 'callback' && !isHumanUserAgent(request)) {
    ctx.waitUntil(logRequest(env.DB, request, 'bot_blocked', clientIp, {
      severity: 'warn',
      details:  { action, ua: request.headers.get('user-agent') },
    }));
    return forbidden('Forbidden: automated clients are not permitted', h);
  }

  // ── IP lockout check (before rate limit, before any DB reads) ────────────
  const lock = await isAuthLocked(env.DB, clientIp);
  if (lock.locked) {
    ctx.waitUntil(logRequest(env.DB, request, 'auth_lockout', clientIp, {
      severity: 'warn',
      details:  { resetIn: lock.resetIn },
    }));
    return locked(lock.resetIn, h);
  }

  // ── Rate limiting — strict 10 req/min per IP for auth endpoints ──────────
  const rl = await checkRateLimit(env.DB, clientIp, 'auth');
  if (!rl.ok) {
    ctx.waitUntil(logRequest(env.DB, request, 'rate_limit_ip', clientIp, {
      severity: 'warn',
      status:   429,
      details:  { bucket: 'auth', limit: rl.limit, resetIn: rl.resetIn },
    }));
    return tooManyRequests(rl.resetIn, h, rl.limit);
  }

  // Add no-cache to all auth responses
  const authH = { ...h, 'Cache-Control': 'no-store, no-cache, must-revalidate' };

  // ── GET /api/auth/login ──────────────────────────────────────────────────
  if (action === 'login') {
    const state       = generateState();
    const redirectUri = `${env.APP_URL}/api/auth/callback`;
    const params = new URLSearchParams({
      client_id:     env.GOOGLE_CLIENT_ID,
      redirect_uri:  redirectUri,
      response_type: 'code',
      scope:         'openid email profile',
      access_type:   'online',
      prompt:        'select_account',
      state,
    });
    return new Response(null, {
      status: 302,
      headers: {
        Location:   `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
        'Set-Cookie': `mt_oauth_state=${state}; ${cookieFlags(env.APP_URL, '/api/auth', 600)}`,
        'Cache-Control': 'no-store',
      },
    });
  }

  // ── GET /api/auth/callback ───────────────────────────────────────────────
  if (action === 'callback') {
    // Account-creation limit: stricter than general auth (5/min per IP).
    // This throttles automated sign-up scripts that cycle OAuth flows.
    const acRl = await checkRateLimit(env.DB, clientIp, 'account-create');
    if (!acRl.ok) {
      ctx.waitUntil(logRequest(env.DB, request, 'rate_limit_ip', clientIp, {
        severity: 'warn',
        status:   429,
        details:  { bucket: 'account-create', limit: acRl.limit },
      }));
      return tooManyRequests(acRl.resetIn, h, acRl.limit);
    }

    const code          = url.searchParams.get('code');
    const returnedState = url.searchParams.get('state');
    const storedState   = parseCookies(request)['mt_oauth_state'];

    // CSRF guard: state must match what we set on /login
    if (!returnedState || !storedState || returnedState !== storedState) {
      await Promise.all([
        recordAuthFailure(env.DB, clientIp),
        logRequest(env.DB, request, 'auth_csrf_blocked', clientIp, {
          severity: 'warn',
          details:  { returnedState: returnedState ?? 'missing', storedState: storedState ? 'present' : 'missing' },
        }),
      ]);
      return Response.redirect(`${env.APP_URL}/?auth_error=csrf`, 302);
    }
    if (!code) {
      await Promise.all([
        recordAuthFailure(env.DB, clientIp),
        logRequest(env.DB, request, 'auth_login_failure', clientIp, {
          severity: 'warn',
          details:  { reason: 'no_code' },
        }),
      ]);
      return Response.redirect(`${env.APP_URL}/?auth_error=no_code`, 302);
    }

    // Exchange code → tokens
    let accessToken: string;
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id:     env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,   // NEVER sent to frontend
          redirect_uri:  `${env.APP_URL}/api/auth/callback`,
          grant_type:    'authorization_code',
        }),
      });
      if (!tokenRes.ok) {
        await Promise.all([
          recordAuthFailure(env.DB, clientIp),
          logRequest(env.DB, request, 'auth_login_failure', clientIp, {
            severity: 'warn',
            details:  { reason: 'token_exchange_failed', status: tokenRes.status },
          }),
        ]);
        return Response.redirect(`${env.APP_URL}/?auth_error=token`, 302);
      }
      const td = await tokenRes.json<{ access_token: string }>();
      accessToken = td.access_token;
    } catch {
      await Promise.all([
        recordAuthFailure(env.DB, clientIp),
        logRequest(env.DB, request, 'auth_login_failure', clientIp, {
          severity: 'warn',
          details:  { reason: 'token_exchange_exception' },
        }),
      ]);
      return Response.redirect(`${env.APP_URL}/?auth_error=token`, 302);
    }

    // Fetch verified Google user info
    let gUser: { sub: string; email: string; name: string; picture: string; email_verified: boolean };
    try {
      const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userRes.ok) {
        await Promise.all([
          recordAuthFailure(env.DB, clientIp),
          logRequest(env.DB, request, 'auth_login_failure', clientIp, {
            severity: 'warn',
            details:  { reason: 'userinfo_failed', status: userRes.status },
          }),
        ]);
        return Response.redirect(`${env.APP_URL}/?auth_error=userinfo`, 302);
      }
      gUser = await userRes.json();
    } catch {
      await Promise.all([
        recordAuthFailure(env.DB, clientIp),
        logRequest(env.DB, request, 'auth_login_failure', clientIp, {
          severity: 'warn',
          details:  { reason: 'userinfo_exception' },
        }),
      ]);
      return Response.redirect(`${env.APP_URL}/?auth_error=userinfo`, 302);
    }

    // Sanity-check Google's response
    if (!gUser.sub || !gUser.email || !gUser.email_verified) {
      await Promise.all([
        recordAuthFailure(env.DB, clientIp),
        logRequest(env.DB, request, 'auth_unverified_email', clientIp, {
          severity: 'warn',
          details:  { sub: gUser.sub ?? 'missing', emailVerified: gUser.email_verified },
        }),
      ]);
      return Response.redirect(`${env.APP_URL}/?auth_error=unverified`, 302);
    }

    // Upsert user — Google `sub` is stable, never changes for this account
    const userId = `google_${gUser.sub}`;
    const now    = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO users (id, email, name, avatar, createdAt)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, avatar=excluded.avatar`
      ).bind(userId, gUser.email, gUser.name, gUser.picture, now),
      // Ensure default settings row exists (safe on repeat logins)
      env.DB.prepare('INSERT OR IGNORE INTO settings (userId) VALUES (?)').bind(userId),
    ]);

    // Successful auth — clear any failure lockout counter for this IP
    await clearAuthFailures(env.DB, clientIp);

    // Log successful authentication
    ctx.waitUntil(logRequest(env.DB, request, 'auth_login_success', clientIp, {
      severity: 'info',
      userId:   userId,
      details:  { provider: 'google' },
    }));

    // Issue session JWT — token stored in HttpOnly cookie, never in JS scope
    const token = await signJWT(
      { userId, email: gUser.email, name: gUser.name, avatar: gUser.picture },
      env.JWT_SECRET,
    );

    const headers = new Headers({
      Location:        env.APP_URL,
      'Cache-Control': 'no-store',
    });
    // Session cookie — same lifetime as JWT (7 days)
    headers.append('Set-Cookie', `mt_session=${token}; ${cookieFlags(env.APP_URL, '/', JWT_EXPIRES_SEC)}`);
    // Clear state cookie
    headers.append('Set-Cookie', `mt_oauth_state=; HttpOnly; Path=/api/auth; Max-Age=0`);

    return new Response(null, { status: 302, headers });
  }


  // ── GET /api/auth/me ────────────────────────────────────────────────
  if (action === 'me') {
    const token   = parseCookies(request)['mt_session'];
    const payload = token ? await verifyJWT(token, env.JWT_SECRET) : null;

    let user = null;
    if (payload) {
      // Return only safe identity fields — never expose jti/exp/iss/aud to JS
      user = {
        userId: payload.userId,
        email:  payload.email,
        name:   payload.name,
        avatar: payload.avatar,
      };
    }

    return new Response(JSON.stringify({ user }), { headers: authH });
  }


  // ── POST /api/auth/logout ────────────────────────────────────────────────
  if (action === 'logout') {
    const token = parseCookies(request)['mt_session'];
    let logoutUserId: string | undefined;
    if (token) {
      const payload = await verifyJWT(token, env.JWT_SECRET);
      // Revoke the specific token by jti — makes the cookie worthless immediately
      // even if someone captured it before logout
      if (payload?.jti) {
        logoutUserId = payload.userId;
        await revokeToken(env.DB, payload.jti, payload.exp).catch(console.error);
      }
    }
    ctx.waitUntil(logRequest(env.DB, request, 'auth_logout', clientIp, {
      severity: 'info',
      userId:   logoutUserId,
    }));
    const res = new Response(JSON.stringify({ ok: true }), { headers: authH });
    // Overwrite both cookies with zero Max-Age
    res.headers.append('Set-Cookie', `mt_session=; HttpOnly; Path=/; Max-Age=0`);
    res.headers.append('Set-Cookie', `mt_oauth_state=; HttpOnly; Path=/api/auth; Max-Age=0`);
    return res;
  }

  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: authH });
};
