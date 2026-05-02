CREATE TABLE IF NOT EXISTS web_bridge_tickets (
  ticket TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_web_bridge_tickets_expires_at
  ON web_bridge_tickets (expires_at);
