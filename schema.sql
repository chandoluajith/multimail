-- Drop in dependency order
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS revoked_tokens;
DROP TABLE IF EXISTS rate_limits;
DROP TABLE IF EXISTS usage_history;
DROP TABLE IF EXISTS email_services;
DROP TABLE IF EXISTS emails;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS users;

-- Users (created on first Google sign-in)
CREATE TABLE users (
  id        TEXT PRIMARY KEY,
  email     TEXT NOT NULL UNIQUE,
  name      TEXT,
  avatar    TEXT,
  createdAt TEXT NOT NULL
);

-- Emails (per-user)
CREATE TABLE emails (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  email TEXT NOT NULL,
  nickname TEXT NOT NULL,
  provider TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Services (global defaults userId=NULL; custom services userId=owner)
CREATE TABLE services (
  id TEXT PRIMARY KEY,
  userId TEXT,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  isCustom INTEGER DEFAULT 0,
  defaultCooldownValue INTEGER,
  defaultCooldownUnit TEXT,
  autoStartCooldown INTEGER DEFAULT 1,
  autoResetStatus INTEGER DEFAULT 1,
  allowOverride INTEGER DEFAULT 1,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Email-Service join (per-user)
CREATE TABLE email_services (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  emailId TEXT NOT NULL,
  serviceId TEXT NOT NULL,
  status TEXT NOT NULL,
  remainingRequests INTEGER,
  maximumRequests INTEGER,
  lastUsed TEXT,
  lastLimitReached TEXT,
  estimatedResetTime TEXT,
  estimatedResetDuration INTEGER,
  notes TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (emailId) REFERENCES emails(id) ON DELETE CASCADE,
  FOREIGN KEY (serviceId) REFERENCES services(id) ON DELETE CASCADE
);

-- Usage History (per-user)
CREATE TABLE usage_history (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  emailServiceId TEXT NOT NULL,
  emailNickname TEXT NOT NULL,
  emailAddress TEXT NOT NULL,
  serviceName TEXT NOT NULL,
  event TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  notes TEXT,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Settings (per-user, one row per user)
CREATE TABLE settings (
  userId TEXT PRIMARY KEY,
  theme TEXT NOT NULL DEFAULT 'dark',
  notifications_resetCompleted INTEGER DEFAULT 1,
  notifications_resetTenMinutes INTEGER DEFAULT 1,
  notifications_cooldownFinished INTEGER DEFAULT 1,
  timeFormat TEXT NOT NULL DEFAULT '12h',
  defaultCooldownDuration INTEGER DEFAULT 3,
  defaultStatus TEXT NOT NULL DEFAULT 'Unknown',
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Rate limiting (sliding window per IP, auto-cleaned by window expiry logic)
CREATE TABLE rate_limits (
  key          TEXT    PRIMARY KEY,   -- "{ip}:{action}"
  count        INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL       -- unix seconds
);

-- Revoked JWT tokens (populated on logout, cleaned up by exp)
-- Prevents stolen-cookie replay attacks even after logout
CREATE TABLE revoked_tokens (
  jti TEXT    PRIMARY KEY,  -- JWT ID (UUID from jti claim)
  exp INTEGER NOT NULL      -- unix seconds — same as JWT exp, used for cleanup
);

-- Audit / security event log
-- Stores structured events for threat detection and compliance.
-- Retention: entries older than 30 days are pruned probabilistically on write.
-- PII policy: email addresses are masked before insert; UAs are capped at 200 chars.
CREATE TABLE audit_log (
  id          TEXT    PRIMARY KEY,          -- UUID
  timestamp   INTEGER NOT NULL,             -- unix seconds
  event_type  TEXT    NOT NULL,             -- see AuditEventType in logger.ts
  severity    TEXT    NOT NULL DEFAULT 'info', -- info | warn | critical
  ip          TEXT    NOT NULL,
  user_id     TEXT,                         -- NULL when unauthenticated
  method      TEXT,
  path        TEXT,
  status_code INTEGER,
  user_agent  TEXT,
  details     TEXT                          -- JSON blob for extra structured context
);

-- Index for per-IP anomaly queries (detectAnomalies function)
CREATE INDEX idx_audit_ip_ts ON audit_log (ip, timestamp);

-- Index for time-based retention purge (DELETE WHERE timestamp < cutoff)
CREATE INDEX idx_audit_ts    ON audit_log (timestamp);


-- Global default services (userId = NULL = shared for all users)
INSERT INTO services (id, userId, name, icon, color, isCustom, defaultCooldownValue, defaultCooldownUnit, autoStartCooldown, autoResetStatus, allowOverride) VALUES
('gemini',      NULL, 'Gemini',    'Sparkles',          '#10B981', 0, 1,  'hours', 1, 1, 1),
('claude',      NULL, 'Claude',    'Cpu',               '#F59E0B', 0, 3,  'hours', 1, 1, 1),
('codex',       NULL, 'Codex',     'Code2',             '#6366F1', 0, 24, 'hours', 1, 1, 1),
('cursor',      NULL, 'Cursor',    'MousePointerClick', '#3B82F6', 0, 2,  'hours', 1, 1, 1),
('windsurf',    NULL, 'Windsurf',  'Wind',              '#06B6D4', 0, 12, 'hours', 1, 1, 1),
('openai',      NULL, 'OpenAI',    'Layers',            '#8B5CF6', 0, 4,  'hours', 1, 1, 1),
('chatgpt',     NULL, 'ChatGPT',   'MessageSquareText', '#14B8A6', 0, 3,  'hours', 1, 1, 1),
('deepseek',    NULL, 'DeepSeek',  'Binary',            '#EF4444', 0, 1,  'hours', 1, 1, 1);
