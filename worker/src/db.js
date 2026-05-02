export async function listPublishedBooks(db) {
  const { results } = await db.prepare(
    `SELECT * FROM books WHERE published = 1 ORDER BY slug ASC`
  ).all();
  return results || [];
}

export async function getBookBySlug(db, slug) {
  return db.prepare(`SELECT * FROM books WHERE slug = ? AND published = 1`).bind(slug).first();
}

export async function getBookById(db, bookId) {
  return db.prepare(`SELECT * FROM books WHERE book_id = ?`).bind(bookId).first();
}

export async function getAllBooks(db) {
  const { results } = await db.prepare(`SELECT * FROM books ORDER BY created_at DESC`).all();
  return results || [];
}

export async function getUserByUsername(db, username) {
  return db.prepare(`SELECT * FROM users WHERE username = ? AND role = 'customer'`).bind(username).first();
}

export async function getUserByEmail(db, email) {
  return db.prepare(`SELECT * FROM users WHERE email = ? AND role = 'customer'`).bind(email).first();
}

export async function createUser(db, user) {
  await db.prepare(`
    INSERT OR IGNORE INTO users (username, display_name, email, password_hash, role, created_at)
    VALUES (?, ?, ?, ?, 'customer', ?)
  `).bind(
    user.username,
    user.display_name || "",
    user.email || "",
    user.password_hash,
    user.created_at
  ).run();
}

export async function getUserBooks(db, username) {
  const { results } = await db.prepare(
    `SELECT book_id FROM user_books WHERE username = ?`
  ).bind(username).all();
  return (results || []).map((r) => r.book_id);
}

export async function grantBookAccess(db, username, bookId) {
  await db.prepare(`
    INSERT OR IGNORE INTO user_books (username, book_id, granted_at) VALUES (?, ?, ?)
  `).bind(username, bookId, new Date().toISOString()).run();
}

export async function revokeBookAccess(db, username, bookId) {
  await db.prepare(`DELETE FROM user_books WHERE username = ? AND book_id = ?`).bind(username, bookId).run();
}

export async function hasBookAccess(db, username, bookId) {
  const row = await db.prepare(
    `SELECT 1 FROM user_books WHERE username = ? AND book_id = ?`
  ).bind(username, bookId).first();
  return !!row;
}

export async function listUsers(db) {
  const { results } = await db.prepare(
    `SELECT username, display_name, email, created_at FROM users WHERE role = 'customer' ORDER BY created_at DESC`
  ).all();
  return results || [];
}

export async function updateUserPasswordHash(db, username, passwordHash) {
  await db.prepare(`UPDATE users SET password_hash = ? WHERE username = ?`).bind(passwordHash, username).run();
}

export async function invalidateUserSessions(db, username) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const result = await db.prepare(
    `UPDATE users SET sessions_valid_after = ? WHERE username = ?`
  ).bind(nowSeconds, username).run();
  return result?.meta?.changes ?? result?.changes ?? 0;
}

export async function recordStripeEvent(db, eventId, eventType) {
  const result = await db.prepare(
    `INSERT OR IGNORE INTO stripe_events (event_id, event_type, received_at) VALUES (?, ?, ?)`
  ).bind(eventId, eventType || "", new Date().toISOString()).run();
  const changes = result?.meta?.changes ?? result?.changes ?? 0;
  return changes > 0;
}

export async function recordRevokedJti(db, jti, expiresAt) {
  await db.prepare(
    `INSERT OR IGNORE INTO revoked_sessions (jti, expires_at, revoked_at) VALUES (?, ?, ?)`
  ).bind(jti, expiresAt, new Date().toISOString()).run();
}

export async function isJtiRevoked(db, jti) {
  if (!jti) return false;
  const row = await db.prepare(`SELECT 1 FROM revoked_sessions WHERE jti = ?`).bind(jti).first();
  return !!row;
}

export async function storeGoogleNonce(db, nonce, ttlSeconds = 600) {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  await db.prepare(
    `INSERT OR REPLACE INTO google_nonces (nonce, expires_at, issued_at) VALUES (?, ?, ?)`
  ).bind(nonce, expiresAt, new Date().toISOString()).run();
  return expiresAt;
}

