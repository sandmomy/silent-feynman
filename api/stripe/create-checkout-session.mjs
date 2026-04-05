import {
  buildContactMailto,
  getService,
  getServicePriceId,
} from "../_lib/service-catalog.mjs";
import { methodNotAllowed, readJsonBody, resolveBaseUrl } from "../_lib/http.mjs";
import {
  enforceRateLimit,
  enforceTrustedOrigin,
  setApiSecurityHeaders,
} from "../_lib/security.mjs";
import { getStripeClient } from "../_lib/stripe.mjs";

function normalizeEmail(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

export default async function handler(request, response) {
  setApiSecurityHeaders(response);

  if (request.method !== "POST") {
    return methodNotAllowed(response, ["POST"]);
  }

  const limit = Number.parseInt(
    process.env.RATE_LIMIT_CHECKOUT_PER_10_MIN || "20",
    10,
  );

  if (
    !enforceRateLimit(request, response, {
      prefix: "stripe-checkout",
      limit,
      windowMs: 10 * 60_000,
    })
  ) {
    return;
  }

  if (!enforceTrustedOrigin(request, response)) {
    return;
  }

  response.setHeader("Cache-Control", "no-store");

  let payload;

  try {
    payload = await readJsonBody(request);
  } catch (error) {
    return response.status(400).json({
      error: "Invalid JSON body.",
    });
  }

  const serviceSlug = typeof payload?.serviceSlug === "string" ? payload.serviceSlug.trim() : "";
  const service = getService(serviceSlug);

  if (!service) {
    return response.status(404).json({
      error: "Unknown service selected.",
    });
  }

  if (service.action !== "stripe") {
    return response.status(409).json({
      error: "This service is handled through a private consultation flow.",
      contactUrl: buildContactMailto(service),
      service: {
        slug: service.slug,
        name: service.name,
      },
    });
  }

  const priceId = getServicePriceId(service);

  if (!priceId) {
    return response.status(503).json({
      error: "Stripe is not configured yet for this service.",
      contactUrl: buildContactMailto(service),
      service: {
        slug: service.slug,
        name: service.name,
      },
    });
  }

  const baseUrl = resolveBaseUrl(request);
  const customerEmail = normalizeEmail(payload?.customerEmail);

  try {
    const checkoutSession = await getStripeClient().checkout.sessions.create({
      mode: service.checkoutMode,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      ...(customerEmail ? { customer_email: customerEmail } : {}),
      client_reference_id: service.slug,
      metadata: {
        serviceSlug: service.slug,
        serviceName: service.name,
        sourcePage: "services.html",
      },
      success_url: `${baseUrl}/services.html?checkout=success&service=${encodeURIComponent(
        service.slug,
      )}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/services.html?checkout=cancel&service=${encodeURIComponent(service.slug)}`,
    });

    return response.status(200).json({
      url: checkoutSession.url,
      service: {
        slug: service.slug,
        name: service.name,
        checkoutMode: service.checkoutMode,
      },
    });
  } catch (error) {
    console.error("stripe_checkout_session_failed", {
      message: error instanceof Error ? error.message : "Unknown Stripe error",
      serviceSlug,
    });

    return response.status(500).json({
      error: "Unable to create the Stripe checkout session right now.",
      contactUrl: buildContactMailto(service),
    });
  }
}
