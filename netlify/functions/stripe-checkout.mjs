import Stripe from "stripe";
import {
  buildContactMailto,
  getService,
  getServicePriceId,
} from "../../api/_lib/service-catalog.mjs";

const HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
};

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    appInfo: { name: "eugene-mierak-services", version: "1.0.0" },
  });
}

function normalizeEmail(value) {
  if (typeof value !== "string") return undefined;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

function resolveBaseUrl() {
  return (process.env.PUBLIC_SITE_URL || process.env.URL || "").replace(/\/+$/, "");
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { ...HEADERS, Allow: "POST" },
      body: JSON.stringify({ error: "Method not allowed.", allow: ["POST"] }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "Invalid JSON body." }) };
  }

  const serviceSlug = typeof payload?.serviceSlug === "string" ? payload.serviceSlug.trim() : "";
  const service = getService(serviceSlug);

  if (!service) {
    return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: "Unknown service selected." }) };
  }

  if (service.action !== "stripe") {
    return {
      statusCode: 409,
      headers: HEADERS,
      body: JSON.stringify({
        error: "This service is handled through a private consultation flow.",
        contactUrl: buildContactMailto(service),
        service: { slug: service.slug, name: service.name },
      }),
    };
  }

  const priceId = getServicePriceId(service);
  if (!priceId) {
    return {
      statusCode: 503,
      headers: HEADERS,
      body: JSON.stringify({
        error: "Stripe is not configured yet for this service.",
        contactUrl: buildContactMailto(service),
        service: { slug: service.slug, name: service.name },
      }),
    };
  }

  const baseUrl = resolveBaseUrl();
  const customerEmail = normalizeEmail(payload?.customerEmail);
  const quantity = service.allowMultipleQuantity ? Math.min(Math.max(parseInt(payload?.guestCount, 10) || 1, 1), 12) : 1;
  const extraMeta = payload?.metadata && typeof payload.metadata === "object" ? payload.metadata : {};

  const isBooking = service.slug.includes("retreat") || service.slug.includes("booking");
  const successPage = isBooking ? "booking.html" : "services.html";
  const cancelPage = isBooking ? "booking.html" : "services.html";

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: service.checkoutMode,
      line_items: [{ price: priceId, quantity }],
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      ...(customerEmail ? { customer_email: customerEmail } : {}),
      client_reference_id: service.slug,
      metadata: {
        serviceSlug: service.slug,
        serviceName: service.name,
        sourcePage: successPage,
        ...Object.fromEntries(
          Object.entries(extraMeta).map(([k, v]) => [k, String(v).slice(0, 500)])
        ),
      },
      success_url: `${baseUrl}/${successPage}?checkout=success&service=${encodeURIComponent(service.slug)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/${cancelPage}?checkout=cancel&service=${encodeURIComponent(service.slug)}`,
    });

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        url: session.url,
        service: { slug: service.slug, name: service.name, checkoutMode: service.checkoutMode },
      }),
    };
  } catch (error) {
    console.error("stripe_checkout_session_failed", {
      message: error instanceof Error ? error.message : "Unknown Stripe error",
      serviceSlug,
    });

    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({
        error: "Unable to create the Stripe checkout session right now.",
        contactUrl: buildContactMailto(service),
      }),
    };
  }
}