export async function consumeGoogleNonce(db, nonce) {
  if (!nonce) return false;
  const row = await db.prepare(
    `SELECT expires_at FROM google_nonces WHERE nonce = ?`
  ).bind(nonce).first();
  if (!row) return false;
  await db.prepare(`DELETE FROM google_nonces WHERE nonce = ?`).bind(nonce).run();
  const now = Math.floor(Date.now() / 1000);
  return row.expires_at >= now;
}

export async function pruneExpiredNonces(db) {
  const now = Math.floor(Date.now() / 1000);
  await db.prepare(`DELETE FROM google_nonces WHERE expires_at < ?`).bind(now).run();
}

export async function recordLoginAttempt(db, identifier, ip, success) {
  await db.prepare(
    `INSERT INTO login_attempts (identifier, ip, success, attempted_at) VALUES (?, ?, ?, ?)`
  ).bind(identifier || "", ip || "", success ? 1 : 0, Date.now()).run();
}

export async function countRecentFailedAttempts(db, identifier, windowMs) {
  const since = Date.now() - windowMs;
  const row = await db.prepare(
    `SELECT COUNT(*) as n FROM login_attempts WHERE identifier = ? AND success = 0 AND attempted_at >= ?`
  ).bind(identifier || "", since).first();
  return row?.n ?? 0;
}

export async function countRecentAttemptsByIp(db, ip, windowMs) {
  const since = Date.now() - windowMs;
  const row = await db.prepare(
    `SELECT COUNT(*) as n FROM login_attempts WHERE ip = ? AND attempted_at >= ?`
  ).bind(ip || "", since).first();
  return row?.n ?? 0;
}

export async function pruneOldLoginAttempts(db, olderThanMs) {
  const cutoff = Date.now() - olderThanMs;
  await db.prepare(`DELETE FROM login_attempts WHERE attempted_at < ?`).bind(cutoff).run();
}

