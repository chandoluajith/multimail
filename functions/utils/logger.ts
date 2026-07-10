/**
 * functions/utils/logger.ts
 *
 * Structured audit/security logger that persists events to the D1 `audit_log`
 * table. Designed for:
 *
 *   - Authentication events (success, failure, lockout, CSRF)
 *   - Abuse signals (rate-limit hits, bot blocks, IDOR attempts)
 *   - API errors (4xx client faults, 5xx server faults)
 *   - Unusual traffic patterns (burst detection, repeated anomalies)
 *
 * Privacy rules:
 *   - Email addresses are NEVER logged in full. They are truncated to the
 *     first 3 chars + "@" + domain so they cannot be reconstructed.
 *     Example:  "alice@gmail.com" → "ali…@gmail.com"
 *   - User-Agent strings are capped at 200 chars.
 *   - IP addresses are logged as-is (they are operational security data,
 *     not personal data, in a server-side audit context).
 *
 * Retention:
 *   - Entries older than LOG_RETENTION_DAYS are purged on every write to
 *     avoid unbounded table growth without requiring a cron job.
 *   - Only 1 in PURGE_SAMPLE_RATE writes triggers a purge (probabilistic,
 *     so the extra query doesn't add latency to every request).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** All recognised event types — extend this enum as new features are added. */
export type AuditEventType =
  // Authentication
  | 'auth_login_success'      // Google OAuth completed successfully
  | 'auth_login_failure'      // OAuth code exchange or userinfo failed
  | 'auth_csrf_blocked'       // state cookie mismatch on OAuth callback
  | 'auth_unverified_email'   // Google returned email_verified=false
  | 'auth_logout'             // user explicitly logged out
  | 'auth_token_revoked'      // JWT added to revoked_tokens table
  | 'auth_session_expired'    // client sent an expired JWT

  // Abuse
  | 'rate_limit_ip'           // per-IP rate limit exceeded
  | 'rate_limit_user'         // per-user rate limit exceeded
  | 'auth_lockout'            // IP locked after too many auth failures
  | 'bot_blocked'             // request rejected due to suspicious User-Agent
  | 'origin_blocked'          // request rejected due to invalid Origin/Referer
  | 'body_too_large'          // request body exceeded MAX_BODY_BYTES
  | 'content_type_invalid'    // non-JSON Content-Type on mutating request

  // Data security
  | 'idor_attempt'            // client tried to access another user's resource
  | 'validation_failed'       // server-side schema validation rejected the payload

  // API health
  | 'api_error_4xx'           // client error returned (logged for pattern analysis)
  | 'api_error_5xx'           // server error (always logged, never suppressed)
  | 'secret_weak'             // JWT_SECRET or ENCRYPT_SECRET below minimum length;

/** Severity tiers for filtering/alerting. */
export type Severity = 'info' | 'warn' | 'critical';

export interface AuditEntry {
  event:      AuditEventType;
  ip:         string;
  severity:   Severity;
  userId?:    string;          // set when the user is authenticated
  method?:    string;          // HTTP method
  path?:      string;          // URL path (no query string)
  status?:    number;          // HTTP status code returned
  userAgent?: string;          // truncated to 200 chars
  details?:   Record<string, unknown>;  // structured extra context
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LOG_RETENTION_DAYS = 30;
const PURGE_SAMPLE_RATE  = 50;   // run purge on ~1 in 50 writes

// ─── Private helpers ─────────────────────────────────────────────────────────

/** Truncates an email so it is recognisable but not reconstructable. */
function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at < 1) return '***';
  const local  = email.slice(0, Math.min(3, at));
  const domain = email.slice(at);           // keeps "@domain.com" intact
  return `${local}…${domain}`;
}

