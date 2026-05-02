-- v6.1 hardening migration
-- 1. UNIQUE index on users(email) to kill race-condition duplicate signups
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email) WHERE email != '';

-- 2. stripe_events table for webhook idempotency
CREATE TABLE IF NOT EXISTS stripe_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT,
  received_at TEXT NOT NULL
);

-- 3. revoked_sessions table for server-side logout
CREATE TABLE IF NOT EXISTS revoked_sessions (
  jti TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  revoked_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_revoked_sessions_expires ON revoked_sessions(expires_at);
