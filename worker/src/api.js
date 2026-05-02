import { Router } from "./router.js";
import {
  getSession,
  buildSessionToken,
  setAuthCookie,
  clearAuthCookie,
  pbkdf2Hash,
  verifyPassword,
  constantTimeEqual,
} from "./auth.js";
import {
  listPublishedBooks,
  getBookBySlug,
  getBookById,
  getAllBooks,
  getUserByUsername,
  getUserByEmail,
  createUser,
  updateUserPasswordHash,
  getUserBooks,
  grantBookAccess,
  revokeBookAccess,
  hasBookAccess,
  listUsers,
  nextAvailableUsername,
  recordStripeEvent,
  recordRevokedJti,
  recordLoginAttempt,
  countRecentFailedAttempts,
  countRecentAttemptsByIp,
  invalidateUserSessions,
  logAuthEvent,
  listRecentAuthEvents,
  createPasswordResetToken,
  consumePasswordResetToken,
  createEmailVerificationToken,
  consumeEmailVerificationToken,
  markUserEmailVerified,
  getAdminTotp,
  saveAdminTotp,
  confirmAdminTotp,
  deleteAdminTotp,
  createWebBridgeTicket,
  consumeWebBridgeTicket,
  pruneExpiredWebBridgeTickets,
  recordAnalyticsEvent,
  isAllowedAnalyticsEvent,
  queryFunnelCounts,
  queryFunnelBySessionCounts,
  pruneOldAnalyticsEvents,
  hasEmailReminderBeenSent,
  markEmailReminderSent,
  recordReaderOpen,
  hasReaderOpened,
  findStaleRegistrations,
  findStalePurchases,
} from "./db.js";
import { sendEmail, renderPasswordResetEmail, renderEmailVerificationEmail, renderPurchaseReceiptEmail, renderPurchaseReminderEmail, renderRegisterReminderEmail } from "./email.js";
import { generateTotpSecret, verifyTotpCode, buildOtpauthUri, formatSecretForDisplay } from "./totp.js";
import { googleAuthStart, googleAuthCallback, googleMobileSignIn, googleMobileNonceIssue } from "./google-auth.js";
import { createCheckoutSession, createBundleCheckoutSession, retrieveCheckoutSession, verifyStripeSignature } from "./stripe.js";
import { runD1Backup } from "./backup.js";
import { buildSignedAssetUrl, verifySignedAssetUrl, isStreamingAsset } from "./signed-urls.js";

export const router = new Router();

function json(data, status = 200, extraHeaders = {}) {
  const headers = new Headers({ "Content-Type": "application/json", ...extraHeaders });
  return new Response(JSON.stringify(data), { status, headers });
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 80) || "untitled";
}

function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() || "unknown";
}

function clientUA(request) {
  return (request.headers.get("User-Agent") || "").slice(0, 300);
}

