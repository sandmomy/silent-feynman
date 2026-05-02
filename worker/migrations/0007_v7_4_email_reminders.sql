CREATE TABLE IF NOT EXISTS email_reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  reminder_type TEXT NOT NULL,
  scope TEXT,
  sent_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_reminders_user_type_scope
  ON email_reminders (username, reminder_type, COALESCE(scope, ''));

CREATE INDEX IF NOT EXISTS idx_email_reminders_sent_at
  ON email_reminders (sent_at);

CREATE TABLE IF NOT EXISTS reader_opens (
  username TEXT NOT NULL,
  book_id TEXT NOT NULL,
  first_opened_at INTEGER NOT NULL,
  PRIMARY KEY (username, book_id)
);
