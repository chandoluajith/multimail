import { Email, Service, EmailService, UsageHistory, AppSettings, StatusType, CooldownUnit } from '../types';
import { encryptEmail, safeDecryptEmail } from '../utils/emailCrypto';
import {
  ValidationFailed,
  validateEmailCreate, validateEmailUpdate,
  validateServiceCreate, validateServiceUpdate,
  validateEmailServiceUpdate,
  validateHistoryCreate,
  validateSettings,
} from '../utils/validate';
import {
  getSecurityHeaders, isOriginAllowed, isJsonContentType, isHumanUserAgent,
  isBodySizeOk, checkRateLimit, checkUserRateLimit, tooManyRequests,
  forbidden, badRequest,
} from '../utils/security';
import { assertSecretStrength } from '../utils/jwt';
import { logRequest } from '../utils/logger';
import { resolveSession } from '../utils/rbac';  // canonical auth + role resolver

interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  ENCRYPT_SECRET?: string;
  APP_URL: string;
}

function toBool(v: any): boolean { return v === 1 || v === true || v === 'true'; }
function fromBool(v: any): number { return v ? 1 : 0; }

function normalizeStatus(status: any): StatusType {
  switch (status) {
    case 'Active':
      return 'Available';
    case 'Limited':
      return 'Limit Reached';
    case 'Cooldown':
      return 'Cooling Down';
    case 'Available':
    case 'Cooling Down':
    case 'Limit Reached':
    case 'Resetting Soon':
    case 'Unknown':
    default:
      return status as StatusType;
  }
}

// requireAuth() removed — use resolveSession() from utils/rbac.ts (handles
// cookie parse, JWT verify, and revocation check in one canonical call).

function serviceRow(s: any): Service {
  return {
    id: s.id, name: s.name, icon: s.icon, color: s.color,
    isCustom: toBool(s.isCustom),
    defaultCooldownValue: s.defaultCooldownValue,
    defaultCooldownUnit: s.defaultCooldownUnit as CooldownUnit,
    autoStartCooldown: toBool(s.autoStartCooldown),
    autoResetStatus: toBool(s.autoResetStatus),
    allowOverride: toBool(s.allowOverride),
  };
}

function esRow(es: any): EmailService {
  return {
    id: es.id, emailId: es.emailId, serviceId: es.serviceId,
    status: normalizeStatus(es.status),
    remainingRequests: es.remainingRequests ?? undefined,
    maximumRequests: es.maximumRequests ?? undefined,
    lastUsed: es.lastUsed || undefined,
    lastLimitReached: es.lastLimitReached || undefined,
    estimatedResetTime: es.estimatedResetTime || undefined,
    estimatedResetDuration: es.estimatedResetDuration ?? undefined,
    notes: es.notes || undefined,
    createdAt: es.createdAt, updatedAt: es.updatedAt,
  };
}

function settingsRow(s: any): AppSettings {
  return {
    theme: s.theme as 'dark' | 'light' | 'system',
    notifications: {
      resetCompleted:   toBool(s.notifications_resetCompleted),
      resetTenMinutes:  toBool(s.notifications_resetTenMinutes),
      cooldownFinished: toBool(s.notifications_cooldownFinished),
    },
    timeFormat: s.timeFormat as '12h' | '24h',
    defaultCooldownDuration: s.defaultCooldownDuration,
    defaultStatus: normalizeStatus(s.defaultStatus),
  };
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  notifications: { resetCompleted: true, resetTenMinutes: true, cooldownFinished: true },
  timeFormat: '12h', defaultCooldownDuration: 3, defaultStatus: 'Unknown',
};

function resetHistoryId(emailServiceId: string, resetTime: string): string {
  const resetMs = Date.parse(resetTime);
  const suffix = Number.isFinite(resetMs) ? resetMs.toString(36) : 'unknown';
  const safeId = emailServiceId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
  return `hist_auto_${safeId}_${suffix}`.slice(0, 128);
}