function randomToken(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const LOGIN_IP_MAX_PER_MINUTE = 20;
const LOGIN_IDENTIFIER_MAX_FAILED = 5;
const LOGIN_LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCKOUT_DURATION_MS = 30 * 60 * 1000;

async function enforceLoginThrottle(env, identifier, ip) {
  const ipCount = await countRecentAttemptsByIp(env.DB, ip, 60 * 1000);
  if (ipCount >= LOGIN_IP_MAX_PER_MINUTE) {
    await logAuthEvent(env.DB, "rate_limited", { username: identifier, ip, result: "blocked" });
    throw { status: 429, message: "Too many attempts. Wait a minute and try again." };
  }
  const adminIdentifier = (env.ADMIN_USERNAME || "").toLowerCase();
  if (identifier && identifier !== adminIdentifier) {
    const fails = await countRecentFailedAttempts(env.DB, identifier, LOGIN_LOCKOUT_WINDOW_MS);
    if (fails >= LOGIN_IDENTIFIER_MAX_FAILED) {
      await logAuthEvent(env.DB, "locked_out", { username: identifier, ip, result: "blocked" });
      throw { status: 429, message: "Too many failed attempts for this account. Try again in 30 minutes." };
    }
  }
}

async function requireSession(request, env, options) {
  const session = await getSession(request, env, options);
  if (!session) throw { status: 401, message: "Sign in to continue." };
  return session;
}

async function requireAdmin(request, env) {
  const session = await requireSession(request, env);
  if (session.role !== "admin") throw { status: 403, message: "Only Eugene can access this area." };
  return session;
}

async function requireCustomer(request, env, options) {
  const session = await requireSession(request, env, options);
  if (session.role !== "customer" && session.role !== "admin") {
    throw { status: 403, message: "A reader account is required." };
  }
  return session;
}

function bookToCustomerPayload(book, ownedBookIds, env) {
  const hasAccess = ownedBookIds.includes(book.book_id);
  const softLaunch = env.SOFT_LAUNCH_ENABLED === "true";
  const launchSlug = env.LAUNCH_BOOK_SLUG || "book_chapter_1";
  const isLaunchTitle = softLaunch && book.slug === launchSlug;
  const canPurchase = book.published && (!softLaunch || isLaunchTitle);
  return {
    book_id: book.book_id,
    title: book.title,
    slug: book.slug,
    source_extension: book.source_extension,
    char_count: book.char_count,
    word_count: book.word_count,
    estimated_read_minutes: book.estimated_read_minutes,
    excerpt: book.excerpt,
    published: !!book.published,
    published_at: book.published_at,
    public_path: `/b/${book.slug}`,
    public_profile: {
      hook: book.hook || book.title,
      summary: book.summary || book.excerpt,
      priceLabel: book.price_label || "",
      ctaLabel: book.cta_label || "Read and listen",
      featured: !!book.featured,
    },
    published_audio_available: !!book.has_audio,
    has_access: hasAccess,
    is_launch_title: isLaunchTitle,
    public_purchase_open: canPurchase,
    launch_state: hasAccess ? "owned" : canPurchase ? "live_now" : "coming_next",
    source_url: null,
    customer_text_url: hasAccess ? `/api/customer/books/${book.slug}/text` : null,
    customer_audio_url: hasAccess && book.has_audio ? `/api/customer/books/${book.slug}/audio` : null,
    customer_pdf_url: hasAccess && book.source_extension === ".pdf" ? `/api/customer/books/${book.slug}/pdf` : null,
    narrations: [],
    published_narration: book.has_audio ? { audio_url: `/api/customer/books/${book.slug}/audio` } : null,
    workflow: { has_approved_preview: false, can_publish: false },
  };
}

router.get("/api/health", async () => json({ status: "ok" }));

router.get("/api/session/status", async (request, env) => {
  const session = await getSession(request, env);
  const selfSignup = env.SELF_SIGNUP_ENABLED === "true";
  const googleEnabled = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  if (!session) {
    return json({
      login_enabled: true,
      register_enabled: selfSignup,
      google_enabled: googleEnabled,
      authenticated: false,
      username: null,
      display_name: null,
      role: null,
    });
  }
  let displayName = session.username;
  if (session.role === "customer") {
    const user = await getUserByUsername(env.DB, session.username);
    if (user) displayName = user.display_name || user.username;
  }
  return json({
    login_enabled: true,
    register_enabled: selfSignup,
    google_enabled: googleEnabled,
    authenticated: true,
    username: session.username,
    display_name: displayName,
    role: session.role,
  });
});

router.get("/api/auth/status", (req, env) => router.match("GET", "/api/session/status").handler(req, env, {}));

router.post("/api/session/login", async (request, env) => {
  const body = await request.json().catch(() => ({}));
  const { username, password } = body || {};
  if (!env.SESSION_SECRET) throw { status: 500, message: "server_misconfigured" };
  const secret = env.SESSION_SECRET;
  const selfSignup = env.SELF_SIGNUP_ENABLED === "true";
  const googleEnabled = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  const headers = new Headers({ "Content-Type": "application/json" });
  const ip = clientIp(request);
  const ua = clientUA(request);
  const identifier = (username || "").trim().toLowerCase();

  await enforceLoginThrottle(env, identifier, ip);

  if (
    typeof env.ADMIN_USERNAME === "string" &&
    typeof env.ADMIN_PASSWORD === "string" &&
    constantTimeEqual(username ?? "", env.ADMIN_USERNAME) &&
    constantTimeEqual(password ?? "", env.ADMIN_PASSWORD)
  ) {
    const totpRow = await getAdminTotp(env.DB, env.ADMIN_USERNAME);
    if (totpRow && totpRow.confirmed_at) {
      const totpCode = (body?.totp_code || body?.totp || "").toString();
      if (!totpCode) {
        return json({ error: "totp_required" }, 401);
      }
      const ok = await verifyTotpCode(totpRow.secret, totpCode);
      if (!ok) {
        await recordLoginAttempt(env.DB, identifier, ip, false);
        await logAuthEvent(env.DB, "login_fail", { username: env.ADMIN_USERNAME, ip, userAgent: ua, result: "totp_invalid" });
        return json({ error: "totp_invalid" }, 401);
      }
    }
    await recordLoginAttempt(env.DB, identifier, ip, true);
    await logAuthEvent(env.DB, "login_success", { username: env.ADMIN_USERNAME, ip, userAgent: ua, result: totpRow?.confirmed_at ? "admin_2fa" : "admin" });
    const token = await buildSessionToken(env.ADMIN_USERNAME, "admin", secret);
    setAuthCookie(headers, token, env);
    return new Response(JSON.stringify({
      login_enabled: true,
      register_enabled: selfSignup,
      google_enabled: googleEnabled,
      authenticated: true,
      username: env.ADMIN_USERNAME,
      display_name: env.ADMIN_USERNAME,
      role: "admin",
    }), { status: 200, headers });
  }

  let user = await getUserByUsername(env.DB, slugify(username || ""));
  if (!user && username) user = await getUserByEmail(env.DB, username.trim().toLowerCase());
  if (!user) {
    await recordLoginAttempt(env.DB, identifier, ip, false);
    await logAuthEvent(env.DB, "login_fail", { username: identifier, ip, userAgent: ua, result: "no_user" });
    return json({ error: "Incorrect credentials." }, 401);
  }
  const check = await verifyPassword(password || "", user.password_hash);
  if (!check.ok) {
    await recordLoginAttempt(env.DB, identifier, ip, false);
    await logAuthEvent(env.DB, "login_fail", { username: user.username, ip, userAgent: ua, result: "bad_password" });
    return json({ error: "Incorrect credentials." }, 401);
  }
  if (check.needsRehash) {
    try {
      const rehashed = await pbkdf2Hash(password);
      await updateUserPasswordHash(env.DB, user.username, rehashed);
    } catch {}
  }
  await recordLoginAttempt(env.DB, identifier, ip, true);
  await logAuthEvent(env.DB, "login_success", { username: user.username, ip, userAgent: ua, result: "customer" });
  const token = await buildSessionToken(user.username, "customer", secret);
  setAuthCookie(headers, token, env);
  return new Response(JSON.stringify({
    login_enabled: true,
    register_enabled: selfSignup,
    google_enabled: googleEnabled,
    authenticated: true,
    username: user.username,
    display_name: user.display_name || user.username,
    role: "customer",
  }), { status: 200, headers });
});

router.post("/api/auth/login", (req, env) => router.match("POST", "/api/session/login").handler(req, env, {}));

router.post("/api/session/register", async (request, env) => {
  if (env.SELF_SIGNUP_ENABLED !== "true") return json({ error: "Registration is not enabled." }, 403);
  const body = await request.json();
  const { display_name, email, password } = body;
  const normalizedEmail = (email || "").trim().toLowerCase();
  if (!normalizedEmail.includes("@") || !normalizedEmail.split("@").pop().includes(".")) {
    return json({ error: "Enter a valid email address." }, 400);
  }
  if (!password || password.trim().length < 8) {
    return json({ error: "Password must be at least 8 characters." }, 400);
  }
  if (await getUserByEmail(env.DB, normalizedEmail)) {
    return json({ error: "That email is already registered." }, 400);
  }
  const baseUsername = slugify(normalizedEmail.split("@")[0]) || slugify(display_name) || "reader";
  const username = await nextAvailableUsername(env.DB, baseUsername);
  const hash = await pbkdf2Hash(password);
  await createUser(env.DB, {
    username,
    display_name: (display_name || "").trim() || username,
    email: normalizedEmail,
    password_hash: hash,
    created_at: new Date().toISOString(),
  });
  if (!env.SESSION_SECRET) throw { status: 500, message: "server_misconfigured" };
  const secret = env.SESSION_SECRET;
  const token = await buildSessionToken(username, "customer", secret);
  const headers = new Headers({ "Content-Type": "application/json" });
  setAuthCookie(headers, token, env);

  try {
    const verifyToken = randomToken();
    await createEmailVerificationToken(env.DB, verifyToken, username, 86400);
    const base = env.PUBLIC_BASE_URL || "https://book.eugenemierak.com";
    const verifyUrl = `${base}/api/auth/email/verify?token=${encodeURIComponent(verifyToken)}`;
    const { text, html } = renderEmailVerificationEmail(display_name || username, verifyUrl);
    await sendEmail(env, { to: normalizedEmail, subject: "Verify your BookVoice email", text, html });
    await logAuthEvent(env.DB, "register_email_sent", { username, ip: clientIp(request) });
  } catch (err) {
    await logAuthEvent(env.DB, "register_email_failed", {
      username,
      ip: clientIp(request),
      metadata: { err: String(err?.message || err) },
    });
  }

  return new Response(JSON.stringify({
    login_enabled: true,
    register_enabled: true,
    google_enabled: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    authenticated: true,
    username,
    display_name: display_name || username,
    role: "customer",
  }), { status: 200, headers });
});

router.post("/api/auth/register", (req, env) => router.match("POST", "/api/session/register").handler(req, env, {}));

router.post("/api/session/logout", async (request, env) => {
  const session = await getSession(request, env);
  if (session?.jti && session?.expiresAt) {
    try { await recordRevokedJti(env.DB, session.jti, session.expiresAt); } catch {}
  }
  if (session?.username) {
    try { await logAuthEvent(env.DB, "logout", { username: session.username, ip: clientIp(request), userAgent: clientUA(request) }); } catch {}
  }
  const headers = new Headers({ "Content-Type": "application/json" });
  clearAuthCookie(headers, env);
  return new Response(JSON.stringify({
    login_enabled: true,
    register_enabled: env.SELF_SIGNUP_ENABLED === "true",
    google_enabled: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    authenticated: false,
    username: null,
    display_name: null,
    role: null,
  }), { status: 200, headers });
});

router.post("/api/auth/logout", (req, env) => router.match("POST", "/api/session/logout").handler(req, env, {}));

router.post("/api/auth/mobile/logout", async (request, env) => {
  const session = await getSession(request, env);
  if (session?.jti && session?.expiresAt) {
    try { await recordRevokedJti(env.DB, session.jti, session.expiresAt); } catch {}
  }
  return json({ revoked: true });
});

// Web bridge: mobile app exchanges its Bearer session for a single-use ticket,
// then includes it in URLs opened in the external browser so the web picks up
// the cookie without forcing the user to log in again.
router.post("/api/auth/web-bridge-ticket", async (request, env) => {
  const session = await getSession(request, env);
  if (!session?.authenticated) return json({ error: "unauthorized" }, 401);
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const ticket = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const expiresAt = await createWebBridgeTicket(env.DB, ticket, session.username, 60);
  try { await pruneExpiredWebBridgeTickets(env.DB); } catch {}
  await logAuthEvent(env.DB, "web_bridge_issued", {
    username: session.username,
    ip: clientIp(request),
    userAgent: clientUA(request),
  });
  return json({ ticket, expires_at: expiresAt });
});

router.get("/api/auth/web-bridge-exchange", async (request, env) => {
  const url = new URL(request.url);
  const ticket = url.searchParams.get("ticket") || "";
  const next = url.searchParams.get("next") || "/";
  if (!ticket) return json({ error: "missing_ticket" }, 400);
  if (!env.SESSION_SECRET) throw { status: 500, message: "server_misconfigured" };
  const username = await consumeWebBridgeTicket(env.DB, ticket);
  if (!username) return json({ error: "invalid_ticket" }, 401);
  const user = await getUserByUsername(env.DB, username);
  if (!user) return json({ error: "invalid_ticket" }, 401);
  const token = await buildSessionToken(username, "customer", env.SESSION_SECRET);
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const headers = new Headers({ Location: safeNext });
  setAuthCookie(headers, token, env);
  await logAuthEvent(env.DB, "web_bridge_exchanged", {
    username,
    ip: clientIp(request),
    userAgent: clientUA(request),
  });
  return new Response(null, { status: 302, headers });
});

router.get("/api/auth/google/start", googleAuthStart);
router.get("/api/auth/google/callback", googleAuthCallback);
router.post("/api/auth/mobile/google", googleMobileSignIn);
router.post("/api/auth/mobile/google/nonce", googleMobileNonceIssue);

router.post("/api/auth/mobile/login", async (request, env) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  const rawIdentifier = (body?.username ?? body?.email ?? "").toString().trim();
  const password = (body?.password ?? "").toString();
  if (!rawIdentifier || !password) {
    return json({ error: "missing_credentials" }, 400);
  }
  let user = await getUserByUsername(env.DB, slugify(rawIdentifier));
  if (!user) user = await getUserByEmail(env.DB, rawIdentifier.toLowerCase());
  if (!user) return json({ error: "invalid_credentials" }, 401);
  if (user.password_hash?.startsWith("google_oauth:")) {
    return json({ error: "invalid_credentials" }, 401);
  }
  const check = await verifyPassword(password, user.password_hash);
  if (!check.ok) {
    return json({ error: "invalid_credentials" }, 401);
  }
  if (check.needsRehash) {
    try {
      const rehashed = await pbkdf2Hash(password);
      await updateUserPasswordHash(env.DB, user.username, rehashed);
    } catch {}
  }
  if (!env.SESSION_SECRET) throw { status: 500, message: "server_misconfigured" };
  const secret = env.SESSION_SECRET;
  const token = await buildSessionToken(user.username, "customer", secret, 24 * 30);
  return json({ token, email: user.email || "", name: user.display_name || user.username });
});

