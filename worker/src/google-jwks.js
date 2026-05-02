const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const JWKS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

let cachedKeys = null;
let cachedAt = 0;

async function fetchGoogleJwks() {
  const now = Date.now();
  if (cachedKeys && now - cachedAt < JWKS_CACHE_TTL_MS) return cachedKeys;
  const res = await fetch(JWKS_URL, { cf: { cacheTtl: 21600, cacheEverything: true } });
  if (!res.ok) throw new Error(`jwks_fetch_${res.status}`);
  const body = await res.json();
  if (!body?.keys || !Array.isArray(body.keys)) throw new Error("jwks_malformed");
  cachedKeys = body.keys;
  cachedAt = now;
  return cachedKeys;
}

function b64urlToBytes(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlToJson(b64url) {
  const bytes = b64urlToBytes(b64url);
  const str = new TextDecoder().decode(bytes);
  return JSON.parse(str);
}

export async function verifyGoogleIdToken(idToken) {
  if (!idToken || typeof idToken !== "string") throw new Error("missing_id_token");
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("malformed_token");
  const [headerB64, payloadB64, sigB64] = parts;
  let header;
  try {
    header = b64urlToJson(headerB64);
  } catch {
    throw new Error("bad_header");
  }
  if (header.alg !== "RS256") throw new Error("unsupported_alg");
  if (!header.kid) throw new Error("missing_kid");

  const keys = await fetchGoogleJwks();
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    cachedKeys = null;
    const refreshed = await fetchGoogleJwks();
    jwk = refreshed.find((k) => k.kid === header.kid);
    if (!jwk) throw new Error("unknown_kid");
  }

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    { ...jwk, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const signed = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = b64urlToBytes(sigB64);
  const valid = await crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5" },
    publicKey,
    signature,
    signed
  );
  if (!valid) throw new Error("bad_signature");

  let payload;
  try {
    payload = b64urlToJson(payloadB64);
  } catch {
    throw new Error("bad_payload");
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp <= now) throw new Error("token_expired");
  if (typeof payload.iat === "number" && payload.iat > now + 60) throw new Error("token_iat_future");
  if (payload.iss !== "https://accounts.google.com" && payload.iss !== "accounts.google.com") {
    throw new Error("issuer_mismatch");
  }
  return payload;
}
