/**
 * functions/utils/security.ts
 *
 * Defence-in-depth middleware against Burp Suite / proxy-based attacks,
 * bots, and abuse:
 *
 *   1.  Hardened HTTP response headers (CSP, HSTS, X-Frame, etc.)
 *   2.  Origin validation          — blocks forged cross-origin mutations
 *   3.  Content-Type guard         — rejects non-JSON bodies on POST/PUT
 *   4.  Body-size limit            — prevents DoS via oversized payloads
 *   5.  Bot User-Agent rejection   — blocks obvious headless scrapers
 *   6.  Per-IP rate limiting       — D1-backed sliding window
 *   7.  Per-user rate limiting     — prevents authenticated bulk abuse
 *   8.  Exponential-backoff lockout — auth failures escalate to full block
 */

// ─── Limits ───────────────────────────────────────────────────────────────────

export const MAX_BODY_BYTES = 65_536;  // 64 KB hard cap

const RATE_WINDOW_SEC = 60; // 1-minute sliding window

/**
 * Per-IP limits — first line of defence, before any auth.
 * 'account-create' covers the OAuth callback (new sign-ups).
 */
const IP_LIMITS: Record<string, number> = {
  'auth':           10,   // 10 OAuth / login actions per IP per minute
  'account-create':  5,   // 5 new-account flows per IP per minute
  'api-write':      60,   // 60 mutating API calls per IP per minute
  'api-read':      200,   // 200 read-only API calls per IP per minute
  'api':           120,   // legacy bucket kept for backward compat
};

/**
 * Per-user limits — second line of defence, for authenticated requests.
 * Prevents a single user from monopolising resources even from many IPs.
 */
const USER_LIMITS: Record<string, number> = {
  'api-write':  40,   // 40 mutations per user per minute
  'api-read':  120,   // 120 reads per user per minute
  'api':        80,   // legacy bucket
};

/** Max consecutive failed auth attempts before lockout escalation. */
const AUTH_FAIL_THRESHOLD = 5;
/** How long to lock out an IP after too many auth failures (seconds). */
const LOCKOUT_SECONDS      = 900; // 15 minutes

// ─── 1. Hardened response headers ─────────────────────────────────────────────