router.post("/api/auth/mobile/register", async (request, env) => {
  if (env.SELF_SIGNUP_ENABLED !== "true") return json({ error: "registration_disabled" }, 403);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  const normalizedEmail = (body?.email || "").trim().toLowerCase();
  const password = (body?.password ?? "").toString();
  const displayName = (body?.display_name ?? "").toString().trim();
  if (!normalizedEmail.includes("@") || !normalizedEmail.split("@").pop().includes(".")) {
    return json({ error: "invalid_email" }, 400);
  }
  if (!password || password.trim().length < 8) {
    return json({ error: "weak_password" }, 400);
  }
  if (await getUserByEmail(env.DB, normalizedEmail)) {
    return json({ error: "email_already_registered" }, 400);
  }
  const baseUsername = slugify(normalizedEmail.split("@")[0]) || slugify(displayName) || "reader";
  const username = await nextAvailableUsername(env.DB, baseUsername);
  const hash = await pbkdf2Hash(password);
  await createUser(env.DB, {
    username,
    display_name: displayName || username,
    email: normalizedEmail,
    password_hash: hash,
    created_at: new Date().toISOString(),
  });
  if (!env.SESSION_SECRET) throw { status: 500, message: "server_misconfigured" };
  const token = await buildSessionToken(username, "customer", env.SESSION_SECRET, 24 * 30);

  try {
    const verifyToken = randomToken();
    await createEmailVerificationToken(env.DB, verifyToken, username, 86400);
    const base = env.PUBLIC_BASE_URL || "https://book.eugenemierak.com";
    const verifyUrl = `${base}/api/auth/email/verify?token=${encodeURIComponent(verifyToken)}`;
    const { text, html } = renderEmailVerificationEmail(displayName || username, verifyUrl);
    await sendEmail(env, { to: normalizedEmail, subject: "Verify your BookVoice email", text, html });
    await logAuthEvent(env.DB, "register_email_sent", { username, ip: clientIp(request), metadata: { platform: "mobile" } });
  } catch (err) {
    await logAuthEvent(env.DB, "register_email_failed", {
      username,
      ip: clientIp(request),
      metadata: { err: String(err?.message || err), platform: "mobile" },
    });
  }

  return json({ token, email: normalizedEmail, name: displayName || username });
});

router.get("/api/customer/state", async (request, env) => {
  const session = await getSession(request, env);
  const username = session?.role === "customer" ? session.username : null;
  const books = await listPublishedBooks(env.DB);
  const ownedIds = username ? await getUserBooks(env.DB, username) : [];
  const base = env.PUBLIC_BASE_URL || "https://book.eugenemierak.com";
  const priceRaw = env.BOOK_PRICE_EUR_CENTS ? parseInt(env.BOOK_PRICE_EUR_CENTS, 10) : NaN;
  const priceCents = Number.isFinite(priceRaw) && priceRaw > 0 ? priceRaw : 1000;
  const toMobile = (b) => {
    const owned = ownedIds.includes(b.book_id);
    const cover = b.cover_path || "/covers/frequency-vibes.jpg";
    return {
      slug: b.slug,
      title: b.title,
      subtitle: b.hook || undefined,
      description: b.summary || b.excerpt || undefined,
      cover_url: `${base}${cover.startsWith("/") ? cover : `/${cover}`}`,
      price_cents: priceCents,
      currency: "eur",
      has_audio: !!b.has_audio,
      has_slides: !!b.has_slides,
      owned,
    };
  };
  const catalog = books.map(toMobile);
  const library = catalog.filter((b) => b.owned);
  const userRow = username ? await getUserByUsername(env.DB, username) : null;
  return json({
    authenticated: Boolean(username),
    email: userRow?.email || null,
    name: userRow?.display_name || userRow?.username || null,
    catalog,
    library,
  });
});

