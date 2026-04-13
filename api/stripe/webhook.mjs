import { methodNotAllowed, readRawBody } from "../_lib/http.mjs";
import { enforceRateLimit, setApiSecurityHeaders } from "../_lib/security.mjs";
import { getStripeClient } from "../_lib/stripe.mjs";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(request, response) {
  setApiSecurityHeaders(response);

  if (request.method !== "POST") {
    return methodNotAllowed(response, ["POST"]);
  }

  const limit = Number.parseInt(
    process.env.RATE_LIMIT_WEBHOOK_PER_MIN || "240",
    10,
  );

  if (
    !enforceRateLimit(request, response, {
      prefix: "stripe-webhook",
      limit,
      windowMs: 60_000,
    })
  ) {
    return;
  }

  response.setHeader("Cache-Control", "no-store");

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers["stripe-signature"];

  if (!webhookSecret) {
    return response.status(500).json({
      error: "STRIPE_WEBHOOK_SECRET is not configured.",
    });
  }

  if (!signature || Array.isArray(signature)) {
    return response.status(400).json({
      error: "Missing Stripe signature header.",
    });
  }

  let event;

  try {
    const rawBody = await readRawBody(request);
    event = getStripeClient().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("stripe_webhook_signature_failed", {
      message: error instanceof Error ? error.message : "Unknown signature error",
    });

    return response.status(400).send(
      `Webhook Error: ${error instanceof Error ? error.message : "Signature verification failed."}`,
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        console.log(
          JSON.stringify({
            level: "info",
            eventType: event.type,
            sessionId: session.id,
            serviceSlug: session.metadata?.serviceSlug || null,
            customerEmail: session.customer_details?.email || session.customer_email || null,
            paymentStatus: session.payment_status || null,
          }),
        );
        break;
      }

      case "invoice.paid":
      case "customer.subscription.deleted": {
        const object = event.data.object;
        console.log(
          JSON.stringify({
            level: "info",
            eventType: event.type,
            stripeObjectId: object.id,
            customerId: object.customer || null,
          }),
        );
        break;
      }

      default:
        console.log(
          JSON.stringify({
            level: "debug",
            eventType: event.type,
            stripeEventId: event.id,
          }),
        );
    }

    return response.status(200).json({ received: true });
  } catch (error) {
    console.error("stripe_webhook_handler_failed", {
      message: error instanceof Error ? error.message : "Unknown webhook error",
      eventType: event.type,
    });

    return response.status(500).json({
      error: "Webhook handler failed.",
    });
  }
}