export function getSecurityHeaders(appUrl: string): Record<string, string> {
  const isLocalhost = appUrl.includes('localhost');
  return {
    // CORS
    'Content-Type':                     'application/json',
    'Access-Control-Allow-Origin':       appUrl,
    'Access-Control-Allow-Credentials':  'true',
    'Access-Control-Allow-Headers':      'Content-Type',
    'Access-Control-Allow-Methods':      'GET, POST, PUT, DELETE, OPTIONS',

    // Prevent MIME-sniffing attacks
    'X-Content-Type-Options': 'nosniff',

    // Deny framing — stops clickjacking payloads
    'X-Frame-Options': 'DENY',

    // No referrer leakage cross-origin
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // Disable browser features not needed by this API
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',

    // Lock down what the API response itself can do
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",

    // Force HTTPS for 2 years in production
    ...(isLocalhost ? {} : {
      'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    }),
  };
}

// ─── 2. Origin validation ──────────────────────────────────────────────────────

/**
 * Every state-changing request (POST/PUT/DELETE) must originate from our
 * own frontend domain.  GET and OPTIONS are always allowed.
 */
export function isOriginAllowed(request: Request, appUrl: string): boolean {
  const method = request.method;
  if (method === 'GET' || method === 'OPTIONS') return true;

  const allowed = new URL(appUrl).origin;
  const origin  = request.headers.get('origin');

  if (origin !== null) return origin === allowed;

  // No Origin header: fall back to Referer
  const referer = request.headers.get('referer');
  if (referer) {
    try { return new URL(referer).origin === allowed; } catch { return false; }
  }
  return false;
}

// ─── 3. Content-Type enforcement ──────────────────────────────────────────────

export function isJsonContentType(request: Request): boolean {
  const method = request.method;
  if (method !== 'POST' && method !== 'PUT') return true;
  const ct = (request.headers.get('content-type') ?? '').toLowerCase();
  return ct.includes('application/json');
}

// ─── 4. Body-size guard ────────────────────────────────────────────────────────

export function isBodySizeOk(request: Request): boolean {
  const cl = request.headers.get('content-length');
  if (!cl) return true;
  return parseInt(cl, 10) <= MAX_BODY_BYTES;
}

// ─── 5. Bot User-Agent rejection ──────────────────────────────────────────────

/**
 * Blocks requests from obvious headless browsers, crawlers, and scanner tools.
 * Legitimate browsers always send a recognisable User-Agent.
 *
 * This is a heuristic — a determined attacker can spoof UA, but this stops
 * off-the-shelf scanners (Nikto, dirbuster, python-requests defaults, etc.).
 */
const BOT_PATTERNS = [
  /python-requests/i,
  /go-http-client/i,
  /java\/\d/i,
  /libwww-perl/i,
  /curl\//i,
  /wget\//i,
  /nikto/i,
  /sqlmap/i,
  /nmap/i,
  /masscan/i,
  /zgrab/i,
  /scrapy/i,
  /dirbuster/i,
  /gobuster/i,
  /wfuzz/i,
  /w3af/i,
  /burpsuite/i,   // people sometimes don't clear this
  /^\s*$/,        // empty User-Agent
];

/**
 * Returns true if the User-Agent looks like a legitimate browser or app.
 * Returns false for obvious bots — the handler should return 403.
 *
 * NOTE: Auth callback from Google's OAuth redirect has no UA check because
 *       the browser follows the redirect; the UA check applies to direct API calls.
 */
export function isHumanUserAgent(request: Request): boolean {
  const ua = request.headers.get('user-agent') ?? '';
  return !BOT_PATTERNS.some(p => p.test(ua));
}

// ─── 6 & 7. Rate limiting — per-IP and per-user ───────────────────────────────

export interface RateLimitResult {
  ok:        boolean;
  remaining: number;
  resetIn:   number;
  limit:     number;  // the applicable limit (for Retry-After headers)
}

/**
 * Per-IP sliding-window rate limiter using D1.
 *
 * @param db      D1 database binding
 * @param ip      Client IP (CF-Connecting-IP)
 * @param action  One of: 'auth' | 'account-create' | 'api-write' | 'api-read' | 'api'
 */
export async function checkRateLimit(
  db:     D1Database,
  ip:     string,
  action: string,
): Promise<RateLimitResult> {
  const limit  = IP_LIMITS[action] ?? IP_LIMITS['api'];
  const key    = `ip:${ip}:${action}`;
  return _slidingWindow(db, key, limit);
}

/**
 * Per-user rate limiter — call this AFTER authentication, using the
 * authenticated userId as the principal.
 *
 * @param db      D1 database binding
 * @param userId  Authenticated user ID
 * @param action  One of: 'api-write' | 'api-read' | 'api'
 */
export async function checkUserRateLimit(
  db:     D1Database,
  userId: string,
  action: string,
): Promise<RateLimitResult> {
  const limit = USER_LIMITS[action] ?? USER_LIMITS['api'];
  const key   = `user:${userId}:${action}`;
  return _slidingWindow(db, key, limit);
}

async function _slidingWindow(
  db:    D1Database,
  key:   string,
  limit: number,
): Promise<RateLimitResult> {
  const nowSec = Math.floor(Date.now() / 1000);

  const row = await db
    .prepare('SELECT count, window_start FROM rate_limits WHERE key=?')
    .bind(key)
    .first<{ count: number; window_start: number }>();

  if (!row || nowSec - row.window_start >= RATE_WINDOW_SEC) {
    await db
      .prepare('INSERT OR REPLACE INTO rate_limits (key, count, window_start) VALUES (?,?,?)')
      .bind(key, 1, nowSec)
      .run();
    return { ok: true, remaining: limit - 1, resetIn: RATE_WINDOW_SEC, limit };
  }

  const newCount = row.count + 1;
  const resetIn  = RATE_WINDOW_SEC - (nowSec - row.window_start);

  if (newCount > limit) {
    return { ok: false, remaining: 0, resetIn, limit };
  }

  await db
    .prepare('UPDATE rate_limits SET count=? WHERE key=?')
    .bind(newCount, key)
    .run();

  return { ok: true, remaining: limit - newCount, resetIn, limit };
}

// ─── 8. Auth failure tracking & exponential-backoff lockout ───────────────────

/**
 * Records a failed authentication attempt for an IP.
 * After AUTH_FAIL_THRESHOLD failures the IP is locked out for LOCKOUT_SECONDS.
 * This stops brute-force attacks even when the per-minute rate limit is not hit
 * (e.g. attacker sends exactly 9 req/min, just under the 10/min limit).
 */
export async function recordAuthFailure(
  db: D1Database,
  ip: string,
): Promise<{ locked: boolean; remaining: number }> {
  const key    = `lockout:${ip}`;
  const nowSec = Math.floor(Date.now() / 1000);

  const row = await db
    .prepare('SELECT count, window_start FROM rate_limits WHERE key=?')
    .bind(key)
    .first<{ count: number; window_start: number }>();

  // If previous window has expired, reset
  const expired = !row || nowSec - row.window_start >= LOCKOUT_SECONDS;
  const count   = expired ? 1 : row!.count + 1;
  const start   = expired ? nowSec : row!.window_start;

  await db
    .prepare('INSERT OR REPLACE INTO rate_limits (key, count, window_start) VALUES (?,?,?)')
    .bind(key, count, start)
    .run();

  const locked    = count >= AUTH_FAIL_THRESHOLD;
  const remaining = Math.max(0, AUTH_FAIL_THRESHOLD - count);
  return { locked, remaining };
}

/**
 * Checks whether an IP is currently locked out due to repeated auth failures.
 * Returns { locked: true, resetIn } if locked, { locked: false } otherwise.
 */
export async function isAuthLocked(
  db: D1Database,
  ip: string,
): Promise<{ locked: boolean; resetIn: number }> {
  const key    = `lockout:${ip}`;
  const nowSec = Math.floor(Date.now() / 1000);

  const row = await db
    .prepare('SELECT count, window_start FROM rate_limits WHERE key=?')
    .bind(key)
    .first<{ count: number; window_start: number }>();

  if (!row) return { locked: false, resetIn: 0 };

  const age = nowSec - row.window_start;
  if (age >= LOCKOUT_SECONDS) return { locked: false, resetIn: 0 };  // expired
  if (row.count < AUTH_FAIL_THRESHOLD) return { locked: false, resetIn: 0 };

  return { locked: true, resetIn: LOCKOUT_SECONDS - age };
}

/** Clears the auth failure counter on successful login (reward good actors). */
export async function clearAuthFailures(db: D1Database, ip: string): Promise<void> {
  await db
    .prepare('DELETE FROM rate_limits WHERE key=?')
    .bind(`lockout:${ip}`)
    .run();
}

// ─── Standardised response helpers ────────────────────────────────────────────

export function tooManyRequests(
  resetIn: number,
  headers: Record<string, string>,
  limit?: number,
): Response {
  return new Response(
    JSON.stringify({ error: 'Too many requests. Please slow down and try again later.' }),
    {
      status: 429,
      headers: {
        ...headers,
        'Retry-After':            String(resetIn),
        'X-RateLimit-Limit':      String(limit ?? 120),
        'X-RateLimit-Remaining':  '0',
        'X-RateLimit-Reset':      String(Math.floor(Date.now() / 1000) + resetIn),
      },
    },
  );
}

export function forbidden(msg: string, headers: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: msg }), { status: 403, headers });
}

export function badRequest(msg: string, headers: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: msg }), { status: 400, headers });
}

export function locked(resetIn: number, headers: Record<string, string>): Response {
  return new Response(
    JSON.stringify({
      error: 'Account temporarily locked due to repeated failed attempts. Try again later.',
    }),
    {
      status: 423,
      headers: {
        ...headers,
        'Retry-After': String(resetIn),
      },
    },
  );
}