router.post("/api/customer/change-password", async (request, env) => {
  const session = await getSession(request, env);
  if (!session?.authenticated || session.role !== "customer") return json({ error: "unauthorized" }, 401);
  const body = await request.json().catch(() => ({}));
  const currentPassword = (body?.current_password || "").toString();
  const newPassword = (body?.new_password || "").toString();
  const ip = clientIp(request);
  if (!currentPassword || newPassword.length < 8) {
    return json({ error: "invalid_request" }, 400);
  }
  const user = await getUserByUsername(env.DB, session.username);
  if (!user) return json({ error: "unauthorized" }, 401);
  if (user.password_hash?.startsWith("google_oauth:")) {
    return json({ error: "oauth_account" }, 400);
  }
  const check = await verifyPassword(currentPassword, user.password_hash);
  if (!check.ok) {
    await logAuthEvent(env.DB, "password_change_fail", { username: session.username, ip, result: "wrong_current" });
    return json({ error: "wrong_password" }, 401);
  }
  const hash = await pbkdf2Hash(newPassword);
  await updateUserPasswordHash(env.DB, session.username, hash);
  await invalidateUserSessions(env.DB, session.username);
  await logAuthEvent(env.DB, "password_change_success", { username: session.username, ip });
  return json({ ok: true });
});

router.patch("/api/customer/me", async (request, env) => {
  const session = await getSession(request, env);
  if (!session?.authenticated || session.role !== "customer") return json({ error: "unauthorized" }, 401);
  const body = await request.json().catch(() => ({}));
  const user = await getUserByUsername(env.DB, session.username);
  if (!user) return json({ error: "unauthorized" }, 401);
  const ip = clientIp(request);

  const updates = {};
  let emailChanged = false;
  let requiresReverify = false;

  if (typeof body?.display_name === "string") {
    const trimmed = body.display_name.trim().slice(0, 80);
    if (trimmed && trimmed !== user.display_name) {
      updates.display_name = trimmed;
    }
  }

  if (typeof body?.email === "string") {
    const newEmail = body.email.trim().toLowerCase();
    const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail);
    if (newEmail && newEmail !== (user.email || "").toLowerCase()) {
      if (!looksLikeEmail) return json({ error: "invalid_email" }, 400);
      const existing = await getUserByEmail(env.DB, newEmail);
      if (existing && existing.username !== session.username) {
        return json({ error: "email_in_use" }, 400);
      }
      updates.email = newEmail;
      updates.email_verified_at = null;
      emailChanged = true;
      requiresReverify = true;
    }
  }

  if (Object.keys(updates).length === 0) return json({ ok: true, updated: false });

  // Defense-in-depth: whitelist allowed columns, even though `updates` is
  // built entirely by this handler. If a future dev adds a field without
  // thinking, this prevents it from hitting the DB.
  const ALLOWED_USER_COLS = new Set(["display_name", "email", "email_verified_at"]);
  const allowedKeys = Object.keys(updates).filter((k) => ALLOWED_USER_COLS.has(k));
  if (allowedKeys.length === 0) return json({ ok: true, updated: false });
  const sets = allowedKeys.map((k) => `${k} = ?`).join(", ");
  const vals = allowedKeys.map((k) => (updates[k] === null ? null : updates[k]));
  await env.DB.prepare(`UPDATE users SET ${sets} WHERE username = ?`)
    .bind(...vals, session.username)
    .run();

  if (emailChanged && updates.email) {
    try {
      const token = crypto.randomUUID().replace(/-/g, "");
      await createEmailVerificationToken(env.DB, token, session.username);
      const base = env.PUBLIC_BASE_URL || "https://book.eugenemierak.com";
      const verifyUrl = `${base}/verify-email?token=${encodeURIComponent(token)}`;
      const displayName = updates.display_name || user.display_name || session.username;
      const { html, text } = renderEmailVerificationEmail(displayName, verifyUrl);
      await sendEmail(env, { to: updates.email, subject: "Confirm your new email — BookVoice", html, text });
    } catch (err) {
      // swallow; user can request verify again later
    }
  }

  await logAuthEvent(env.DB, "profile_updated", {
    username: session.username,
    ip,
    result: emailChanged ? "email_changed" : "display_name_changed",
  });
  return json({ ok: true, updated: true, requires_reverify: requiresReverify });
});

/**
 * Permanent account deletion — GDPR right-to-erasure + Google Play policy.
 * Requires an explicit `{ confirm: "DELETE" }` body to prevent accidents.
 * Wipes user row + owned-books grants + reader opens + email reminders +
 * active sessions. Historical auth_events + stripe_events are retained as
 * pseudonymous records (username replaced on write would break audit trails).
 */
router.post("/api/customer/delete-account", async (request, env) => {
  const session = await requireCustomer(request, env);
  if (session.role !== "customer") return json({ error: "customer_only" }, 403);
  let body = {};
  try { body = await request.json(); } catch {}
  if (body?.confirm !== "DELETE") {
    return json({ error: "confirm_required", message: "Send { confirm: \"DELETE\" } to proceed." }, 400);
  }
  const username = session.username;
  const ip = clientIp(request);

  const db = env.DB;
  // Wipe user data in order (children first so FKs don't complain if present)
  await db.prepare("DELETE FROM user_books WHERE username = ?").bind(username).run();
  try { await db.prepare("DELETE FROM reader_opens WHERE username = ?").bind(username).run(); } catch {}
  try { await db.prepare("DELETE FROM email_reminders WHERE username = ?").bind(username).run(); } catch {}
  try { await db.prepare("DELETE FROM password_resets WHERE username = ?").bind(username).run(); } catch {}
  try { await db.prepare("DELETE FROM email_verifications WHERE username = ?").bind(username).run(); } catch {}
  try { await db.prepare("DELETE FROM login_attempts WHERE username = ?").bind(username).run(); } catch {}
  try { await db.prepare("DELETE FROM web_bridge_tickets WHERE username = ?").bind(username).run(); } catch {}
  // Revoke any active session tokens immediately
  try {
    const jti = session.jti || "all";
    await db.prepare(
      "INSERT OR IGNORE INTO revoked_sessions (jti, username, revoked_at, expires_at) VALUES (?, ?, ?, ?)"
    ).bind(jti, username, Date.now(), Date.now() + 86400 * 1000).run();
  } catch {}
  // Finally the user row
  await db.prepare("DELETE FROM users WHERE username = ?").bind(username).run();

  await logAuthEvent(db, "account_deleted", { username, ip, result: "success" });
  // Clear cookie on the response
  const res = json({ ok: true, deleted: true });
  res.headers.append(
    "Set-Cookie",
    "bookvoice_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
  );
  return res;
});

router.get("/api/customer/catalog", async (request, env) => {
  const session = await getSession(request, env);
  const username = session?.role === "customer" ? session.username : null;
  const books = await listPublishedBooks(env.DB);
  const ownedIds = username ? await getUserBooks(env.DB, username) : [];
  return json(books.map((b) => bookToCustomerPayload(b, ownedIds, env)));
});

router.get("/api/customer/library", async (request, env) => {
  const session = await requireCustomer(request, env);
  if (session.role === "admin") return json([]);
  const books = await listPublishedBooks(env.DB);
  const ownedIds = await getUserBooks(env.DB, session.username);
  return json(books.filter((b) => ownedIds.includes(b.book_id)).map((b) => bookToCustomerPayload(b, ownedIds, env)));
});

router.get("/api/customer/books/:slug", async (request, env, params) => {
  const session = await getSession(request, env);
  const username = session?.role === "customer" ? session.username : null;
  const book = await getBookBySlug(env.DB, params.slug);
  if (!book) return json({ error: "Not found" }, 404);
  const ownedIds = username ? await getUserBooks(env.DB, username) : [];
  return json(bookToCustomerPayload(book, ownedIds, env));
});

