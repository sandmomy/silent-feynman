import { hmacSign, hmacVerify } from "./auth.js";

const STREAMING_ASSETS = ["audio", "pdf", "text", "slides"];
export const DEFAULT_TTL_SECONDS = 300;

export function isStreamingAsset(asset) {
  return STREAMING_ASSETS.includes(asset);
}

export async function buildSignedAssetUrl(env, slug, asset, ttlSeconds = DEFAULT_TTL_SECONDS) {
  if (!env.SESSION_SECRET) throw { status: 500, message: "server_misconfigured" };
  if (!isStreamingAsset(asset)) throw { status: 400, message: "bad_asset" };
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${slug}:${asset}:${exp}`;
  const sig = await hmacSign(env.SESSION_SECRET, payload);
  const base = env.PUBLIC_BASE_URL || "https://book.eugenemierak.com";
  return `${base}/api/customer/books/${encodeURIComponent(slug)}/${asset}?exp=${exp}&sig=${sig}`;
}

export async function verifySignedAssetUrl(env, slug, asset, url) {
  if (!env.SESSION_SECRET) return false;
  if (!isStreamingAsset(asset)) return false;
  const exp = parseInt(url.searchParams.get("exp") || "0", 10);
  const sig = url.searchParams.get("sig");
  if (!exp || !sig) return false;
  if (exp < Math.floor(Date.now() / 1000)) return false;
  const payload = `${slug}:${asset}:${exp}`;
  return hmacVerify(env.SESSION_SECRET, payload, sig);
}
