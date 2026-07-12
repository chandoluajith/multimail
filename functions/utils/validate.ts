/**
 * Server-side input validation for the MailsTracker API.
 *
 * The frontend may be bypassed entirely (curl, Postman, malicious client).
 * Every mutation is validated here before touching the database.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
}

export class ValidationFailed extends Error {
  public errors: ValidationError[];
  constructor(errors: ValidationError[]) {
    super('Validation failed');
    this.errors = errors;
  }
}

// ── Primitives ────────────────────────────────────────────────────────────────

const UUID_RE    = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE   = /^[^\s@]{1,64}@[^\s@]{1,253}$/;           // RFC 5321 simplified
const ISO_TS_RE  = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;  // ISO 8601 prefix

function isUUID(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}
function isEmail(v: unknown): v is string {
  return typeof v === 'string' && EMAIL_RE.test(v.trim()) && v.length <= 320;
}
function isString(v: unknown, max = 255): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max;
}
function isOptString(v: unknown, max = 1000): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.length <= max);
}
function isTimestamp(v: unknown): v is string {
  return typeof v === 'string' && ISO_TS_RE.test(v);
}
function isOptTimestamp(v: unknown): boolean {
  return v === null || v === undefined || isTimestamp(v);
}
function isPositiveInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 1_000_000;
}
function isOptPositiveInt(v: unknown): boolean {
  return v === null || v === undefined || isPositiveInt(v);
}
function isOneOf<T extends string>(v: unknown, options: readonly T[]): v is T {
  return typeof v === 'string' && (options as readonly string[]).includes(v);
}

// ── Domain constants ──────────────────────────────────────────────────────────

export const STATUS_VALUES    = [
  'Available',
  'Cooling Down',
  'Limit Reached',
  'Resetting Soon',
  'Unknown',
  'Active',
  'Limited',
  'Cooldown',
] as const;
export const COOLDOWN_UNITS   = ['hours', 'days', 'minutes'] as const;
export const THEME_VALUES     = ['dark', 'light', 'system'] as const;
export const TIMEFORMAT_VALUES = ['12h', '24h'] as const;

// ── Validators ────────────────────────────────────────────────────────────────

/** POST /api/emails */
export function validateEmailCreate(body: unknown): void {
  const e: ValidationError[] = [];
  const b = body as Record<string, unknown>;

  if (!isUUID(b?.id))         e.push({ field: 'id',       message: 'Must be a valid UUID' });
  if (!isEmail(b?.email))     e.push({ field: 'email',    message: 'Must be a valid email address (max 320 chars)' });
  if (!isString(b?.nickname, 100))
                              e.push({ field: 'nickname', message: 'Required, max 100 characters' });
  if (!isString(b?.provider, 100))
                              e.push({ field: 'provider', message: 'Required, max 100 characters' });
  if (!isTimestamp(b?.createdAt))
                              e.push({ field: 'createdAt', message: 'Must be a valid ISO timestamp' });
  if (!isTimestamp(b?.updatedAt))
                              e.push({ field: 'updatedAt', message: 'Must be a valid ISO timestamp' });

  if (e.length) throw new ValidationFailed(e);
}

/** PUT /api/emails/:id */
export function validateEmailUpdate(body: unknown): void {
  const e: ValidationError[] = [];
  const b = body as Record<string, unknown>;

  if (!isEmail(b?.email))     e.push({ field: 'email',    message: 'Must be a valid email address (max 320 chars)' });
  if (!isString(b?.nickname, 100))
                              e.push({ field: 'nickname', message: 'Required, max 100 characters' });
  if (!isString(b?.provider, 100))
                              e.push({ field: 'provider', message: 'Required, max 100 characters' });
  if (!isTimestamp(b?.updatedAt))
                              e.push({ field: 'updatedAt', message: 'Must be a valid ISO timestamp' });

  if (e.length) throw new ValidationFailed(e);
}

/** POST /api/services */
export function validateServiceCreate(body: unknown): void {
  const e: ValidationError[] = [];
  const b = body as Record<string, unknown>;

  if (!isUUID(b?.id))              e.push({ field: 'id',   message: 'Must be a valid UUID' });
  if (!isString(b?.name, 100))     e.push({ field: 'name', message: 'Required, max 100 characters' });
  if (!isString(b?.icon, 100))     e.push({ field: 'icon', message: 'Required, max 100 characters' });
  if (!isString(b?.color, 20))     e.push({ field: 'color', message: 'Required, max 20 characters (e.g. #ff6b6b)' });
  if (typeof b?.isCustom !== 'boolean')
                                   e.push({ field: 'isCustom', message: 'Must be a boolean' });
  if (!isOptPositiveInt(b?.defaultCooldownValue))
                                   e.push({ field: 'defaultCooldownValue', message: 'Must be a non-negative integer ≤ 1,000,000' });
  if (b?.defaultCooldownUnit !== undefined && b?.defaultCooldownUnit !== null
      && !isOneOf(b?.defaultCooldownUnit, COOLDOWN_UNITS))
                                   e.push({ field: 'defaultCooldownUnit', message: `Must be one of: ${COOLDOWN_UNITS.join(', ')}` });
  if (typeof b?.autoStartCooldown !== 'boolean')
                                   e.push({ field: 'autoStartCooldown', message: 'Must be a boolean' });
  if (typeof b?.autoResetStatus !== 'boolean')
                                   e.push({ field: 'autoResetStatus', message: 'Must be a boolean' });
  if (typeof b?.allowOverride !== 'boolean')
                                   e.push({ field: 'allowOverride', message: 'Must be a boolean' });

  if (e.length) throw new ValidationFailed(e);
}

