/**
 * functions/utils/jwt.ts
 * Centralised JWT helpers — used by both the API and auth handlers.
 * Uses native Web Crypto (zero external deps, works in CF Workers).
 */

// ─── Constants ────────────────────────────────────────────────────────────────

export const JWT_ISSUER      = 'mailstracker-api';
export const JWT_AUDIENCE    = 'mailstracker-app';
export const JWT_EXPIRES_SEC = 7 * 24 * 3600; // 7 days
export const MIN_SECRET_LEN  = 32;            // minimum characters for JWT_SECRET

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JWTPayload {
  userId:  string;
  email?:  string;
  name?:   string;
  avatar?: string;
  // RFC 7519 registered claims
  iss: string;  // issuer
  aud: string;  // audience
  iat: number;  // issued-at  (unix sec)
  nbf: number;  // not-before (unix sec)
  exp: number;  // expires-at (unix sec)
  jti: string;  // JWT ID — used for token revocation on logout
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function b64url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach(b => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlDecode(s: string): string {
  return atob(s.replace(/-/g, '+').replace(/_/g, '/'));
}

async function hmacKey(secret: string, usage: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, usage,
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Signs a JWT (HMAC-SHA256) adding all standard security claims automatically.
 * Includes a unique `jti` (UUID) so that individual tokens can be revoked on logout.
 */
export async function signJWT(
  payload: { userId: string; email: string; name: string; avatar: string },
  secret: string,
  expiresInSec = JWT_EXPIRES_SEC,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const jti = crypto.randomUUID();

  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body   = b64url(JSON.stringify({
    ...payload,
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    iat: now,
    nbf: now,                  // token invalid before now
    exp: now + expiresInSec,
    jti,
  }));

  const data = `${header}.${body}`;
  const key  = await hmacKey(secret, ['sign']);
  const sig  = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));

  return `${data}.${btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}`;
}

/**
 * Verifies a JWT. Returns the payload only if ALL of these pass:
 *  - HMAC-SHA256 signature  ✓
 *  - Not expired (exp)      ✓
 *  - Not-before (nbf)       ✓
 *  - Correct issuer (iss)   ✓
 *  - Correct audience (aud) ✓
 *
 * Does NOT check revocation — callers that need revocation must check D1.
 */
export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const [header, body, sig] = token.split('.');
    if (!header || !body || !sig) return null;

    const key      = await hmacKey(secret, ['verify']);
    const sigBytes = Uint8Array.from(b64urlDecode(sig), c => c.charCodeAt(0));
    const valid    = await crypto.subtle.verify(
      'HMAC', key, sigBytes, new TextEncoder().encode(`${header}.${body}`),
    );
    if (!valid) return null;

    const p   = JSON.parse(b64urlDecode(body)) as JWTPayload;
    const now = Math.floor(Date.now() / 1000);

    if (p.iss !== JWT_ISSUER)   return null; // issuer mismatch
    if (p.aud !== JWT_AUDIENCE) return null; // audience mismatch
    if (p.exp && now > p.exp)   return null; // expired
    if (p.nbf && now < p.nbf)   return null; // not yet valid

    return p;
  } catch { return null; }
}

/**
 * Parse cookies from a request header.
 */
export function parseCookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  (req.headers.get('cookie') ?? '').split(';').forEach(c => {
    const [k, ...v] = c.trim().split('=');
    if (k) out[k.trim()] = v.join('=').trim();
  });
  return out;
}

/**
 * Throw a 500 early if the secret is too weak.
 * Call once at the top of each handler before any logic.
 */
export function assertSecretStrength(secret: string, name: string): void {
  if (!secret || secret.length < MIN_SECRET_LEN) {
    throw new Error(
      `[SECURITY] ${name} must be at least ${MIN_SECRET_LEN} characters. ` +
      `Generate one with: openssl rand -base64 48`,
    );
  }
}