router.post("/api/customer/books/:slug/purchase", async (request, env, params) => {
  const session = await requireCustomer(request, env);
  if (session.role !== "admin") {
    return json({ error: "Purchases must go through Stripe checkout." }, 403);
  }
  const book = await getBookBySlug(env.DB, params.slug);
  if (!book) return json({ error: "Not found" }, 404);
  await grantBookAccess(env.DB, session.username, book.book_id);
  const ownedIds = await getUserBooks(env.DB, session.username);
  return json(bookToCustomerPayload(book, ownedIds, env));
});

router.post("/api/customer/books/:slug/checkout", async (request, env, params) => {
  const session = await requireCustomer(request, env);
  if (session.role !== "customer" && session.role !== "admin") {
    return json({ error: "Only reader accounts can buy." }, 403);
  }
  const book = await getBookBySlug(env.DB, params.slug);
  if (!book) return json({ error: "Not found" }, 404);
  const softLaunch = env.SOFT_LAUNCH_ENABLED === "true";
  const launchSlug = env.LAUNCH_BOOK_SLUG || "book_chapter_1";
  if (softLaunch && book.slug !== launchSlug) {
    return json({ error: "This chapter is not part of the first public release yet." }, 403);
  }
  const ownedIds = await getUserBooks(env.DB, session.username);
  if (ownedIds.includes(book.book_id)) {
    return json({ error: "You already own this chapter." }, 400);
  }
  const userRow = await getUserByUsername(env.DB, session.username);
  const url = new URL(request.url);
  const mobile = url.searchParams.get("mobile") === "1";
  const checkoutSession = await createCheckoutSession(
    env,
    book,
    { username: session.username, email: userRow?.email || null },
    { mobile }
  );
  return json({ url: checkoutSession.url });
});

/**
 * Full-book bundle checkout — flat €50 unlocks every published chapter.
 * Soft-launch: only launch chapter exists, so bundle ≈ single chapter.
 */
router.post("/api/customer/bundle/checkout", async (request, env) => {
  const session = await requireCustomer(request, env);
  if (session.role !== "customer" && session.role !== "admin") {
    return json({ error: "Only reader accounts can buy." }, 403);
  }
  const allBooks = await listPublishedBooks(env.DB);
  const softLaunch = env.SOFT_LAUNCH_ENABLED === "true";
  const launchSlug = env.LAUNCH_BOOK_SLUG || "book_chapter_1";
  const eligible = softLaunch
    ? allBooks.filter((b) => b.slug === launchSlug)
    : allBooks;
  if (!eligible.length) {
    return json({ error: "No chapters available for bundle purchase yet." }, 400);
  }
  const ownedIds = await getUserBooks(env.DB, session.username);
  const toGrant = eligible.filter((b) => !ownedIds.includes(b.book_id));
  if (!toGrant.length) {
    return json({ error: "You already own every published chapter." }, 400);
  }
  const userRow = await getUserByUsername(env.DB, session.username);
  const url = new URL(request.url);
  const mobile = url.searchParams.get("mobile") === "1";
  const checkoutSession = await createBundleCheckoutSession(
    env,
    toGrant.map((b) => b.book_id),
    { username: session.username, email: userRow?.email || null },
    { mobile }
  );
  return json({ url: checkoutSession.url });
});

/**
 * Bundle confirm — returns ownership after Stripe success redirect.
 * Manual fallback for when the webhook hasn't fired yet.
 */
router.get("/api/customer/bundle/confirm", async (request, env) => {
  const session = await requireCustomer(request, env);
  const url = new URL(request.url);
  const stripeSessionId = url.searchParams.get("stripe_session");
  if (!stripeSessionId) return json({ owned: false, error: "missing_session" }, 400);
  try {
    const checkout = await retrieveCheckoutSession(env, stripeSessionId);
    if (checkout.payment_status !== "paid") {
      return json({ owned: false, payment_status: checkout.payment_status || "unknown" });
    }
    if (checkout.metadata?.bundle !== "true") {
      return json({ owned: false, error: "not_a_bundle" }, 400);
    }
    const metaUser = checkout.metadata?.username || checkout.client_reference_id;
    if (metaUser && metaUser !== session.username) {
      return json({ owned: false, error: "session_user_mismatch" }, 403);
    }
    const ids = String(checkout.metadata?.book_ids || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const bookId of ids) {
      await grantBookAccess(env.DB, session.username, bookId);
    }
    return json({ owned: true, source: "stripe_bundle_confirm", count: ids.length });
  } catch (err) {
    return json({ owned: false, error: err?.message || "confirm_failed" }, err?.status || 502);
  }
});

router.get("/api/customer/books/:slug/confirm", async (request, env, params) => {
  const session = await requireCustomer(request, env);
  const book = await getBookBySlug(env.DB, params.slug);
  if (!book) return json({ error: "Not found" }, 404);
  const ownedIds = await getUserBooks(env.DB, session.username);
  if (ownedIds.includes(book.book_id)) {
    return json({ owned: true, source: "already_owned" });
  }
  const url = new URL(request.url);
  const stripeSessionId = url.searchParams.get("stripe_session");
  if (!stripeSessionId) return json({ owned: false, error: "missing_session" }, 400);
  try {
    const checkout = await retrieveCheckoutSession(env, stripeSessionId);
    if (checkout.payment_status !== "paid") {
      return json({ owned: false, payment_status: checkout.payment_status || "unknown" });
    }
    if (checkout.metadata?.book_id !== book.book_id) {
      return json({ owned: false, error: "session_book_mismatch" }, 400);
    }
    const metaUser = checkout.metadata?.username || checkout.client_reference_id;
    if (metaUser && metaUser !== session.username) {
      return json({ owned: false, error: "session_user_mismatch" }, 403);
    }
    await grantBookAccess(env.DB, session.username, book.book_id);
    return json({ owned: true, source: "stripe_confirm" });
  } catch (err) {
    return json({ owned: false, error: err?.message || "confirm_failed" }, err?.status || 502);
  }
});

