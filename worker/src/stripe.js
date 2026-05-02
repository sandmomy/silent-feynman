const STRIPE_API = "https://api.stripe.com/v1";

function publicBase(env) {
  return env.PUBLIC_BASE_URL || "https://book.eugenemierak.com";
}

function unitAmountCents(env) {
  const raw = env.BOOK_PRICE_EUR_CENTS;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1000;
}

function productNameFor(book) {
  const title = book.title || book.slug;
  return `Frequency Vibes \u2014 ${title}`;
}

export async function createCheckoutSession(env, book, session, options = {}) {
  if (!env.STRIPE_SECRET_KEY) {
    throw { status: 503, message: "Stripe is not configured." };
  }
  const base = publicBase(env);
  const mobile = !!options.mobile;
  // Mobile must NOT use /m/* or /library/* — those paths have Android intent filters
  // in the native app (autoVerify). Stripe redirect would open the installed app
  // instead of returning to the browser. Use root + query params (no intent match).
  const successUrl = mobile
    ? `${base}/?purchased=1&slug=${encodeURIComponent(book.slug)}&stripe_session={CHECKOUT_SESSION_ID}`
    : `${base}/?purchase_success=${encodeURIComponent(book.slug)}&stripe_session={CHECKOUT_SESSION_ID}`;
  const cancelUrl = mobile
    ? `${base}/?purchase_cancelled=1&slug=${encodeURIComponent(book.slug)}`
    : `${base}/library/${encodeURIComponent(book.slug)}`;
  const params = new URLSearchParams();
  params.append("mode", "payment");
  params.append("payment_method_types[]", "card");
  params.append("success_url", successUrl);
  params.append("cancel_url", cancelUrl);
  params.append("client_reference_id", session.username);
  params.append("metadata[username]", session.username);
  params.append("metadata[book_id]", book.book_id);
  params.append("metadata[slug]", book.slug);
  params.append("line_items[0][quantity]", "1");
  params.append("line_items[0][price_data][currency]", "eur");
  params.append("line_items[0][price_data][unit_amount]", String(unitAmountCents(env)));
  params.append("line_items[0][price_data][product_data][name]", productNameFor(book));
  if (session.email) params.append("customer_email", session.email);

  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw { status: 502, message: data?.error?.message || "Stripe checkout failed." };
  }
  return data;
}

function bundleAmountCents(env) {
  const raw = env.BUNDLE_PRICE_EUR_CENTS;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  // Default bundle price: €50.00 (5000 cents)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5000;
}

/**
 * Create a Stripe checkout session for the full book bundle.
 * Flat price (default €50) grants access to every provided book_id.
 * Webhook reads metadata.bundle + metadata.book_ids (comma-separated).
 */
export async function createBundleCheckoutSession(env, bookIds, session, options = {}) {
  if (!env.STRIPE_SECRET_KEY) {
    throw { status: 503, message: "Stripe is not configured." };
  }
  if (!Array.isArray(bookIds) || bookIds.length === 0) {
    throw { status: 400, message: "Bundle has no chapters to grant." };
  }
  const base = publicBase(env);
  const mobile = !!options.mobile;
  const successUrl = mobile
    ? `${base}/?purchased=1&bundle=1&stripe_session={CHECKOUT_SESSION_ID}`
    : `${base}/?purchase_success=bundle&stripe_session={CHECKOUT_SESSION_ID}`;
  const cancelUrl = mobile
    ? `${base}/?purchase_cancelled=1&bundle=1`
    : `${base}/`;

  const params = new URLSearchParams();
  params.append("mode", "payment");
  params.append("payment_method_types[]", "card");
  params.append("success_url", successUrl);
  params.append("cancel_url", cancelUrl);
  params.append("client_reference_id", session.username);
  params.append("metadata[username]", session.username);
  params.append("metadata[bundle]", "true");
  params.append("metadata[book_ids]", bookIds.join(","));
  params.append("line_items[0][quantity]", "1");
  params.append("line_items[0][price_data][currency]", "eur");
  params.append("line_items[0][price_data][unit_amount]", String(bundleAmountCents(env)));
  params.append("line_items[0][price_data][product_data][name]", "Frequency Vibes — Full book (all chapters)");
  if (session.email) params.append("customer_email", session.email);

  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw { status: 502, message: data?.error?.message || "Stripe bundle checkout failed." };
  }
  return data;
}

async function hmacSha256Hex(key, message) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function parseStripeSignature(header) {
  if (!header) return null;
  const parts = header.split(",");
  const out = { t: null, v1: [] };
  for (const part of parts) {
    const [k, v] = part.split("=");
    if (k === "t") out.t = v;
    if (k === "v1") out.v1.push(v);
  }
  return out.t && out.v1.length ? out : null;
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export async function retrieveCheckoutSession(env, sessionId) {
  if (!env.STRIPE_SECRET_KEY) {
    throw { status: 503, message: "Stripe is not configured." };
  }
  const res = await fetch(`${STRIPE_API}/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw { status: 502, message: data?.error?.message || "Could not retrieve session." };
  }
  return data;
}

export async function verifyStripeSignature(rawBody, headerValue, secret, toleranceSeconds = 300) {
  const parsed = parseStripeSignature(headerValue);
  if (!parsed) return false;
  const age = Math.floor(Date.now() / 1000) - parseInt(parsed.t, 10);
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;
  const expected = await hmacSha256Hex(secret, `${parsed.t}.${rawBody}`);
  return parsed.v1.some((sig) => constantTimeEqual(sig, expected));
}