export async function logAuthEvent(db, eventType, opts = {}) {
  const truncate = (v, max) => {
    if (v === undefined || v === null) return null;
    if (typeof v !== "string") return String(v).slice(0, max);
    return v.slice(0, max);
  };
  let metaJson = null;
  if (opts.metadata) {
    try {
      metaJson = JSON.stringify(opts.metadata);
      if (metaJson.length > 500) metaJson = metaJson.slice(0, 500);
    } catch { metaJson = null; }
  }
  await db.prepare(
    `INSERT INTO auth_events (event_type, username, ip, user_agent, result, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    eventType,
    truncate(opts.username, 120),
    truncate(opts.ip, 60),
    truncate(opts.userAgent, 200),
    truncate(opts.result, 60),
    metaJson,
    Date.now()
  ).run();
}

export async function pruneOldAuthEvents(db, olderThanDays = 90) {
  const cutoff = Date.now() - olderThanDays * 24 * 3600 * 1000;
  await db.prepare(`DELETE FROM auth_events WHERE created_at < ?`).bind(cutoff).run();
}

export async function listRecentAuthEvents(db, limit = 100) {
  const { results } = await db.prepare(
    `SELECT * FROM auth_events ORDER BY created_at DESC LIMIT ?`
  ).bind(Math.min(limit, 500)).all();
  return results || [];
}

export async function createPasswordResetToken(db, token, username, ttlSeconds = 3600) {
  await db.prepare(
    `DELETE FROM password_resets WHERE username = ? AND used_at IS NULL`
  ).bind(username).run();
  const expiresAt = Date.now() + ttlSeconds * 1000;
  await db.prepare(
    `INSERT INTO password_resets (token, username, expires_at, created_at) VALUES (?, ?, ?, ?)`
  ).bind(token, username, expiresAt, Date.now()).run();
  return expiresAt;
}

export async function consumePasswordResetToken(db, token) {
  const row = await db.prepare(
    `SELECT username, expires_at, used_at FROM password_resets WHERE token = ?`
  ).bind(token).first();
  if (!row) return null;
  if (row.used_at) return null;
  if (row.expires_at < Date.now()) return null;
  await db.prepare(`UPDATE password_resets SET used_at = ? WHERE token = ?`).bind(Date.now(), token).run();
  return row.username;
}

export async function pruneExpiredPasswordResets(db) {
  await db.prepare(`DELETE FROM password_resets WHERE expires_at < ?`).bind(Date.now()).run();
}

export async function createEmailVerificationToken(db, token, username, ttlSeconds = 86400) {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  await db.prepare(
    `INSERT INTO email_verifications (token, username, expires_at, created_at) VALUES (?, ?, ?, ?)`
  ).bind(token, username, expiresAt, Date.now()).run();
  return expiresAt;
}

export async function consumeEmailVerificationToken(db, token) {
  const row = await db.prepare(
    `SELECT username, expires_at, used_at FROM email_verifications WHERE token = ?`
  ).bind(token).first();
  if (!row) return { state: "not_found", username: null };
  if (row.used_at) return { state: "already_used", username: row.username };
  if (row.expires_at < Date.now()) return { state: "expired", username: null };
  await db.prepare(`UPDATE email_verifications SET used_at = ? WHERE token = ?`).bind(Date.now(), token).run();
  return { state: "ok", username: row.username };
}

export async function markUserEmailVerified(db, username) {
  await db.prepare(`UPDATE users SET email_verified_at = ? WHERE username = ?`).bind(Date.now(), username).run();
}

export async function getAdminTotp(db, username) {
  return db.prepare(`SELECT * FROM admin_totp WHERE username = ?`).bind(username).first();
}

export async function saveAdminTotp(db, username, secret) {
  await db.prepare(
    `INSERT INTO admin_totp (username, secret, created_at) VALUES (?, ?, ?)
     ON CONFLICT(username) DO UPDATE SET secret = excluded.secret, confirmed_at = NULL, created_at = excluded.created_at`
  ).bind(username, secret, Date.now()).run();
}

export async function confirmAdminTotp(db, username) {
  await db.prepare(`UPDATE admin_totp SET confirmed_at = ? WHERE username = ?`).bind(Date.now(), username).run();
}

export async function deleteAdminTotp(db, username) {
  await db.prepare(`DELETE FROM admin_totp WHERE username = ?`).bind(username).run();
}

export async function createWebBridgeTicket(db, ticket, username, ttlSeconds = 60) {
  const now = Date.now();
  const expiresAt = now + ttlSeconds * 1000;
  await db.prepare(
    `INSERT INTO web_bridge_tickets (ticket, username, expires_at, created_at) VALUES (?, ?, ?, ?)`
  ).bind(ticket, username, expiresAt, now).run();
  return expiresAt;
}

export async function consumeWebBridgeTicket(db, ticket) {
  if (!ticket) return null;
  const row = await db.prepare(
    `SELECT username, expires_at, used_at FROM web_bridge_tickets WHERE ticket = ?`
  ).bind(ticket).first();
  if (!row) return null;
  if (row.used_at) return null;
  if (row.expires_at < Date.now()) return null;
  const result = await db.prepare(
    `UPDATE web_bridge_tickets SET used_at = ? WHERE ticket = ? AND used_at IS NULL`
  ).bind(Date.now(), ticket).run();
  const changes = result?.meta?.changes ?? result?.changes ?? 0;
  if (changes === 0) return null;
  return row.username;
}

export async function pruneExpiredWebBridgeTickets(db) {
  await db.prepare(`DELETE FROM web_bridge_tickets WHERE expires_at < ?`).bind(Date.now()).run();
}

const ALLOWED_ANALYTICS_EVENTS = new Set([
  "view_catalog",
  "view_book",
  "click_buy",
  "checkout_start",
  "purchase_success",
  "reader_opened",
  "login_view",
  "register_view",
]);

export function isAllowedAnalyticsEvent(eventType) {
  return typeof eventType === "string" && ALLOWED_ANALYTICS_EVENTS.has(eventType);
}

export async function recordAnalyticsEvent(db, opts = {}) {
  if (!isAllowedAnalyticsEvent(opts.eventType)) return false;
  const truncate = (v, max) => {
    if (v === undefined || v === null) return null;
    const s = typeof v === "string" ? v : String(v);
    return s.slice(0, max);
  };
  let metaJson = null;
  if (opts.metadata) {
    try {
      metaJson = JSON.stringify(opts.metadata);
      if (metaJson.length > 400) metaJson = metaJson.slice(0, 400);
    } catch { metaJson = null; }
  }
  await db.prepare(
    `INSERT INTO analytics_events (event_type, slug, username, session_id, platform, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    opts.eventType,
    truncate(opts.slug, 120),
    truncate(opts.username, 120),
    truncate(opts.sessionId, 80),
    truncate(opts.platform, 20),
    metaJson,
    Date.now()
  ).run();
  return true;
}

export async function queryFunnelCounts(db, sinceMs) {
  const since = Date.now() - sinceMs;
  const { results } = await db.prepare(
    `SELECT event_type, COUNT(*) as n FROM analytics_events
     WHERE created_at >= ? GROUP BY event_type`
  ).bind(since).all();
  const map = {};
  for (const r of results || []) map[r.event_type] = r.n;
  return map;
}

export async function queryFunnelBySessionCounts(db, sinceMs) {
  const since = Date.now() - sinceMs;
  const { results } = await db.prepare(
    `SELECT event_type, COUNT(DISTINCT session_id) as n FROM analytics_events
     WHERE created_at >= ? AND session_id IS NOT NULL GROUP BY event_type`
  ).bind(since).all();
  const map = {};
  for (const r of results || []) map[r.event_type] = r.n;
  return map;
}

export async function pruneOldAnalyticsEvents(db, olderThanDays = 90) {
  const cutoff = Date.now() - olderThanDays * 24 * 3600 * 1000;
  await db.prepare(`DELETE FROM analytics_events WHERE created_at < ?`).bind(cutoff).run();
}

export async function hasEmailReminderBeenSent(db, username, reminderType, scope = null) {
  const row = await db.prepare(
    `SELECT 1 FROM email_reminders WHERE username = ? AND reminder_type = ? AND COALESCE(scope, '') = COALESCE(?, '')`
  ).bind(username, reminderType, scope).first();
  return !!row;
}

export async function markEmailReminderSent(db, username, reminderType, scope = null) {
  await db.prepare(
    `INSERT OR IGNORE INTO email_reminders (username, reminder_type, scope, sent_at) VALUES (?, ?, ?, ?)`
  ).bind(username, reminderType, scope, Date.now()).run();
}

export async function recordReaderOpen(db, username, bookId) {
  await db.prepare(
    `INSERT OR IGNORE INTO reader_opens (username, book_id, first_opened_at) VALUES (?, ?, ?)`
  ).bind(username, bookId, Date.now()).run();
}

export async function hasReaderOpened(db, username, bookId) {
  const row = await db.prepare(
    `SELECT 1 FROM reader_opens WHERE username = ? AND book_id = ?`
  ).bind(username, bookId).first();
  return !!row;
}

export async function findStaleRegistrations(db, olderThanMs, maxAgeMs) {
  const now = Date.now();
  const cutoffRecent = now - olderThanMs;
  const cutoffOld = now - maxAgeMs;
  const { results } = await db.prepare(
    `SELECT u.username, u.email, u.display_name, u.created_at
     FROM users u
     WHERE u.role = 'customer'
       AND u.email IS NOT NULL AND u.email != ''
       AND u.created_at <= ?
       AND u.created_at >= ?
       AND NOT EXISTS (SELECT 1 FROM user_books ub WHERE ub.username = u.username)
       AND NOT EXISTS (SELECT 1 FROM email_reminders er WHERE er.username = u.username AND er.reminder_type = 'register_no_purchase_48h')
     LIMIT 100`
  ).bind(cutoffRecent, cutoffOld).all();
  return results || [];
}

export async function findStalePurchases(db, olderThanMs, maxAgeMs) {
  const now = Date.now();
  const cutoffRecent = now - olderThanMs;
  const cutoffOld = now - maxAgeMs;
  const { results } = await db.prepare(
    `SELECT u.username, u.email, u.display_name, ub.book_id, ub.granted_at
     FROM users u
     JOIN user_books ub ON ub.username = u.username
     WHERE u.role = 'customer'
       AND u.email IS NOT NULL AND u.email != ''
       AND ub.granted_at <= ?
       AND ub.granted_at >= ?
       AND NOT EXISTS (SELECT 1 FROM reader_opens ro WHERE ro.username = u.username AND ro.book_id = ub.book_id)
       AND NOT EXISTS (SELECT 1 FROM email_reminders er WHERE er.username = u.username AND er.reminder_type = 'purchase_no_read_72h' AND er.scope = ub.book_id)
     LIMIT 100`
  ).bind(cutoffRecent, cutoffOld).all();
  return results || [];
}

export async function nextAvailableUsername(db, base) {
  let candidate = base;
  let suffix = 2;
  while (await getUserByUsername(db, candidate)) {
    candidate = `${base}_${suffix}`;
    suffix++;
  }
  return candidate;
}
