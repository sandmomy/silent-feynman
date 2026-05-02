export const COOKIE_NAME = "bookvoice_session";

export function sha256Hex(text) {
  const encoder = new TextEncoder();
  return crypto.subtle.digest("SHA-256", encoder.encode(text)).then(
    (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("")
  );
}

export async function hmacSign(secret, payload) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export async function hmacVerify(secret, payload, signature) {
  const expected = await hmacSign(secret, payload);
  return constantTimeEqual(expected, signature);
}

export async function hashPassword(password) {
  return sha256Hex(password);
}

const PBKDF2_ITERATIONS = 100000;

function bytesToB64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export async function pbkdf2Hash(password, saltBytes, iterations = PBKDF2_ITERATIONS) {
  const salt = saltBytes || crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const hash = new Uint8Array(bits);
  return `pbkdf2$${iterations}$${bytesToB64(salt)}$${bytesToB64(hash)}`;
}

export async function verifyPassword(password, stored) {
  if (!stored || typeof stored !== "string") return { ok: false, needsRehash: false };
  if (stored.startsWith("google_oauth:")) return { ok: false, needsRehash: false };
  if (stored.startsWith("pbkdf2$")) {
    const parts = stored.split("$");
    if (parts.length !== 4) return { ok: false, needsRehash: false };
    const iter = parseInt(parts[1], 10);
    if (!Number.isFinite(iter) || iter <= 0) return { ok: false, needsRehash: false };
    let saltBytes, expected;
    try {
      saltBytes = b64ToBytes(parts[2]);
      expected = parts[3];
    } catch {
      return { ok: false, needsRehash: false };
    }
    const candidate = await pbkdf2Hash(password, saltBytes, iter);
    const candidateHash = candidate.split("$")[3];
    if (!constantTimeEqual(candidateHash, expected)) return { ok: false, needsRehash: false };
    return { ok: true, needsRehash: iter < PBKDF2_ITERATIONS };
  }
  const legacy = await sha256Hex(password);
  if (!constantTimeEqual(legacy, stored)) return { ok: false, needsRehash: false };
  return { ok: true, needsRehash: true };
}

export async function buildSessionToken(username, role, secret, sessionHours = 24) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + Math.max(1, sessionHours) * 3600;
  const jti = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  const payload = `${username}:${role}:${issuedAt}:${expiresAt}:${jti}`;
  const signature = await hmacSign(secret, payload);
  const token = `${payload}:${signature}`;
  return btoa(token);
}

export async function verifySessionToken(token, env) {
  if (!token) return null;
  let decoded;
  try {
    decoded = atob(token);
  } catch {
    return null;
  }
  const parts = decoded.split(":");
  let username, role, iatRaw, expiresRaw, jti, signature, payload;
  if (parts.length === 4) {
    // Legacy token pre-jti
    [username, role, expiresRaw, signature] = parts;
    iatRaw = "0";
    jti = null;
    payload = `${username}:${role}:${expiresRaw}`;
  } else if (parts.length === 5) {
    // Legacy token with jti but no iat
    [username, role, expiresRaw, jti, signature] = parts;
    iatRaw = "0";
    payload = `${username}:${role}:${expiresRaw}:${jti}`;
  } else if (parts.length === 6) {
    // Current token with iat
    [username, role, iatRaw, expiresRaw, jti, signature] = parts;
    payload = `${username}:${role}:${iatRaw}:${expiresRaw}:${jti}`;
  } else {
    return null;
  }
  const expiresAt = parseInt(expiresRaw, 10);
  const issuedAt = parseInt(iatRaw, 10) || 0;
  if (!env.SESSION_SECRET) return null;
  const valid = await hmacVerify(env.SESSION_SECRET, payload, signature);
  if (!valid) return null;
  if (expiresAt < Math.floor(Date.now() / 1000)) return null;
  if (jti && env.DB) {
    try {
      const row = await env.DB.prepare(`SELECT 1 FROM revoked_sessions WHERE jti = ?`).bind(jti).first();
      if (row) return null;
    } catch {}
  }
  if (env.DB && role === "customer") {
    try {
      const row = await env.DB.prepare(`SELECT sessions_valid_after FROM users WHERE username = ?`).bind(username).first();
      const cutoff = row?.sessions_valid_after ?? 0;
      if (cutoff > 0 && issuedAt < cutoff) return null;
    } catch {}
  }
  return { authenticated: true, username, role, jti, expiresAt, issuedAt };
}

function extractBearerToken(request) {
  const header = request.headers.get("Authorization") || request.headers.get("authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function extractQueryToken(request) {
  try {
    const url = new URL(request.url);
    return url.searchParams.get("mobile_token");
  } catch {
    return null;
  }
}

function extractCookieToken(request) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

export async function getSession(request, env, options = {}) {
  const token =
    extractCookieToken(request) ||
    extractBearerToken(request) ||
    (options.allowQueryToken ? extractQueryToken(request) : null);
  return verifySessionToken(token, env);
}

export function setAuthCookie(headers, token, env, sessionHours = 24) {
  const secure = env.COOKIE_SECURE === "true";
  const maxAge = Math.max(1, sessionHours) * 3600;
  headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Lax; Path=/; Max-Age=${maxAge}`
  );
}

export function clearAuthCookie(headers, env) {
  const secure = env.COOKIE_SECURE === "true";
  headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Lax; Path=/; Max-Age=0`
  );
}
