-- v6.2 migration: nonce binding + signed URL support
-- (signed URLs are stateless HMAC, no table needed)

CREATE TABLE IF NOT EXISTS google_nonces (
  nonce TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  issued_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_google_nonces_expires ON google_nonces(expires_at);
