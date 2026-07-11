/**
 * functions/api/audit/[[path]].ts
 *
 * Read-only API for inspecting security events belonging to the
 * currently authenticated user or their client IP.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ Route                    │ Auth required │ Data returned                │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ GET /api/audit/events    │ any user      │ Events for this user/IP only │
 * │ GET /api/audit/anomalies │ any user      │ Anomaly report for client IP │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Data isolation:
 *   /events filters by (user_id = ? OR ip = ?) — a user can only ever see
 *   their own events or events from their own IP. No user can read another
 *   user's audit log.
 *
 * Rate limits:
 *   - Shared 'api-read' bucket (200/min) — blocks scanners.
 *   - Per-user bucket (20/min) — prevents audit log probing.
 */

import { assertSecretStrength } from '../../utils/jwt';
import {
  getSecurityHeaders, isOriginAllowed, isHumanUserAgent, checkRateLimit,
} from '../../utils/security';
import { detectAnomalies } from '../../utils/logger';
import { resolveSession }    from '../../utils/rbac';

interface Env {
  DB:         D1Database;
  JWT_SECRET: string;
  APP_URL:    string;
}

// ─── Row sanitiser ────────────────────────────────────────────────────────────

/** Fields safe to return to the authenticated user. Strips internal stack traces. */
function sanitiseRow(row: Record<string, unknown>): Record<string, unknown> {
  let details: Record<string, unknown> | null = null;
  if (typeof row['details'] === 'string') {
    try {
      const parsed = JSON.parse(row['details'] as string) as Record<string, unknown>;
      // Strip server-internal fields that must never leave the backend
      const { stack: _stack, ...safe } = parsed;
      details = safe;
    } catch { /* leave null */ }
  }
  return {
    id:         row['id'],
    timestamp:  row['timestamp'],
    event_type: row['event_type'],
    severity:   row['severity'],
    ip:         row['ip'],
    method:     row['method'],
    path:       row['path'],
    status:     row['status_code'],
    details,
    // Note: user_id is intentionally omitted — the client already knows their own userId
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export const onRequestOptions: PagesFunction<Env> = (ctx) =>
  new Response(null, { headers: getSecurityHeaders(ctx.env.APP_URL) });

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;
  const url    = new URL(request.url);
  const action = url.pathname.split('/').pop();   // 'events' | 'anomalies'
  const h      = getSecurityHeaders(env.APP_URL);

  // ── Startup guard ───────────────────────────────────────────────────────────
  try { assertSecretStrength(env.JWT_SECRET, 'JWT_SECRET'); }
  catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), { status: 503, headers: h });
  }

  // ── Bot / origin guards ─────────────────────────────────────────────────────
  if (!isOriginAllowed(request, env.APP_URL)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: h });
  }
  if (!isHumanUserAgent(request)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: h });
  }

  // ── Client IP ───────────────────────────────────────────────────────────────
  const clientIp = request.headers.get('CF-Connecting-IP')
    ?? request.headers.get('X-Forwarded-For')?.split(',')[0].trim()
    ?? 'unknown';

  // ── Shared rate limit ───────────────────────────────────────────────────────
  const rl = await checkRateLimit(env.DB, clientIp, 'api-read');
  if (!rl.ok) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: { ...h, 'Retry-After': String(rl.resetIn) },
    });
  }

  // ── Auth — all routes require a valid session ───────────────────────────────
  const session = await resolveSession(request, env.DB, env.JWT_SECRET);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: h });
  }
  const { userId } = session;

  // ── Per-user rate limit: 20 req/min on audit endpoints ─────────────────────
  const userRl = await checkRateLimit(env.DB, `user:${userId}`, 'api-read');
  if (!userRl.ok) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: { ...h, 'Retry-After': String(userRl.resetIn) },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GET /api/audit/events — own events only
  // ══════════════════════════════════════════════════════════════════════════
  if (action === 'events' && request.method === 'GET') {
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 100);
    const since = Number(url.searchParams.get('since') ?? 0);  // unix seconds

    // Rows are filtered to (this userId) OR (this IP) — the IP clause captures
    // pre-auth events such as failed logins that have no userId yet.
    const rows = await env.DB
      .prepare(
        `SELECT id, timestamp, event_type, severity, ip,
                method, path, status_code, user_id, details
         FROM audit_log
         WHERE (user_id = ? OR ip = ?)
           AND timestamp > ?
         ORDER BY timestamp DESC
         LIMIT ?`
      )
      .bind(userId, clientIp, since, limit)
      .all<Record<string, unknown>>();

    const events   = (rows.results ?? []).map(sanitiseRow);
    const critical = events.filter(e => e['severity'] === 'critical');
    const warnings = events.filter(e => e['severity'] === 'warn');

    return new Response(JSON.stringify({
      events,
      summary: { total: events.length, critical: critical.length, warnings: warnings.length },
    }), { headers: h });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GET /api/audit/anomalies — IP-level threat report for this client
  // ══════════════════════════════════════════════════════════════════════════
  if (action === 'anomalies' && request.method === 'GET') {
    const windowMinutes = Math.min(
      Number(url.searchParams.get('window') ?? 60),
      1440,   // max 24h window
    );

    const report = await detectAnomalies(env.DB, clientIp, windowMinutes);

    return new Response(JSON.stringify({
      ip:           clientIp,
      windowMinutes,
      isSuspicious: report.isSuspicious,
      reason:       report.reason ?? null,
      eventCounts:  report.eventCounts,
      firstSeen:    report.firstSeen || null,
      lastSeen:     report.lastSeen  || null,
    }), { headers: h });
  }

  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: h });
};