async function syncExpiredCooldowns(db: D1Database, userId: string, encKey: string): Promise<number> {
  const now = new Date().toISOString();
  const expired = await db.prepare(`
    SELECT
      es.id,
      es.estimatedResetTime,
      e.nickname AS emailNickname,
      e.email AS emailAddress,
      s.name AS serviceName
    FROM email_services es
    JOIN emails e ON e.id = es.emailId AND e.userId = ?
    JOIN services s ON s.id = es.serviceId AND (s.userId IS NULL OR s.userId = ?)
    WHERE es.userId = ?
      AND es.estimatedResetTime IS NOT NULL
      AND es.status IN ('Cooling Down', 'Limit Reached')
      AND es.estimatedResetTime <= ?
    LIMIT 100
  `).bind(userId, userId, userId, now).all<{
    id: string;
    estimatedResetTime: string;
    emailNickname: string;
    emailAddress: string;
    serviceName: string;
  }>();

  const rows = expired.results || [];
  if (rows.length === 0) return 0;

  const stmts = [];
  for (const row of rows) {
    const plainEmail = await safeDecryptEmail(row.emailAddress, encKey);
    const encryptedHistoryEmail = await encryptEmail(plainEmail, encKey);

    stmts.push(
      db.prepare('INSERT OR IGNORE INTO usage_history (id,userId,emailServiceId,emailNickname,emailAddress,serviceName,event,timestamp,notes) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind(
          resetHistoryId(row.id, row.estimatedResetTime),
          userId,
          row.id,
          row.emailNickname,
          encryptedHistoryEmail,
          row.serviceName,
          'Reset Completed',
          now,
          'Cooldown period expired. Automatically reset.',
        ),
      db.prepare(`UPDATE email_services
        SET status='Available',
            remainingRequests=maximumRequests,
            estimatedResetTime=NULL,
            estimatedResetDuration=NULL,
            updatedAt=?
        WHERE id=? AND userId=? AND estimatedResetTime=? AND status IN ('Cooling Down', 'Limit Reached')`)
        .bind(now, row.id, userId, row.estimatedResetTime),
    );
  }

  await db.batch(stmts);
  return rows.length;
}

// ─────────────────────────────────────────────────────────────────────────────