/** Removes the query string (may contain tokens/codes) from a URL path. */
function sanitisePath(url: string): string {
  try { return new URL(url).pathname; } catch { return url.split('?')[0]; }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Write a single structured event to the `audit_log` D1 table.
 *
 * This function should be called with `ctx.waitUntil()` when inside a
 * Cloudflare Pages Function to avoid blocking the response:
 *
 *   ctx.waitUntil(log(db, entry));
 *
 * When outside a Pages Function (e.g. in a scheduled handler), call with await.
 *
 * @param db    D1Database binding
 * @param entry Audit entry to record
 */
export async function log(db: D1Database, entry: AuditEntry): Promise<void> {
  try {
    const now  = Math.floor(Date.now() / 1000);
    const id   = crypto.randomUUID();

    // Sanitise user-supplied strings before storing
    const ua   = (entry.userAgent ?? '').slice(0, 200) || null;
    const path = entry.path ? sanitisePath(entry.path) : null;

    // Sanitise details — mask any email addresses found in the details object
    let detailsJson: string | null = null;
    if (entry.details) {
      const sanitised = JSON.parse(JSON.stringify(entry.details));
      for (const k of Object.keys(sanitised)) {
        if (typeof sanitised[k] === 'string' && sanitised[k].includes('@')) {
          sanitised[k] = maskEmail(sanitised[k]);
        }
      }
      detailsJson = JSON.stringify(sanitised);
    }

    const stmts: D1PreparedStatement[] = [
      db.prepare(
        `INSERT INTO audit_log
           (id, timestamp, event_type, severity, ip, user_id,
            method, path, status_code, user_agent, details)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(
        id, now,
        entry.event, entry.severity, entry.ip,
        entry.userId ?? null,
        entry.method ?? null,
        path,
        entry.status  ?? null,
        ua,
        detailsJson,
      ),
    ];

    // Probabilistic retention purge — avoids a cron dependency
    if (Math.random() < 1 / PURGE_SAMPLE_RATE) {
      const cutoff = now - LOG_RETENTION_DAYS * 86400;
      stmts.push(
        db.prepare('DELETE FROM audit_log WHERE timestamp < ?').bind(cutoff)
      );
    }

    await db.batch(stmts);
  } catch (e) {
    // Logging must never crash the primary request path
    console.error('[audit_log] Failed to write log entry:', e);
  }
}

/**
 * Quick helper: log a request-level event using fields from the raw Request.
 * Reads method, path, and User-Agent automatically so callers don't have to.
 */
export function logRequest(
  db:     D1Database,
  req:    Request,
  event:  AuditEventType,
  ip:     string,
  extra?: Omit<AuditEntry, 'event' | 'ip' | 'method' | 'path' | 'userAgent'>,
): Promise<void> {
  return log(db, {
    event,
    ip,
    severity:  extra?.severity ?? 'info',
    userId:    extra?.userId,
    method:    req.method,
    path:      req.url,
    status:    extra?.status,
    userAgent: req.headers.get('user-agent') ?? undefined,
    details:   extra?.details,
  });
}

// ─── Pattern detection ────────────────────────────────────────────────────────

export interface AnomalyReport {
  ip:          string;
  eventCounts: Record<string, number>;
  firstSeen:   number;  // unix seconds
  lastSeen:    number;  // unix seconds
  isSuspicious: boolean;
  reason?:     string;
}

/**
 * Scans recent audit_log entries for a specific IP to detect suspicious
 * patterns within the last `windowMinutes`.
 *
 * Thresholds (tunable):
 *   - ≥3 IDOR attempts          → suspicious
 *   - ≥5 bot/origin blocks      → suspicious
 *   - ≥3 auth_lockout events    → suspicious (IP is cycling through lockouts)
 *   - ≥10 auth failures in window → suspicious
 *   - ≥20 rate_limit hits       → suspicious (sustained abuse)
 */
export async function detectAnomalies(
  db:            D1Database,
  ip:            string,
  windowMinutes = 60,
): Promise<AnomalyReport> {
  const since = Math.floor(Date.now() / 1000) - windowMinutes * 60;

  const rows = await db
    .prepare(
      `SELECT event_type, COUNT(*) as cnt, MIN(timestamp) as first, MAX(timestamp) as last
       FROM audit_log
       WHERE ip = ? AND timestamp >= ?
       GROUP BY event_type`
    )
    .bind(ip, since)
    .all<{ event_type: string; cnt: number; first: number; last: number }>();

  const counts: Record<string, number> = {};
  let firstSeen = Infinity;
  let lastSeen  = 0;

  for (const r of rows.results ?? []) {
    counts[r.event_type] = r.cnt;
    if (r.first < firstSeen) firstSeen = r.first;
    if (r.last  > lastSeen)  lastSeen  = r.last;
  }

  const idorCount    = counts['idor_attempt']    ?? 0;
  const botCount     = (counts['bot_blocked']    ?? 0) + (counts['origin_blocked'] ?? 0);
  const lockoutCount = counts['auth_lockout']    ?? 0;
  const authFails    = counts['auth_login_failure'] ?? 0;
  const rlCount      = (counts['rate_limit_ip']  ?? 0) + (counts['rate_limit_user'] ?? 0);

  let isSuspicious = false;
  let reason: string | undefined;

  if (idorCount >= 3) {
    isSuspicious = true;
    reason = `${idorCount} IDOR attempts in ${windowMinutes}min`;
  } else if (botCount >= 5) {
    isSuspicious = true;
    reason = `${botCount} bot/origin blocks in ${windowMinutes}min`;
  } else if (lockoutCount >= 3) {
    isSuspicious = true;
    reason = `${lockoutCount} lockout triggers in ${windowMinutes}min`;
  } else if (authFails >= 10) {
    isSuspicious = true;
    reason = `${authFails} auth failures in ${windowMinutes}min`;
  } else if (rlCount >= 20) {
    isSuspicious = true;
    reason = `${rlCount} rate-limit hits in ${windowMinutes}min`;
  }

  return {
    ip,
    eventCounts: counts,
    firstSeen:   firstSeen === Infinity ? 0 : firstSeen,
    lastSeen,
    isSuspicious,
    reason,
  };
}
