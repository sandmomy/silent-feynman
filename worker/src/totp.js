// TOTP (RFC 6238) implementation for admin 2FA.
// Uses HMAC-SHA1, 30s step, 6-digit codes. Compatible with Google Authenticator,
// Authy, 1Password, Bitwarden, Microsoft Authenticator.

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateTotpSecret(bytes = 20) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return base32Encode(arr);
}

export function base32Encode(bytes) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(input) {
  const normalized = input.replace(/[\s-]+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out = [];
  for (let i = 0; i < normalized.length; i += 1) {
    const idx = BASE32.indexOf(normalized[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

async function hmacSha1(keyBytes, msgBytes) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, msgBytes);
  return new Uint8Array(sig);
}

export async function totpCodeAt(secretBase32, timeSeconds, step = 30, digits = 6) {
  const keyBytes = base32Decode(secretBase32);
  const counter = Math.floor(timeSeconds / step);
  const msg = new Uint8Array(8);
  for (let i = 7; i >= 0; i -= 1) {
    msg[i] = counter & 0xff;
    // Using Math.floor and division instead of bit shifting for large numbers
    // (JS bitwise is 32-bit but counter fits in 32-bit until year 2106)
  }
  let c = counter;
  for (let i = 7; i >= 0; i -= 1) {
    msg[i] = c & 0xff;
    c = Math.floor(c / 256);
  }
  const hash = await hmacSha1(keyBytes, msg);
  const offset = hash[hash.length - 1] & 0x0f;
  const binCode =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);
  const mod = 10 ** digits;
  return String(binCode % mod).padStart(digits, "0");
}

export async function verifyTotpCode(secretBase32, code, window = 1, nowSeconds = null) {
  if (!code || typeof code !== "string") return false;
  const cleaned = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;
  const now = nowSeconds ?? Math.floor(Date.now() / 1000);
  for (let offset = -window; offset <= window; offset += 1) {
    const expected = await totpCodeAt(secretBase32, now + offset * 30);
    if (constantTimeStringEqual(expected, cleaned)) return true;
  }
  return false;
}

function constantTimeStringEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export function buildOtpauthUri(secretBase32, accountName, issuer = "BookVoice") {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}`;
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

export function formatSecretForDisplay(secret) {
  return secret.match(/.{1,4}/g)?.join(" ") || secret;
}