router.post("/api/stripe/webhook", async (request, env) => {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return json({ error: "Webhook not configured." }, 503);
  }
  const rawBody = await request.text();
  const signature = request.headers.get("Stripe-Signature");
  const valid = await verifyStripeSignature(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) return json({ error: "Invalid signature" }, 400);

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid payload" }, 400);
  }

  if (event.id) {
    const fresh = await recordStripeEvent(env.DB, event.id, event.type);
    if (!fresh) return json({ received: true, duplicate: true });
  }

  if (event.type === "checkout.session.completed") {
    const obj = event.data?.object || {};
    const username = obj.metadata?.username || obj.client_reference_id;
    const isBundle = obj.metadata?.bundle === "true";
    const paid = obj.payment_status === "paid";

    // Bundle purchase — grant access to every book_id in the metadata
    if (username && isBundle && paid) {
      const ids = String(obj.metadata?.book_ids || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      for (const bookId of ids) {
        try { await grantBookAccess(env.DB, username, bookId); } catch (err) {
          console.error("bundle_grant_failed", bookId, err?.message || err);
        }
      }
      // Send a single bundle receipt email
      try {
        const user = await getUserByUsername(env.DB, username);
        if (user?.email) {
          const base = env.PUBLIC_BASE_URL || "https://book.eugenemierak.com";
          const readUrl = `${base}/`;
          const cents = obj.amount_total ?? obj.amount_subtotal ?? null;
          const amountLabel = cents != null ? `€${(cents / 100).toFixed(2)}` : "€50.00";
          const { subject, html, text } = renderPurchaseReceiptEmail({
            displayName: user.display_name || user.username,
            chapterTitle: `Full book bundle — ${ids.length} chapter${ids.length === 1 ? "" : "s"}`,
            amountLabel,
            readUrl,
            baseUrl: base,
          });
          await sendEmail(env, { to: user.email, subject, html, text });
          await markEmailReminderSent(env.DB, username, "purchase_receipt", "bundle_" + ids.join("_"));
        }
      } catch (err) {
        console.error("bundle_receipt_email_failed", err?.message || err);
      }
    }

    // Single-chapter purchase (existing flow)
    const bookId = obj.metadata?.book_id;
    if (username && !isBundle && bookId && paid) {
      await grantBookAccess(env.DB, username, bookId);
      try {
        const user = await getUserByUsername(env.DB, username);
        const book = await getBookById(env.DB, bookId);
        if (user?.email && book) {
          const base = env.PUBLIC_BASE_URL || "https://book.eugenemierak.com";
          const readUrl = `${base}/library/${encodeURIComponent(book.slug)}?read=1`;
          const cents = obj.amount_total ?? obj.amount_subtotal ?? null;
          const amountLabel = cents != null ? `€${(cents / 100).toFixed(2)}` : "€11.99";
          const { subject, html, text } = renderPurchaseReceiptEmail({
            displayName: user.display_name || user.username,
            chapterTitle: book.title,
            amountLabel,
            readUrl,
            coverUrl: book.cover_path ? `${base}${book.cover_path.startsWith("/") ? "" : "/"}${book.cover_path}` : undefined,
            baseUrl: base,
          });
          await sendEmail(env, { to: user.email, subject, html, text });
          await markEmailReminderSent(env.DB, username, "purchase_receipt", book.book_id);
        }
      } catch (err) {
        console.error("purchase_receipt_email_failed", err?.message || err);
      }
    }
  }
  return json({ received: true });
});

async function authorizeStreaming(request, env, params, asset) {
  const url = new URL(request.url);
  if (await verifySignedAssetUrl(env, params.slug, asset, url)) {
    const book = await getBookBySlug(env.DB, params.slug);
    if (!book) throw { status: 404, message: "Not found" };
    return book;
  }
  const session = await requireCustomer(request, env, { allowQueryToken: true });
  const book = await getBookBySlug(env.DB, params.slug);
  if (!book) throw { status: 404, message: "Not found" };
  if (session.role === "admin") return book;
  if (!await hasBookAccess(env.DB, session.username, book.book_id)) {
    throw { status: 403, message: "Not unlocked" };
  }
  return book;
}

router.get("/api/customer/books/:slug/sign", async (request, env, params) => {
  const session = await requireCustomer(request, env);
  const url = new URL(request.url);
  const asset = url.searchParams.get("asset");
  if (!isStreamingAsset(asset)) return json({ error: "bad_asset" }, 400);
  const book = await getBookBySlug(env.DB, params.slug);
  if (!book) return json({ error: "Not found" }, 404);
  if (asset === "audio" && !book.has_audio) return json({ error: "Not found" }, 404);
  if (session.role !== "admin") {
    if (!await hasBookAccess(env.DB, session.username, book.book_id)) {
      return json({ error: "Not unlocked" }, 403);
    }
  }
  const signedUrl = await buildSignedAssetUrl(env, params.slug, asset);
  return json({ url: signedUrl, expires_in: 300 });
});