/** PUT /api/services/:id */
export function validateServiceUpdate(body: unknown): void {
  const e: ValidationError[] = [];
  const b = body as Record<string, unknown>;

  if (!isString(b?.name, 100))  e.push({ field: 'name', message: 'Required, max 100 characters' });
  if (!isString(b?.icon, 100))  e.push({ field: 'icon', message: 'Required, max 100 characters' });
  if (!isString(b?.color, 20))  e.push({ field: 'color', message: 'Required, max 20 characters' });
  if (!isOptPositiveInt(b?.defaultCooldownValue))
                                e.push({ field: 'defaultCooldownValue', message: 'Must be a non-negative integer ≤ 1,000,000' });
  if (b?.defaultCooldownUnit !== undefined && b?.defaultCooldownUnit !== null
      && !isOneOf(b?.defaultCooldownUnit, COOLDOWN_UNITS))
                                e.push({ field: 'defaultCooldownUnit', message: `Must be one of: ${COOLDOWN_UNITS.join(', ')}` });

  if (e.length) throw new ValidationFailed(e);
}

/** PUT /api/email-services (batch update) */
export function validateEmailServiceUpdate(body: unknown): void {
  const e: ValidationError[] = [];
  const b = body as Record<string, unknown>;

  if (!isUUID(b?.id))        e.push({ field: 'id',     message: 'Must be a valid UUID' });
  if (!isUUID(b?.emailId))   e.push({ field: 'emailId', message: 'Must be a valid UUID' });
  if (!isUUID(b?.serviceId)) e.push({ field: 'serviceId', message: 'Must be a valid UUID' });
  if (!isOneOf(b?.status, STATUS_VALUES))
                             e.push({ field: 'status', message: `Must be one of: ${STATUS_VALUES.join(', ')}` });
  if (!isOptPositiveInt(b?.remainingRequests))
                             e.push({ field: 'remainingRequests', message: 'Must be a non-negative integer ≤ 1,000,000' });
  if (!isOptPositiveInt(b?.maximumRequests))
                             e.push({ field: 'maximumRequests', message: 'Must be a non-negative integer ≤ 1,000,000' });
  if (!isOptTimestamp(b?.lastUsed))
                             e.push({ field: 'lastUsed', message: 'Must be a valid ISO timestamp or null' });
  if (!isOptTimestamp(b?.lastLimitReached))
                             e.push({ field: 'lastLimitReached', message: 'Must be a valid ISO timestamp or null' });
  if (!isOptTimestamp(b?.estimatedResetTime))
                             e.push({ field: 'estimatedResetTime', message: 'Must be a valid ISO timestamp or null' });
  if (!isOptPositiveInt(b?.estimatedResetDuration))
                             e.push({ field: 'estimatedResetDuration', message: 'Must be a non-negative integer or null' });
  if (!isOptString(b?.notes, 1000))
                             e.push({ field: 'notes', message: 'Must be a string, max 1000 characters' });
  if (!isTimestamp(b?.updatedAt))
                             e.push({ field: 'updatedAt', message: 'Must be a valid ISO timestamp' });

  if (e.length) throw new ValidationFailed(e);
}

/** POST /api/history */
export function validateHistoryCreate(body: unknown): void {
  const e: ValidationError[] = [];
  const b = body as Record<string, unknown>;

  if (!isUUID(b?.id))            e.push({ field: 'id',        message: 'Must be a valid UUID' });
  if (!isUUID(b?.emailServiceId))e.push({ field: 'emailServiceId', message: 'Must be a valid UUID' });
  if (!isString(b?.emailNickname, 100))
                                 e.push({ field: 'emailNickname', message: 'Required, max 100 characters' });
  if (!isEmail(b?.emailAddress)) e.push({ field: 'emailAddress', message: 'Must be a valid email address' });
  if (!isString(b?.serviceName, 100))
                                 e.push({ field: 'serviceName', message: 'Required, max 100 characters' });
  if (!isString(b?.event, 100))  e.push({ field: 'event',       message: 'Required, max 100 characters' });
  if (!isTimestamp(b?.timestamp))e.push({ field: 'timestamp',   message: 'Must be a valid ISO timestamp' });
  if (!isOptString(b?.notes, 1000))
                                 e.push({ field: 'notes',       message: 'Must be a string, max 1000 characters' });

  if (e.length) throw new ValidationFailed(e);
}

/** PUT /api/settings */
export function validateSettings(body: unknown): void {
  const e: ValidationError[] = [];
  const b = body as Record<string, unknown>;
  const n = b?.notifications as Record<string, unknown> | undefined;

  if (!isOneOf(b?.theme, THEME_VALUES))
                                     e.push({ field: 'theme', message: `Must be one of: ${THEME_VALUES.join(', ')}` });
  if (!isOneOf(b?.timeFormat, TIMEFORMAT_VALUES))
                                     e.push({ field: 'timeFormat', message: `Must be one of: ${TIMEFORMAT_VALUES.join(', ')}` });
  if (!isPositiveInt(b?.defaultCooldownDuration))
                                     e.push({ field: 'defaultCooldownDuration', message: 'Must be a positive integer' });
  if (!isOneOf(b?.defaultStatus, STATUS_VALUES))
                                     e.push({ field: 'defaultStatus', message: `Must be one of: ${STATUS_VALUES.join(', ')}` });
  if (typeof n?.resetCompleted   !== 'boolean') e.push({ field: 'notifications.resetCompleted',   message: 'Must be boolean' });
  if (typeof n?.resetTenMinutes  !== 'boolean') e.push({ field: 'notifications.resetTenMinutes',  message: 'Must be boolean' });
  if (typeof n?.cooldownFinished !== 'boolean') e.push({ field: 'notifications.cooldownFinished', message: 'Must be boolean' });

  if (e.length) throw new ValidationFailed(e);
}
