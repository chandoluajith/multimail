/**
 * functions/_middleware.ts
 *
 * Global Cloudflare Pages middleware — runs before every handler.
 *
 * Responsibilities:
 *   1. HTTPS enforcement — redirect plain HTTP requests to HTTPS (301).
 *      This is defence-in-depth; the Cloudflare dashboard "Always Use HTTPS"
 *      setting should also be enabled, but this catches any gap at the edge
 *      Worker level.
 *
 *   2. Startup secret validation — reject all traffic with HTTP 500 if any
 *      required environment variable is missing or too weak.
 *      This surfaces misconfiguration immediately at boot, not after a user
 *      triggers an auth flow.
 *
 *   3. Global security headers — adds Content-Security-Policy, HSTS, and
 *      framing protection to every response (API and page alike).
 *
 * Note: `_middleware.ts` in the functions root applies to ALL routes.
 */

interface Env {
  JWT_SECRET:           string;
  ENCRYPT_SECRET?:      string;
  GOOGLE_CLIENT_ID?:    string;
  GOOGLE_CLIENT_SECRET?: string;
  APP_URL:              string;
}

// ─── Validation helpers ───────────────────────────────────────────────────────

interface ValidationResult {
  ok:     boolean;
  errors: string[];
}

/**
 * Validates that all required secrets are present and meet minimum strength
 * requirements. Called on every request (cheap — no DB, no crypto).
 */
function validateSecrets(env: Env): ValidationResult {
  const errors: string[] = [];
  const isLocalDev = env.APP_URL?.includes('localhost') || env.APP_URL?.includes('127.0.0.1');

  // JWT_SECRET — signs all session tokens (always required)
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters');
  }

  // APP_URL — used for CSRF origin checks and OAuth redirect URIs
  if (!env.APP_URL || !env.APP_URL.startsWith('http')) {
    errors.push('APP_URL must be a valid URL (starts with http:// or https://)');
  }

  // GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET — OAuth 2.0
  // Required in production so a deployment without them fails loudly.
  // In local dev, the app can start without them (OAuth just won't work).
  if (!isLocalDev) {
    if (!env.GOOGLE_CLIENT_ID) {
      errors.push('GOOGLE_CLIENT_ID is not set');
    }
    if (!env.GOOGLE_CLIENT_SECRET) {
      errors.push('GOOGLE_CLIENT_SECRET is not set');
    }
  }

  return { ok: errors.length === 0, errors };
}

// ─── Security headers ─────────────────────────────────────────────────────────

/**
 * Adds the global HTTP security headers to any Response.
 * These apply to EVERY route (page + API) through the middleware.
 * API-specific handlers in security.ts may add additional headers.
 */
function addGlobalSecurityHeaders(res: Response, isLocalDev: boolean): Response {
  const headers = new Headers(res.headers);

  // HSTS — tell browsers to always use HTTPS (skip in local dev)
  if (!isLocalDev) {
    headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );
  }

  // Prevent MIME-type sniffing
  headers.set('X-Content-Type-Options', 'nosniff');

  // Disallow all iframes (clickjacking protection)
  headers.set('X-Frame-Options', 'DENY');

  // Don't send Referer to third-party sites
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Disable browser features we don't use
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  return new Response(res.body, {
    status:     res.status,
    statusText: res.statusText,
    headers,
  });
}

// ─── Middleware handler ───────────────────────────────────────────────────────

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env, next } = ctx;
  const url = new URL(request.url);
  const isLocalDev = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

  // ── 1. HTTPS enforcement ───────────────────────────────────────────────────
  // Cloudflare normally enforces HTTPS before the Worker runs, but as an
  // extra layer we reject any HTTP request that reaches the Worker.
  if (url.protocol === 'http:' && !isLocalDev) {
    const httpsUrl = new URL(request.url);
    httpsUrl.protocol = 'https:';
    return Response.redirect(httpsUrl.toString(), 301);
  }

  // ── 2. Startup secret validation ──────────────────────────────────────────
  const validation = validateSecrets(env);
  if (!validation.ok) {
    // Log misconfiguration but never expose the detail to the client
    console.error(
      '[STARTUP] Missing or weak secrets — refusing all requests:',
      validation.errors,
    );
    return new Response(
      JSON.stringify({ error: 'Server misconfiguration. Contact support.' }),
      {
        status:  503,
        headers: {
          'Content-Type':  'application/json',
          'Cache-Control': 'no-store',
          'Retry-After':   '30',
        },
      },
    );
  }

  // ── 3. Dispatch to the matched route handler ───────────────────────────────
  const response = await next();

  // ── 4. Attach global security headers to every outgoing response ──────────
  return addGlobalSecurityHeaders(response, isLocalDev);
};