router.get("/api/customer/books/:slug/text", async (request, env, params) => {
  const book = await authorizeStreaming(request, env, params, "text");
  const obj = await env.ASSETS.get(`books/${book.book_id}/text.txt`);
  if (!obj) return json({ error: "Text not found" }, 404);
  return new Response(obj.body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
});

router.get("/api/customer/books/:slug/audio", async (request, env, params) => {
  const book = await authorizeStreaming(request, env, params, "audio");
  if (!book.has_audio) return json({ error: "Not found" }, 404);
  const key = `books/${book.book_id}/audio.mp3`;

  // HTTP Range support — required for the browser's native audio seek to
  // work. Without it, setting currentTime on the <audio> element fails
  // because the browser can't fetch the specific byte range it needs.
  const range = request.headers.get("range") || request.headers.get("Range");
  const baseHeaders = {
    "Content-Type": "audio/mpeg",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=86400",
  };

  if (range) {
    // Parse "bytes=START-END" (END optional)
    const m = /bytes=(\d*)-(\d*)/i.exec(range);
    if (m) {
      // Need the full size first to bound the range correctly
      const head = await env.ASSETS.head(key);
      if (!head) return json({ error: "Audio not found" }, 404);
      const total = head.size;
      let start = m[1] === "" ? 0 : parseInt(m[1], 10);
      let end = m[2] === "" ? total - 1 : parseInt(m[2], 10);
      if (isNaN(start) || isNaN(end) || start >= total || start < 0 || end >= total || end < start) {
        return new Response(null, {
          status: 416,
          headers: { ...baseHeaders, "Content-Range": `bytes */${total}` },
        });
      }
      const partial = await env.ASSETS.get(key, { range: { offset: start, length: end - start + 1 } });
      if (!partial) return json({ error: "Audio not found" }, 404);
      return new Response(partial.body, {
        status: 206,
        headers: {
          ...baseHeaders,
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Content-Length": String(end - start + 1),
        },
      });
    }
  }

  const obj = await env.ASSETS.get(key);
  if (!obj) return json({ error: "Audio not found" }, 404);
  return new Response(obj.body, {
    headers: { ...baseHeaders, "Content-Length": String(obj.size) },
  });
});

router.get("/api/customer/books/:slug/pdf", async (request, env, params) => {
  const book = await authorizeStreaming(request, env, params, "pdf");
  const obj = await env.ASSETS.get(`books/${book.book_id}/source.pdf`);
  if (!obj) return json({ error: "PDF not found" }, 404);
  return new Response(obj.body, {
    headers: { "Content-Type": "application/pdf", "Cache-Control": "public, max-age=86400" },
  });
});

router.get("/api/customer/books/:slug/slides", async (request, env, params) => {
  const book = await authorizeStreaming(request, env, params, "slides");
  const obj = await env.ASSETS.get(`books/${book.book_id}/slides.pdf`);
  if (!obj) return json({ error: "No slides available" }, 404);
  return new Response(obj.body, {
    headers: { "Content-Type": "application/pdf", "Cache-Control": "public, max-age=86400" },
  });
});

router.get("/api/admin/books", async (request, env) => {
  await requireAdmin(request, env);
  const books = await getAllBooks(env.DB);
  return json(books);
});

router.post("/api/admin/backup", async (request, env) => {
  await requireAdmin(request, env);
  const result = await runD1Backup(env);
  return json({ ok: true, ...result });
});

router.get("/api/admin/users", async (request, env) => {
  await requireAdmin(request, env);
  const users = await listUsers(env.DB);
  const result = [];
  for (const u of users) {
    const bookIds = await getUserBooks(env.DB, u.username);
    result.push({ ...u, role: "customer", book_ids: bookIds });
  }
  return json(result);
});

router.post("/api/admin/users/:username/grants/:bookId", async (request, env, params) => {
  await requireAdmin(request, env);
  await grantBookAccess(env.DB, params.username, params.bookId);
  const user = await getUserByUsername(env.DB, params.username);
  const bookIds = await getUserBooks(env.DB, params.username);
  return json({ ...user, role: "customer", book_ids: bookIds });
});

router.delete("/api/admin/users/:username/grants/:bookId", async (request, env, params) => {
  await requireAdmin(request, env);
  await revokeBookAccess(env.DB, params.username, params.bookId);
  const user = await getUserByUsername(env.DB, params.username);
  const bookIds = await getUserBooks(env.DB, params.username);
  return json({ ...user, role: "customer", book_ids: bookIds });
});

router.post("/api/admin/books/:bookId/publish", async (request, env, params) => {
  await requireAdmin(request, env);
  const book = await getBookById(env.DB, params.bookId);
  if (!book) return json({ error: "Not found" }, 404);
  const now = new Date().toISOString();
  await env.DB.prepare(`UPDATE books SET published = 1, published_at = ? WHERE book_id = ?`).bind(now, params.bookId).run();
  return json({ ...book, published: 1, published_at: now });
});

router.post("/api/admin/books/:bookId/unpublish", async (request, env, params) => {
  await requireAdmin(request, env);
  await env.DB.prepare(`UPDATE books SET published = 0, published_at = NULL WHERE book_id = ?`).bind(params.bookId).run();
  const book = await getBookById(env.DB, params.bookId);
  return json(book);
});

router.patch("/api/admin/books/:bookId/public-profile", async (request, env, params) => {
  await requireAdmin(request, env);
  const body = await request.json();
  const book = await getBookById(env.DB, params.bookId);
  if (!book) return json({ error: "Not found" }, 404);
  if (body.featured) {
    await env.DB.prepare(`UPDATE books SET featured = 0`).run();
  }
  await env.DB.prepare(`
    UPDATE books SET hook = ?, summary = ?, price_label = ?, cta_label = ?, featured = ? WHERE book_id = ?
  `).bind(
    body.hook ?? book.hook,
    body.summary ?? book.summary,
    body.price_label ?? book.price_label,
    body.cta_label ?? book.cta_label,
    body.featured ? 1 : 0,
    params.bookId
  ).run();
  return json(await getBookById(env.DB, params.bookId));
});

router.get("/api/meta", async (request, env) => {
  const allBooks = await getAllBooks(env.DB);
  const published = allBooks.filter((b) => b.published);
  const users = await listUsers(env.DB);
  return json({
    app_name: "BookVoice Library",
    public_base_url: env.PUBLIC_BASE_URL || "",
    soft_launch_enabled: env.SOFT_LAUNCH_ENABLED === "true",
    launch_book_slug: env.LAUNCH_BOOK_SLUG || "book_chapter_1",
    books_count: allBooks.length,
    published_books_count: published.length,
    customer_users_count: users.length,
  });
});

router.get("/api/admin/published-assets", async (request, env) => {
  await requireAdmin(request, env);
  const books = await getAllBooks(env.DB);
  const report = books.filter((b) => b.published).map((b) => ({
    book_id: b.book_id,
    slug: b.slug,
    title: b.title,
    published: true,
    published_audio_available: !!b.has_audio,
    source_pdf_available: true,
    slides_available: !!b.has_slides,
    core_reader_ready: true,
    immersive_reader_ready: !!b.has_audio && !!b.has_slides,
    missing_assets: [
      ...(!b.has_audio ? ["audio"] : []),
      ...(!b.has_slides ? ["slides"] : []),
    ],
  }));
  return json(report);
});

// ───── Password reset ─────

router.post("/api/auth/password/forgot", async (request, env) => {
  const body = await request.json().catch(() => ({}));
  const emailOrUsername = (body?.identifier || body?.email || "").trim().toLowerCase();
  const ip = clientIp(request);
  if (!emailOrUsername) return json({ ok: true });

  const ipCount = await countRecentAttemptsByIp(env.DB, `pwreset:${ip}`, 60 * 1000);
  if (ipCount >= 5) {
    await logAuthEvent(env.DB, "password_reset_rate_limited", { ip, username: emailOrUsername });
    return json({ ok: true });
  }
  await recordLoginAttempt(env.DB, `pwreset:${ip}`, `pwreset:${ip}`, false);

  let user = await getUserByEmail(env.DB, emailOrUsername);
  if (!user) user = await getUserByUsername(env.DB, emailOrUsername);

  // Do email dispatch AFTER returning response to avoid timing oracles (enumeration).
  // Response time is constant regardless of whether user exists.
  if (user && user.email) {
    const token = randomToken();
    await createPasswordResetToken(env.DB, token, user.username, 3600);
    const base = env.PUBLIC_BASE_URL || "https://book.eugenemierak.com";
    const url = `${base}/reset-password?token=${encodeURIComponent(token)}`;
    const { text, html } = renderPasswordResetEmail(user.display_name, url);
    sendEmail(env, { to: user.email, subject: "Reset your BookVoice password", text, html })
      .then(() => logAuthEvent(env.DB, "password_reset_request", { username: user.username, ip, result: "sent" }).catch(() => {}))
      .catch((err) => logAuthEvent(env.DB, "password_reset_request", { username: user.username, ip, result: "email_failed", metadata: { err: String(err?.message || err).slice(0, 200) } }).catch(() => {}));
  } else {
    await logAuthEvent(env.DB, "password_reset_request", { ip, username: emailOrUsername, result: "no_user" });
  }
  return json({ ok: true });
});

router.post("/api/auth/password/reset", async (request, env) => {
  const body = await request.json().catch(() => ({}));
  const token = (body?.token || "").trim();
  const newPassword = body?.password || "";
  const ip = clientIp(request);
  if (!token || newPassword.length < 8) {
    return json({ error: "invalid_request" }, 400);
  }
  const username = await consumePasswordResetToken(env.DB, token);
  if (!username) {
    await logAuthEvent(env.DB, "password_reset_fail", { ip, result: "invalid_token" });
    return json({ error: "invalid_or_expired_token" }, 400);
  }
  try {
    const hash = await pbkdf2Hash(newPassword);
    await updateUserPasswordHash(env.DB, username, hash);
    await invalidateUserSessions(env.DB, username);
    await logAuthEvent(env.DB, "password_reset_success", { username, ip });
    return json({ ok: true });
  } catch (err) {
    return json({ error: "reset_failed" }, 500);
  }
});

// ───── Email verification ─────

router.post("/api/auth/email/resend", async (request, env) => {
  const session = await requireCustomer(request, env);
  const user = await getUserByUsername(env.DB, session.username);
  if (!user || !user.email) return json({ error: "no_email" }, 400);
  if (user.email_verified_at) return json({ ok: true, already_verified: true });

  const token = randomToken();
  await createEmailVerificationToken(env.DB, token, user.username, 86400);
  const base = env.PUBLIC_BASE_URL || "https://book.eugenemierak.com";
  const url = `${base}/api/auth/email/verify?token=${encodeURIComponent(token)}`;
  const { text, html } = renderEmailVerificationEmail(user.display_name, url);
  try {
    await sendEmail(env, { to: user.email, subject: "Verify your BookVoice email", text, html });
    await logAuthEvent(env.DB, "email_verify_request", { username: user.username, ip: clientIp(request) });
    return json({ ok: true });
  } catch (err) {
    return json({ error: "email_failed" }, 502);
  }
});

router.get("/api/auth/email/verify", async (request, env) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const base = env.PUBLIC_BASE_URL || "https://book.eugenemierak.com";
  if (!token) return Response.redirect(`${base}/?verified=invalid`, 302);
  const result = await consumeEmailVerificationToken(env.DB, token);
  if (result.state === "ok") {
    try {
      await markUserEmailVerified(env.DB, result.username);
      await logAuthEvent(env.DB, "email_verified", { username: result.username, ip: clientIp(request) });
    } catch {}
    return Response.redirect(`${base}/?verified=1`, 302);
  }
  if (result.state === "already_used") {
    return Response.redirect(`${base}/?verified=already`, 302);
  }
  return Response.redirect(`${base}/?verified=invalid`, 302);
});