export const onRequestOptions: PagesFunction<Env> = (ctx) =>
  new Response(null, { headers: getSecurityHeaders(ctx.env.APP_URL) });

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;
  const url    = new URL(request.url);
  const method = request.method;
  const db     = env.DB;
  const h      = getSecurityHeaders(env.APP_URL);

  if (!db) return new Response(JSON.stringify({ error: 'DB binding missing' }), { status: 500, headers: h });

  // ── Startup: reject if secret is too weak ───────────────────────────────
  try { assertSecretStrength(env.JWT_SECRET, 'JWT_SECRET'); }
  catch (e: unknown) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), { status: 500, headers: h });
  }

  // ── Security gate ────────────────────────────────────────────────────────
  if (!isOriginAllowed(request, env.APP_URL))  return forbidden('Forbidden: invalid request origin', h);
  if (!isJsonContentType(request))             return badRequest('Content-Type must be application/json', h);
  if (!isBodySizeOk(request))                  return badRequest('Request body too large (max 64 KB)', h);

  // Extract real client IP before any logging or rate-limit checks
  const clientIp = request.headers.get('CF-Connecting-IP')
    ?? request.headers.get('X-Forwarded-For')?.split(',')[0].trim()
    ?? 'unknown';

  // Bot / headless scanner detection — block before any DB work
  if (!isHumanUserAgent(request)) {
    ctx.waitUntil(logRequest(db, request, 'bot_blocked', clientIp, {
      severity: 'warn',
      details:  { ua: request.headers.get('user-agent') },
    }));
    return forbidden('Forbidden: automated clients are not permitted', h);
  }

  // Per-IP rate limit — tiered by read vs write intent
  const ipAction = (method === 'GET') ? 'api-read' : 'api-write';
  const rl = await checkRateLimit(db, clientIp, ipAction);
  if (!rl.ok) {
    ctx.waitUntil(logRequest(db, request, 'rate_limit_ip', clientIp, {
      severity: 'warn',
      status:   429,
      details:  { bucket: ipAction, limit: rl.limit },
    }));
    return tooManyRequests(rl.resetIn, h, rl.limit);
  }

  // ── Route parsing ────────────────────────────────────────────────────────
  const relativePath = url.pathname.substring('/api'.length);
  const segments     = relativePath.split('/').filter(Boolean);

  // ── GET /api/health ────────────────────────────────────────────────────────
  if (method === 'GET' && segments[0] === 'health') {
    const status: Record<string, any> = {
      database: {
        connected: false,
        tablesExist: false,
        error: null
      },
      env: {
        APP_URL: env.APP_URL ? 'configured' : 'missing',
        JWT_SECRET: env.JWT_SECRET ? 'configured' : 'missing',
        ENCRYPT_SECRET: env.ENCRYPT_SECRET ? 'configured' : 'missing',
        GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID ? 'configured' : 'missing',
        GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET ? 'configured' : 'missing',
      }
    };

    if (db) {
      status.database.connected = true;
      try {
        await db.prepare('SELECT 1 FROM users LIMIT 1').first();
        status.database.tablesExist = true;
      } catch (e: any) {
        status.database.error = e.message || String(e);
      }
    } else {
      status.database.error = 'DB binding is not configured in Wrangler / Cloudflare Pages Dashboard.';
    }

    const allOk = status.database.connected && status.database.tablesExist &&
                  env.APP_URL && env.JWT_SECRET && env.ENCRYPT_SECRET &&
                  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET;

    return new Response(JSON.stringify({
      ok: !!allOk,
      ...status
    }), {
      status: allOk ? 200 : 500,
      headers: {
        ...h,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    });
  }

  // ── Auth guard ────────────────────────────────────────────────────────────
  // resolveSession() handles cookie parse, JWT verify, and revoked_tokens lookup.
  const auth = await resolveSession(request, db, env.JWT_SECRET);
  if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: h });
  const { userId } = auth;

  // Per-user rate limit — prevents a single account from hammering even via VPN
  const userAction = (method === 'GET') ? 'api-read' : 'api-write';
  const uRl = await checkUserRateLimit(db, userId, userAction);
  if (!uRl.ok) {
    ctx.waitUntil(logRequest(db, request, 'rate_limit_user', clientIp, {
      severity: 'warn',
      userId,
      status:   429,
      details:  { bucket: userAction, limit: uRl.limit },
    }));
    return tooManyRequests(uRl.resetIn, h, uRl.limit);
  }

  try {
    // ── GET /api/data ────────────────────────────────────────────────────
    if (method === 'GET' && segments[0] === 'data') {
      const encKey = env.ENCRYPT_SECRET || env.JWT_SECRET;
      await syncExpiredCooldowns(db, userId, encKey);

      const [eRes, sRes, esRes, hRes, stRes] = await Promise.all([
        db.prepare('SELECT * FROM emails WHERE userId=?').bind(userId).all<any>(),
        db.prepare('SELECT * FROM services WHERE userId IS NULL OR userId=?').bind(userId).all<any>(),
        db.prepare('SELECT * FROM email_services WHERE userId=?').bind(userId).all<any>(),
        db.prepare('SELECT * FROM usage_history WHERE userId=? ORDER BY timestamp DESC').bind(userId).all<any>(),
        db.prepare('SELECT * FROM settings WHERE userId=?').bind(userId).all<any>(),
      ]);

      // Decrypt email fields before sending to client
      const emails: Email[] = await Promise.all(
        (eRes.results || []).map(async (e: any) => ({
          ...e,
          email: await safeDecryptEmail(e.email, encKey),
        }))
      );

      const history: UsageHistory[] = await Promise.all(
        (hRes.results || []).map(async (row: any) => ({
          ...row,
          emailAddress: await safeDecryptEmail(row.emailAddress, encKey),
        }))
      );

      const settings = stRes.results?.length
        ? settingsRow(stRes.results[0])
        : DEFAULT_SETTINGS;

      return new Response(JSON.stringify({
        emails,
        services:      (sRes.results || []).map(serviceRow),
        emailServices: (esRes.results || []).map(esRow),
        history,
        settings,
      }), { headers: h });
    }

    // ── /api/emails ──────────────────────────────────────────────────────
    if (segments[0] === 'emails') {
      const encKey = env.ENCRYPT_SECRET || env.JWT_SECRET;
      if (method === 'POST') {
        const b = await request.json();
        validateEmailCreate(b);                           // ← server validation
        const eb = b as Email;
        const encEmail = await encryptEmail(eb.email, encKey);
        await db.prepare('INSERT INTO emails (id,userId,email,nickname,provider,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)')
          .bind(eb.id, userId, encEmail, eb.nickname.trim(), eb.provider.trim(), eb.createdAt, eb.updatedAt).run();
        return new Response(JSON.stringify({ success: true }), { headers: h });
      }
      if (method === 'PUT' && segments[1]) {
        const b = await request.json();
        validateEmailUpdate(b);                           // ← server validation
        const eb = b as Partial<Email>;
        const encEmail = eb.email ? await encryptEmail(eb.email, encKey) : eb.email;
        const res = await db.prepare('UPDATE emails SET email=?,nickname=?,provider=?,updatedAt=? WHERE id=? AND userId=?')
          .bind(encEmail, eb.nickname!.trim(), eb.provider!.trim(), eb.updatedAt, segments[1], userId).run();
        if ((res.meta?.changes ?? 0) === 0) {
          ctx.waitUntil(logRequest(db, request, 'idor_attempt', clientIp, {
            severity: 'critical', userId,
            details:  { resource: 'emails', action: 'PUT', emailId: segments[1] },
          }));
          return new Response(
            JSON.stringify({ error: 'Forbidden: email not owned by user' }),
            { status: 403, headers: h },
          );
        }
        return new Response(JSON.stringify({ success: true }), { headers: h });
      }
      if (method === 'DELETE' && segments[1]) {
        // Find all emailService IDs for this email first (for history cleanup)
        const esIds = await db.prepare('SELECT id FROM email_services WHERE emailId=? AND userId=?')
          .bind(segments[1], userId).all<{ id: string }>();
        const ids = (esIds.results || []).map(r => r.id);

        const stmts = [
          // Delete orphaned history rows (emailServiceId is a soft ref — no FK cascade)
          ...ids.map(esid =>
            db.prepare('DELETE FROM usage_history WHERE emailServiceId=? AND userId=?').bind(esid, userId)
          ),
          db.prepare('DELETE FROM email_services WHERE emailId=? AND userId=?').bind(segments[1], userId),
          db.prepare('DELETE FROM emails WHERE id=? AND userId=?').bind(segments[1], userId),
        ];
        await db.batch(stmts);
        return new Response(JSON.stringify({ success: true }), { headers: h });
      }
    }

    // ── /api/services ─────────────────────────────────────────────────────
    if (segments[0] === 'services') {
      if (method === 'POST') {
        const b = await request.json();
        validateServiceCreate(b);                         // ← server validation
        const sb = b as Service;
        await db.prepare('INSERT INTO services (id,userId,name,icon,color,isCustom,defaultCooldownValue,defaultCooldownUnit,autoStartCooldown,autoResetStatus,allowOverride) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
          .bind(sb.id, userId, sb.name.trim(), sb.icon.trim(), sb.color.trim(), fromBool(sb.isCustom), sb.defaultCooldownValue??null, sb.defaultCooldownUnit??null, fromBool(sb.autoStartCooldown), fromBool(sb.autoResetStatus), fromBool(sb.allowOverride)).run();
        return new Response(JSON.stringify({ success: true }), { headers: h });
      }
      if (method === 'PUT' && segments[1]) {
        const b = await request.json();
        validateServiceUpdate(b);                         // ← server validation
        const sb = b as Partial<Service>;
        const res = await db
          .prepare('UPDATE services SET name=?,icon=?,color=?,defaultCooldownValue=?,defaultCooldownUnit=?,autoStartCooldown=?,autoResetStatus=?,allowOverride=? WHERE id=? AND (userId=? OR userId IS NULL)')
          .bind(sb.name!.trim(), sb.icon!.trim(), sb.color!.trim(), sb.defaultCooldownValue??null, sb.defaultCooldownUnit??null, fromBool(sb.autoStartCooldown), fromBool(sb.autoResetStatus), fromBool(sb.allowOverride), segments[1], userId)
          .run();
        // 0 rows affected means either a missing service or another user's custom service.
        if ((res.meta?.changes ?? 0) === 0) {
          ctx.waitUntil(logRequest(db, request, 'idor_attempt', clientIp, {
            severity: 'critical', userId,
            details:  { resource: 'services', action: 'PUT', serviceId: segments[1] },
          }));
          return new Response(
            JSON.stringify({ error: 'Forbidden: service not owned by user' }),
            { status: 403, headers: h },
          );
        }
        return new Response(JSON.stringify({ success: true }), { headers: h });
      }
      if (method === 'DELETE' && segments[1]) {
        // Delete email_services first, then the service itself
        const [esDel, sDel] = await db.batch([
          db.prepare('DELETE FROM email_services WHERE serviceId=? AND userId=?').bind(segments[1], userId),
          db.prepare('DELETE FROM services WHERE id=? AND userId=?').bind(segments[1], userId),
        ]);
        // If the service row wasn't deleted it's either IDOR or a global service
        if ((sDel.meta?.changes ?? 0) === 0) {
          ctx.waitUntil(logRequest(db, request, 'idor_attempt', clientIp, {
            severity: 'critical', userId,
            details:  { resource: 'services', action: 'DELETE', serviceId: segments[1] },
          }));
          return new Response(
            JSON.stringify({ error: 'Forbidden: service not owned by user' }),
            { status: 403, headers: h },
          );
        }
        return new Response(JSON.stringify({ success: true }), { headers: h });
      }
    }

    // ── /api/email-services ───────────────────────────────────────────────
    if (segments[0] === 'email-services') {
      if (method === 'POST') {
        const { relations } = await request.json() as { relations: EmailService[] };
        if (!Array.isArray(relations) || relations.length > 200) {
          return badRequest('relations must be an array of at most 200 items', h);
        }

        // ── IDOR guard ──────────────────────────────────────────────────────
        // Every emailId must belong to this user; every serviceId must be
        // global (userId IS NULL) or owned by this user.
        // We deduplicate before querying to avoid redundant DB round-trips.
        const uniqueEmailIds   = [...new Set(relations.map(r => r.emailId))];
        const uniqueServiceIds = [...new Set(relations.map(r => r.serviceId))];

        for (const emailId of uniqueEmailIds) {
          const owned = await db
            .prepare('SELECT 1 FROM emails WHERE id=? AND userId=?')
            .bind(emailId, userId).first();
          if (!owned) {
            ctx.waitUntil(logRequest(db, request, 'idor_attempt', clientIp, {
              severity: 'critical',
              userId,
              details:  { resource: 'emails', emailId },
            }));
            return new Response(
              JSON.stringify({ error: 'Forbidden: email not owned by user' }),
              { status: 403, headers: h },
            );
          }
        }
        for (const serviceId of uniqueServiceIds) {
          const accessible = await db
            .prepare('SELECT 1 FROM services WHERE id=? AND (userId IS NULL OR userId=?)')
            .bind(serviceId, userId).first();
          if (!accessible) {
            ctx.waitUntil(logRequest(db, request, 'idor_attempt', clientIp, {
              severity: 'critical',
              userId,
              details:  { resource: 'services', serviceId },
            }));
            return new Response(
              JSON.stringify({ error: 'Forbidden: service not accessible to user' }),
              { status: 403, headers: h },
            );
          }
        }
        // ───────────────────────────────────────────────────────────────────

        const stmts = relations.map(es =>
          db.prepare('INSERT OR REPLACE INTO email_services (id,userId,emailId,serviceId,status,remainingRequests,maximumRequests,lastUsed,lastLimitReached,estimatedResetTime,estimatedResetDuration,notes,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
            .bind(es.id, userId, es.emailId, es.serviceId, es.status, es.remainingRequests??null, es.maximumRequests??null, es.lastUsed??null, es.lastLimitReached??null, es.estimatedResetTime??null, es.estimatedResetDuration??null, es.notes??null, es.createdAt, es.updatedAt)
        );
        await db.batch(stmts);
        return new Response(JSON.stringify({ success: true }), { headers: h });
      }
      if (method === 'PUT') {
        const esRaw = await request.json();
        validateEmailServiceUpdate(esRaw);                // ← server validation
        const es = esRaw as EmailService;
        const res = await db.prepare('UPDATE email_services SET status=?,remainingRequests=?,maximumRequests=?,lastUsed=?,lastLimitReached=?,estimatedResetTime=?,estimatedResetDuration=?,notes=?,updatedAt=? WHERE id=? AND userId=?')
          .bind(es.status, es.remainingRequests??null, es.maximumRequests??null, es.lastUsed??null, es.lastLimitReached??null, es.estimatedResetTime??null, es.estimatedResetDuration??null, es.notes??null, es.updatedAt, es.id, userId).run();
        if ((res.meta?.changes ?? 0) === 0) {
          ctx.waitUntil(logRequest(db, request, 'idor_attempt', clientIp, {
            severity: 'critical', userId,
            details:  { resource: 'email_services', action: 'PUT', emailServiceId: es.id },
          }));
          return new Response(
            JSON.stringify({ error: 'Forbidden: email service not owned by user' }),
            { status: 403, headers: h },
          );
        }
        return new Response(JSON.stringify({ success: true }), { headers: h });
      }
      if (method === 'DELETE') {
        const emailId    = url.searchParams.get('emailId') || '';
        const serviceIds = (url.searchParams.get('serviceIds') || '').split(',').filter(Boolean);
        if (serviceIds.length > 200) return badRequest('Too many serviceIds (max 200)', h);
        if (serviceIds.length) {
          const stmts = serviceIds.map(sid =>
            db.prepare('DELETE FROM email_services WHERE emailId=? AND serviceId=? AND userId=?').bind(emailId, sid, userId)
          );
          await db.batch(stmts);
        }
        return new Response(JSON.stringify({ success: true }), { headers: h });
      }
    }

    // ── /api/history ──────────────────────────────────────────────────────
    if (segments[0] === 'history') {
      if (method === 'POST') {
        const bRaw = await request.json();
        validateHistoryCreate(bRaw);                      // ← server validation
        const b = bRaw as UsageHistory;

        // ── IDOR guard ──────────────────────────────────────────────────────
        // emailServiceId is a foreign key supplied by the client; confirm the
        // referenced email-service row actually belongs to this user before
        // writing the history entry against it.
        const esOwned = await db
          .prepare('SELECT 1 FROM email_services WHERE id=? AND userId=?')
          .bind(b.emailServiceId, userId).first();
        if (!esOwned) {
          ctx.waitUntil(logRequest(db, request, 'idor_attempt', clientIp, {
            severity: 'critical',
            userId,
            details:  { resource: 'email_services', emailServiceId: b.emailServiceId },
          }));
          return new Response(
            JSON.stringify({ error: 'Forbidden: email service not owned by user' }),
            { status: 403, headers: h },
          );
        }
        // ───────────────────────────────────────────────────────────────────

        const encKey = env.ENCRYPT_SECRET || env.JWT_SECRET;
        const encAddr = b.emailAddress ? await encryptEmail(b.emailAddress, encKey) : b.emailAddress;
        await db.prepare('INSERT INTO usage_history (id,userId,emailServiceId,emailNickname,emailAddress,serviceName,event,timestamp,notes) VALUES (?,?,?,?,?,?,?,?,?)')
          .bind(b.id, userId, b.emailServiceId, b.emailNickname, encAddr, b.serviceName, b.event, b.timestamp, b.notes??null).run();
        return new Response(JSON.stringify({ success: true }), { headers: h });
      }
      if (method === 'DELETE') {
        await db.prepare('DELETE FROM usage_history WHERE userId=?').bind(userId).run();
        return new Response(JSON.stringify({ success: true }), { headers: h });
      }
    }

    // ── /api/settings ─────────────────────────────────────────────────────
    if (segments[0] === 'settings' && method === 'PUT') {
      const sRaw = await request.json();
      validateSettings(sRaw);                             // ← server validation
      const s = sRaw as AppSettings;
      await db.prepare(`INSERT INTO settings (userId,theme,notifications_resetCompleted,notifications_resetTenMinutes,notifications_cooldownFinished,timeFormat,defaultCooldownDuration,defaultStatus)
        VALUES (?,?,?,?,?,?,?,?)
        ON CONFLICT(userId) DO UPDATE SET theme=excluded.theme, notifications_resetCompleted=excluded.notifications_resetCompleted,
        notifications_resetTenMinutes=excluded.notifications_resetTenMinutes, notifications_cooldownFinished=excluded.notifications_cooldownFinished,
        timeFormat=excluded.timeFormat, defaultCooldownDuration=excluded.defaultCooldownDuration, defaultStatus=excluded.defaultStatus`)
        .bind(userId, s.theme, fromBool(s.notifications.resetCompleted), fromBool(s.notifications.resetTenMinutes), fromBool(s.notifications.cooldownFinished), s.timeFormat, s.defaultCooldownDuration, s.defaultStatus).run();
      return new Response(JSON.stringify({ success: true }), { headers: h });
    }

    // ── /api/actions/sync-expired ─────────────────────────────────────────
    if (segments[0] === 'actions' && segments[1] === 'sync-expired' && method === 'POST') {
      const encKey = env.ENCRYPT_SECRET || env.JWT_SECRET;
      const synced = await syncExpiredCooldowns(db, userId, encKey);
      return new Response(JSON.stringify({ success: true, synced }), { headers: h });
    }

    // ── /api/actions/load-mock ─────────────────────────────────────────────
    if (segments[0] === 'actions' && segments[1] === 'load-mock' && method === 'POST') {
      const payload = await request.json() as { emails: Email[]; services: Service[]; emailServices: EmailService[]; history: UsageHistory[]; settings: AppSettings };

      // Size caps — prevent oversized bulk imports from exhausting D1 batch limits
      if (!Array.isArray(payload.emails)        || payload.emails.length        > 500) return badRequest('emails must be an array of at most 500 items', h);
      if (!Array.isArray(payload.emailServices) || payload.emailServices.length > 2000) return badRequest('emailServices must be an array of at most 2000 items', h);
      if (!Array.isArray(payload.history)       || payload.history.length       > 2000) return badRequest('history must be an array of at most 2000 items', h);

      const encKey2 = env.ENCRYPT_SECRET || env.JWT_SECRET;

      // Build encrypted email statements first (needs await)
      const emailStmts = await Promise.all(payload.emails.map(async e => {
        const encEmail = await encryptEmail(e.email, encKey2);
        return db.prepare('INSERT INTO emails (id,userId,email,nickname,provider,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)')
          .bind(e.id, userId, encEmail, e.nickname, e.provider, e.createdAt, e.updatedAt);
      }));

      const historyStmts = await Promise.all(payload.history.map(async h2 => {
        const encAddr2 = h2.emailAddress ? await encryptEmail(h2.emailAddress, encKey2) : h2.emailAddress;
        return db.prepare('INSERT INTO usage_history (id,userId,emailServiceId,emailNickname,emailAddress,serviceName,event,timestamp,notes) VALUES (?,?,?,?,?,?,?,?,?)')
          .bind(h2.id, userId, h2.emailServiceId, h2.emailNickname, encAddr2, h2.serviceName, h2.event, h2.timestamp, h2.notes??null);
      }));

      const stmts = [
        // Clear user data first
        db.prepare('DELETE FROM usage_history WHERE userId=?').bind(userId),
        db.prepare('DELETE FROM email_services WHERE userId=?').bind(userId),
        db.prepare('DELETE FROM emails WHERE userId=?').bind(userId),
        db.prepare('DELETE FROM services WHERE userId=?').bind(userId),
        db.prepare('DELETE FROM settings WHERE userId=?').bind(userId),
        // Re-insert with encrypted addresses
        ...emailStmts,
        ...payload.services.map(s =>
          db.prepare('INSERT OR REPLACE INTO services (id,userId,name,icon,color,isCustom,defaultCooldownValue,defaultCooldownUnit,autoStartCooldown,autoResetStatus,allowOverride) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
            .bind(s.id, s.isCustom ? userId : null, s.name, s.icon, s.color, fromBool(s.isCustom), s.defaultCooldownValue??null, s.defaultCooldownUnit??null, fromBool(s.autoStartCooldown), fromBool(s.autoResetStatus), fromBool(s.allowOverride))
        ),
        ...payload.emailServices.map(es =>
          db.prepare('INSERT OR REPLACE INTO email_services (id,userId,emailId,serviceId,status,remainingRequests,maximumRequests,lastUsed,lastLimitReached,estimatedResetTime,estimatedResetDuration,notes,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
            .bind(es.id, userId, es.emailId, es.serviceId, es.status, es.remainingRequests??null, es.maximumRequests??null, es.lastUsed??null, es.lastLimitReached??null, es.estimatedResetTime??null, es.estimatedResetDuration??null, es.notes??null, es.createdAt, es.updatedAt)
        ),
        ...historyStmts,
        db.prepare(`INSERT INTO settings (userId,theme,notifications_resetCompleted,notifications_resetTenMinutes,notifications_cooldownFinished,timeFormat,defaultCooldownDuration,defaultStatus) VALUES (?,?,?,?,?,?,?,?)`)
          .bind(userId, payload.settings.theme, fromBool(payload.settings.notifications.resetCompleted), fromBool(payload.settings.notifications.resetTenMinutes), fromBool(payload.settings.notifications.cooldownFinished), payload.settings.timeFormat, payload.settings.defaultCooldownDuration, payload.settings.defaultStatus),
      ];
      await db.batch(stmts);
      return new Response(JSON.stringify({ success: true }), { headers: h });
    }

    // ── /api/actions/clear ────────────────────────────────────────────────
    if (segments[0] === 'actions' && segments[1] === 'clear' && method === 'POST') {
      await db.batch([
        db.prepare('DELETE FROM usage_history WHERE userId=?').bind(userId),
        db.prepare('DELETE FROM email_services WHERE userId=?').bind(userId),
        db.prepare('DELETE FROM emails WHERE userId=?').bind(userId),
        db.prepare('DELETE FROM services WHERE userId=?').bind(userId),
        db.prepare('DELETE FROM settings WHERE userId=?').bind(userId),
      ]);
      return new Response(JSON.stringify({ success: true }), { headers: h });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: h });

  } catch (err: unknown) {
    if (err instanceof ValidationFailed) {
      // Return structured field errors — safe to expose to clients
      return new Response(
        JSON.stringify({ error: 'Validation failed', fields: err.errors }),
        { status: 422, headers: h },
      );
    }
    // Log unexpected 5xx errors with enough context to diagnose
    ctx.waitUntil(logRequest(db, request, 'api_error_5xx', clientIp ?? 'unknown', {
      severity: 'critical',
      userId,
      status:   500,
      details:  {
        message: err instanceof Error ? err.message : String(err),
        // Stack is logged server-side only, never returned to the client
        stack:   err instanceof Error ? err.stack?.slice(0, 500) : undefined,
      },
    }));
    console.error('[api_error_5xx]', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),  // no internal detail leaked
      { status: 500, headers: h },
    );
  }
};
