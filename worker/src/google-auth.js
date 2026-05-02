import { hmacSign, hmacVerify, buildSessionToken, setAuthCookie } from "./auth.js";
import {
  getUserByEmail,
  createUser,
  nextAvailableUsername,
  storeGoogleNonce,
  consumeGoogleNonce,
} from "./db.js";
import { verifyGoogleIdToken } from "./google-jwks.js";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const STATE_COOKIE = "bookvoice_oauth_state";
const STATE_TTL_SECONDS = 600;

function slugify(text) {
  return (text || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 80) || "reader";
}

function getRedirectUri(env) {
  const base = env.PUBLIC_BASE_URL || "https://book.eugenemierak.com";
  return `${base}/api/auth/google/callback`;
}

function getStateSecret(env) {
  if (!env.SESSION_SECRET) throw { status: 500, message: "server_misconfigured" };
  return env.SESSION_SECRET;
}

async function buildSignedState(env) {
  const nonce = crypto.randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS;
  const payload = `${nonce}:${expiresAt}`;
  const sig = await hmacSign(getStateSecret(env), payload);
  return btoa(`${payload}:${sig}`);
}

async function verifySignedState(token, env) {
  let decoded;
  try {
    decoded = atob(token);
  } catch {
    return false;
  }
  const parts = decoded.split(":");
  if (parts.length !== 3) return false;
  const [nonce, expiresRaw, sig] = parts;
  const expiresAt = parseInt(expiresRaw, 10);
  if (!expiresAt || expiresAt < Math.floor(Date.now() / 1000)) return false;
  return hmacVerify(getStateSecret(env), `${nonce}:${expiresAt}`, sig);
}

function setStateCookie(headers, token, env) {
  const secure = env.COOKIE_SECURE === "true";
  headers.append(
    "Set-Cookie",
    `${STATE_COOKIE}=${token}; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Lax; Path=/api/auth/google; Max-Age=${STATE_TTL_SECONDS}`
  );
}

function clearStateCookie(headers, env) {
  const secure = env.COOKIE_SECURE === "true";
  headers.append(
    "Set-Cookie",
    `${STATE_COOKIE}=; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Lax; Path=/api/auth/google; Max-Age=0`
  );
}

function readStateCookie(request) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(new RegExp(`${STATE_COOKIE}=([^;]+)`));
  return match ? match[1] : null;
}