// ───── Session revocation (admin) ─────

router.post("/api/admin/users/:username/revoke-sessions", async (request, env, params) => {
  await requireAdmin(request, env);
  const changes = await invalidateUserSessions(env.DB, params.username);
  await logAuthEvent(env.DB, "admin_revoke_sessions", {
    username: params.username,
    ip: clientIp(request),
    result: changes > 0 ? "revoked" : "user_not_found",
  });
  return json({ ok: changes > 0, revoked_count: changes });
});

// ───── Audit trail ─────

router.get("/api/admin/auth-events", async (request, env) => {
  await requireAdmin(request, env);
  const url = new URL(request.url);
  // Clamp to [1, 500] to prevent DoS via ?limit=999999999
  const raw = parseInt(url.searchParams.get("limit") || "100", 10) || 100;
  const limit = Math.min(Math.max(raw, 1), 500);
  const events = await listRecentAuthEvents(env.DB, limit);
  return json(events);
});

// ───── Analytics ─────

const ANALYTICS_IP_BUCKETS = new Map();
const ANALYTICS_IP_HARD_CAP = 10000;
function analyticsIpAllowed(ip) {
  if (!ip) return true;
  const now = Date.now();
  const windowMs = 10 * 1000;
  const maxPerWindow = 20;
  const entry = ANALYTICS_IP_BUCKETS.get(ip) || { count: 0, resetAt: now + windowMs };
  if (now >= entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }
  entry.count += 1;
  ANALYTICS_IP_BUCKETS.set(ip, entry);
  // Soft prune: remove expired entries when the map gets moderately large
  if (ANALYTICS_IP_BUCKETS.size > 500) {
    for (const [k, v] of ANALYTICS_IP_BUCKETS) if (now >= v.resetAt) ANALYTICS_IP_BUCKETS.delete(k);
  }
  // Hard cap: if all entries are fresh and someone is flooding from many IPs,
  // evict the oldest half (insertion order) to bound memory usage.
  if (ANALYTICS_IP_BUCKETS.size > ANALYTICS_IP_HARD_CAP) {
    const toRemove = ANALYTICS_IP_BUCKETS.size - Math.floor(ANALYTICS_IP_HARD_CAP / 2);
    const iter = ANALYTICS_IP_BUCKETS.keys();
    for (let i = 0; i < toRemove; i++) {
      const k = iter.next().value;
      if (k === undefined) break;
      ANALYTICS_IP_BUCKETS.delete(k);
    }
  }
  return entry.count <= maxPerWindow;
}

router.post("/api/analytics/track", async (request, env) => {
  const ip = clientIp(request);
  if (!analyticsIpAllowed(ip)) return json({ ok: false, rate_limited: true }, 204);
  let body = {};
  try { body = await request.json(); } catch {}
  const eventType = (body?.event_type || body?.event || "").toString();
  if (!isAllowedAnalyticsEvent(eventType)) return json({ ok: false, reason: "invalid_event" }, 400);
  const session = await getSession(request, env).catch(() => null);
  const username = session?.authenticated ? session.username : null;
  await recordAnalyticsEvent(env.DB, {
    eventType,
    slug: body?.slug,
    username,
    sessionId: (body?.session_id || "").toString() || null,
    platform: (body?.platform || "").toString() || null,
    metadata: body?.metadata || undefined,
  });
  if (eventType === "reader_opened" && username && body?.slug) {
    try {
      const book = await getBookBySlug(env.DB, body.slug);
      if (book) await recordReaderOpen(env.DB, username, book.book_id);
    } catch {}
  }
  return json({ ok: true });
});

router.get("/api/admin/analytics/funnel", async (request, env) => {
  await requireAdmin(request, env);
  const url = new URL(request.url);
  const windowParam = (url.searchParams.get("window") || "7d").toLowerCase();
  const days = windowParam.endsWith("d") ? parseInt(windowParam, 10) || 7 : 7;
  const clampedDays = Math.min(Math.max(days, 1), 90);
  const windowMs = clampedDays * 24 * 3600 * 1000;
  const [hits, sessions] = await Promise.all([
    queryFunnelCounts(env.DB, windowMs),
    queryFunnelBySessionCounts(env.DB, windowMs),
  ]);
  try { await pruneOldAnalyticsEvents(env.DB, 90); } catch {}
  const steps = [
    "view_catalog",
    "view_book",
    "click_buy",
    "checkout_start",
    "purchase_success",
    "reader_opened",
  ];
  return json({
    window_days: clampedDays,
    steps: steps.map((s) => ({ event: s, hits: hits[s] || 0, sessions: sessions[s] || 0 })),
  });
});

// ───── Admin 2FA (TOTP) stub ─────
// Full TOTP flow needs base32 secret + otpauth URI + QR render.
// Persisting the foundation so Eugene/Zak can add an authenticator when ready.

router.get("/api/admin/2fa/status", async (request, env) => {
  const session = await requireAdmin(request, env);
  const row = await getAdminTotp(env.DB, session.username);
  return json({
    configured: !!row,
    confirmed: !!(row && row.confirmed_at),
  });
});

router.post("/api/admin/2fa/init", async (request, env) => {
  const session = await requireAdmin(request, env);
  const existing = await getAdminTotp(env.DB, session.username);
  if (existing && existing.confirmed_at) {
    return json({ error: "already_enabled" }, 400);
  }
  const secret = generateTotpSecret();
  await saveAdminTotp(env.DB, session.username, secret);
  const uri = buildOtpauthUri(secret, session.username);
  await logAuthEvent(env.DB, "admin_2fa_init", { username: session.username, ip: clientIp(request) });
  return json({
    secret,
    secret_display: formatSecretForDisplay(secret),
    otpauth_uri: uri,
  });
});

router.post("/api/admin/2fa/confirm", async (request, env) => {
  const session = await requireAdmin(request, env);
  const body = await request.json().catch(() => ({}));
  const code = (body?.code || "").toString();
  const row = await getAdminTotp(env.DB, session.username);
  if (!row) return json({ error: "not_initialized" }, 400);
  if (row.confirmed_at) return json({ error: "already_enabled" }, 400);
  const ok = await verifyTotpCode(row.secret, code);
  if (!ok) {
    await logAuthEvent(env.DB, "admin_2fa_confirm_fail", { username: session.username, ip: clientIp(request) });
    return json({ error: "invalid_code" }, 400);
  }
  await confirmAdminTotp(env.DB, session.username);
  await logAuthEvent(env.DB, "admin_2fa_enabled", { username: session.username, ip: clientIp(request) });
  return json({ ok: true });
});

router.post("/api/admin/2fa/disable", async (request, env) => {
  const session = await requireAdmin(request, env);
  const body = await request.json().catch(() => ({}));
  const code = (body?.code || "").toString();
  const row = await getAdminTotp(env.DB, session.username);
  if (!row || !row.confirmed_at) return json({ error: "not_enabled" }, 400);
  const ok = await verifyTotpCode(row.secret, code);
  if (!ok) {
    await logAuthEvent(env.DB, "admin_2fa_disable_fail", { username: session.username, ip: clientIp(request) });
    return json({ error: "invalid_code" }, 400);
  }
  await deleteAdminTotp(env.DB, session.username);
  await logAuthEvent(env.DB, "admin_2fa_disabled", { username: session.username, ip: clientIp(request) });
  return json({ ok: true });
});
