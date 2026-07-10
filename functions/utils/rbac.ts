/**
 * functions/utils/rbac.ts
 *
 * Ownership-based access control utilities.
 *
 * DESIGN
 * ──────
 * There are no roles in this application — every authenticated user is equal.
 * Authorization is enforced purely by DATA OWNERSHIP:
 *
 *   Every DB query that reads or mutates a resource includes:
 *     WHERE id = ? AND userId = ?
 *
 * This makes it structurally impossible for User A to read, modify, or delete
 * User B's data — even if User A knows User B's resource IDs.
 *
 * This file provides resolveSession(), the single canonical function for
 * parsing and verifying a session. All API handlers import this instead of
 * duplicating cookie parse + JWT verify + revocation check logic.
 *
 * USAGE
 * ─────
 *   import { resolveSession } from '../utils/rbac';
 *
 *   const session = await resolveSession(request, db, env.JWT_SECRET);
 *   if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: h });
 *   const { userId } = session;
 *   // All DB queries from here use: WHERE ... AND userId = ?
 */

import { verifyJWT, parseCookies } from './jwt';

// ─── Canonical session resolver ───────────────────────────────────────────────

/**
 * Parses the session cookie, verifies the JWT signature and expiry, then
 * checks the revoked_tokens table (catches logged-out sessions).
 *
 * Returns { userId } if the session is valid, or null if not.
 *
 * This is the ONLY place session validation logic lives — every handler
 * calls this instead of reimplementing cookie + JWT + revocation logic.
 */
export async function resolveSession(
  req:       Request,
  db:        D1Database,
  jwtSecret: string,
): Promise<{ userId: string } | null> {
  const token = parseCookies(req)['mt_session'];
  if (!token) return null;

  const payload = await verifyJWT(token, jwtSecret);
  if (!payload) return null;

  // Revocation check — catches replay of a captured logout cookie.
  // The revoked_tokens table is written on logout with the token's jti.
  if (payload.jti) {
    const revoked = await db
      .prepare('SELECT 1 FROM revoked_tokens WHERE jti=?')
      .bind(payload.jti)
      .first();
    if (revoked) return null;
  }

  return { userId: payload.userId };
}