function decodeIdTokenPayload(idToken) {
  if (!idToken || typeof idToken !== "string") return null;
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function failureRedirect(env, reason) {
  const home = env.PUBLIC_BASE_URL || "/";
  const target = new URL(home);
  target.searchParams.set("auth_error", reason);
  const headers = new Headers({ Location: target.toString() });
  clearStateCookie(headers, env);
  return new Response(null, { status: 302, headers });
}

export async function googleAuthStart(request, env) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return new Response(JSON.stringify({ error: "Google sign-in is not configured." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
  const state = await buildSignedState(env);
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: getRedirectUri(env),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  const headers = new Headers({ Location: `${GOOGLE_AUTH_URL}?${params.toString()}` });
  setStateCookie(headers, state, env);
  return new Response(null, { status: 302, headers });
}

export async function googleMobileNonceIssue(request, env) {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const nonce = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const expiresAt = await storeGoogleNonce(env.DB, nonce, 600);
  return new Response(JSON.stringify({ nonce, expires_at: expiresAt }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function googleMobileSignIn(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const idToken = body?.id_token;
  if (!idToken || typeof idToken !== "string") {
    return new Response(JSON.stringify({ error: "missing_id_token" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const clientNonce = body?.nonce;

  const allowedAudiences = [
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_MOBILE_CLIENT_ID_ANDROID,
    env.GOOGLE_MOBILE_CLIENT_ID_IOS,
    env.GOOGLE_MOBILE_CLIENT_ID_WEB,
  ].filter(Boolean);
  if (allowedAudiences.length === 0) {
    return new Response(JSON.stringify({ error: "server_misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let profile;
  try {
    profile = await verifyGoogleIdToken(idToken);
  } catch (err) {
    const code = err?.message || "id_token_invalid";
    const status = code === "token_expired" ? 401 : code === "bad_signature" ? 401 : 401;
    return new Response(JSON.stringify({ error: code }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!allowedAudiences.includes(profile.aud)) {
    return new Response(JSON.stringify({ error: "audience_mismatch" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (clientNonce) {
    if (profile.nonce !== clientNonce) {
      return new Response(JSON.stringify({ error: "nonce_mismatch" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const consumed = await consumeGoogleNonce(env.DB, clientNonce);
    if (!consumed) {
      return new Response(JSON.stringify({ error: "nonce_invalid_or_reused" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
  const emailVerified = profile.email_verified;
  if (emailVerified !== true && emailVerified !== "true") {
    return new Response(JSON.stringify({ error: "email_unverified" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const email = (profile.email || "").trim().toLowerCase();
  if (!email) {
    return new Response(JSON.stringify({ error: "no_email" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let user = await getUserByEmail(env.DB, email);
  if (!user) {
    const baseUsername = slugify(email.split("@")[0]) || slugify(profile.name);
    const username = await nextAvailableUsername(env.DB, baseUsername);
    await createUser(env.DB, {
      username,
      display_name: (profile.name || "").trim() || username,
      email,
      password_hash: `google_oauth:${profile.sub || crypto.randomUUID()}`,
      created_at: new Date().toISOString(),
    });
    user = await getUserByEmail(env.DB, email);
  }
  if (!user) {
    return new Response(JSON.stringify({ error: "user_create_failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!env.SESSION_SECRET) {
    return new Response(JSON.stringify({ error: "server_misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  const token = await buildSessionToken(user.username, "customer", env.SESSION_SECRET, 24 * 30);
  return new Response(JSON.stringify({ token, email, name: user.display_name || user.username }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function googleAuthCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) return failureRedirect(env, errorParam);
  if (!code || !state) return failureRedirect(env, "missing_params");

  const cookieState = readStateCookie(request);
  if (!cookieState || cookieState !== state) return failureRedirect(env, "state_mismatch");
  if (!(await verifySignedState(state, env))) return failureRedirect(env, "state_invalid");

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: getRedirectUri(env),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return failureRedirect(env, "token_exchange_failed");
  const tokenJson = await tokenRes.json();

  let profile = decodeIdTokenPayload(tokenJson.id_token);
  if (!profile) {
    const accessToken = tokenJson.access_token;
    if (!accessToken) return failureRedirect(env, "no_access_token");
    const userRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userRes.ok) return failureRedirect(env, "userinfo_failed");
    profile = await userRes.json();
  }

  const email = (profile.email || "").trim().toLowerCase();
  if (!email) return failureRedirect(env, "no_email");
  if (profile.email_verified === false) return failureRedirect(env, "email_unverified");

  let user = await getUserByEmail(env.DB, email);
  if (!user) {
    const baseUsername = slugify(email.split("@")[0]) || slugify(profile.name);
    const username = await nextAvailableUsername(env.DB, baseUsername);
    await createUser(env.DB, {
      username,
      display_name: (profile.name || "").trim() || username,
      email,
      password_hash: `google_oauth:${profile.sub || crypto.randomUUID()}`,
      created_at: new Date().toISOString(),
    });
    user = await getUserByEmail(env.DB, email);
  }
  if (!user) return failureRedirect(env, "user_create_failed");

  if (!env.SESSION_SECRET) return failureRedirect(env, "server_misconfigured");
  const token = await buildSessionToken(user.username, "customer", env.SESSION_SECRET);
  const home = env.PUBLIC_BASE_URL || "/";
  const target = new URL(home);
  target.searchParams.set("welcome", "google");
  const headers = new Headers({ Location: target.toString() });
  setAuthCookie(headers, token, env);
  clearStateCookie(headers, env);
  return new Response(null, { status: 302, headers });
}
