const RATE_LIMIT_STORE = globalThis.__fvRateLimitStore || new Map();

if (!globalThis.__fvRateLimitStore) {
  globalThis.__fvRateLimitStore = RATE_LIMIT_STORE;
}

function toFirstHeaderValue(value) {
  if (!value) {
    return "";
  }

  if (Array.isArray(value)) {
    return String(value[0] || "").trim();
  }

  return String(value)
    .split(",")[0]
    .trim();
}

function normalizeOrigin(value) {
  if (!value) {
    return "";
  }

  try {
    return new URL(value).origin;
  } catch (error) {
    return "";
  }
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function pruneStore(now) {
  if (RATE_LIMIT_STORE.size < 2048) {
    return;
  }

  for (const [key, entry] of RATE_LIMIT_STORE.entries()) {
    if (!entry || entry.resetAt <= now) {
      RATE_LIMIT_STORE.delete(key);
    }
  }
}

export function getClientIp(request) {
  const forwardedFor = toFirstHeaderValue(request.headers["x-forwarded-for"]);
  if (forwardedFor) {
    return forwardedFor;
  }

  const realIp = toFirstHeaderValue(request.headers["x-real-ip"]);
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

export function setApiSecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "SAMEORIGIN");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
}

export function enforceRateLimit(request, response, options = {}) {
  const prefix = options.prefix || "api";
  const limit = toInt(options.limit, 60);
  const windowMs = toInt(options.windowMs, 60_000);
  const now = Date.now();
  const clientIp = getClientIp(request);
  const key = `${prefix}:${clientIp}`;

  pruneStore(now);

  const current = RATE_LIMIT_STORE.get(key);
  const next =
    !current || current.resetAt <= now
      ? { count: 1, resetAt: now + windowMs }
      : { count: current.count + 1, resetAt: current.resetAt };

  RATE_LIMIT_STORE.set(key, next);

  const remaining = Math.max(0, limit - next.count);
  const resetInSeconds = Math.max(1, Math.ceil((next.resetAt - now) / 1000));

  response.setHeader("RateLimit-Limit", String(limit));
  response.setHeader("RateLimit-Remaining", String(remaining));
  response.setHeader("RateLimit-Reset", String(resetInSeconds));

  if (next.count > limit) {
    response.setHeader("Retry-After", String(resetInSeconds));
    response.status(429).json({
      error: "Too many requests. Please try again shortly.",
    });
    return false;
  }

  return true;
}

export function resolveAllowedOrigins() {
  const envOrigins = String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => normalizeOrigin(value.trim()))
    .filter(Boolean);

  const defaults = [
    normalizeOrigin(process.env.PUBLIC_SITE_URL),
    normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL),
    normalizeOrigin(process.env.SITE_URL),
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "",
  ].filter(Boolean);

  return [...new Set([...envOrigins, ...defaults])];
}

function resolveRequestOrigin(request) {
  const forwardedHost = toFirstHeaderValue(request.headers["x-forwarded-host"]);
  const host = forwardedHost || toFirstHeaderValue(request.headers.host);

  if (!host) {
    return "";
  }

  if (/^https?:\/\//i.test(host)) {
    return normalizeOrigin(host);
  }

  const forwardedProto = toFirstHeaderValue(request.headers["x-forwarded-proto"]);
  const protocol =
    forwardedProto ||
    (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");

  return normalizeOrigin(`${protocol}://${host}`);
}

export function enforceTrustedOrigin(request, response) {
  const requestHostOrigin = resolveRequestOrigin(request);
  const allowedOrigins = [...resolveAllowedOrigins(), requestHostOrigin].filter(Boolean);

  if (!allowedOrigins.length) {
    return true;
  }

  const originHeader = toFirstHeaderValue(request.headers.origin);
  const refererHeader = toFirstHeaderValue(request.headers.referer);
  const requestOrigin = normalizeOrigin(originHeader || refererHeader);

  if (!requestOrigin) {
    return true;
  }

  if (allowedOrigins.includes(requestOrigin)) {
    return true;
  }

  response.status(403).json({
    error: "Request origin is not allowed.",
  });
  return false;
}
