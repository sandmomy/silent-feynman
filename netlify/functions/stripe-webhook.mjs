import Stripe from "stripe";
import { queryD1 } from "./lib/d1.mjs";

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

async function handleDeposit(session) {
  const meta = session.metadata || {};
  const email = session.customer_details?.email || session.customer_email || "";
  const customerId = session.customer || "";

  if (meta.serviceSlug !== "indonesia-retreat-deposit") return;

  await queryD1(
    `INSERT INTO bookings (
      stripe_session_id, stripe_customer_id, first_name, last_name, email, phone,
      country, guests, notes, retreat_name, deposit_amount, deposit_paid,
      deposit_paid_at, full_payment_amount, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), ?, 'deposit_paid')`,
    [
      session.id,
      customerId,
      meta.firstName || "",
      meta.lastName || "",
      email,
      meta.phone || "",
      meta.country || "",
      meta.guests || "1",
      meta.notes || "",
      "Indonesia Frequency Vibes Journey",
      String(session.amount_total || 800000),
      "700000",
    ]
  );
}

async function handleFullPayment(session) {
  const meta = session.metadata || {};
  if (meta.type !== "full_payment" || !meta.bookingId) return;

  await queryD1(
    `UPDATE bookings SET
      full_payment_paid = 1,
      full_payment_paid_at = datetime('now'),
      full_payment_session_id = ?,
      status = 'completed',
      updated_at = datetime('now')
    WHERE id = ?`,
    [session.id, meta.bookingId]
  );
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { ...HEADERS, Allow: "POST" },
      body: JSON.stringify({ error: "Method not allowed.", allow: ["POST"] }),
    };
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = event.headers["stripe-signature"];

  if (!webhookSecret) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: "STRIPE_WEBHOOK_SECRET is not configured." }) };
  }

  if (!signature) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "Missing Stripe signature header." }) };
  }

  let stripeEvent;
  try {
    stripeEvent = getStripe().webhooks.constructEvent(event.body, signature, webhookSecret);
  } catch (error) {
    console.error("stripe_webhook_signature_failed", {
      message: error instanceof Error ? error.message : "Unknown signature error",
    });
    return {
      statusCode: 400,
      headers: HEADERS,
      body: `Webhook Error: ${error instanceof Error ? error.message : "Signature verification failed."}`,
    };
  }

  try {
    switch (stripeEvent.type) {
      case "checkout.session.completed": {
        const session = stripeEvent.data.object;
        console.log(JSON.stringify({
          level: "info",
          eventType: stripeEvent.type,
          sessionId: session.id,
          serviceSlug: session.metadata?.serviceSlug || null,
          customerEmail: session.customer_details?.email || session.customer_email || null,
          paymentStatus: session.payment_status || null,
        }));

        // Save to D1
        await handleDeposit(session);
        await handleFullPayment(session);
        break;
      }
      case "invoice.paid":
      case "customer.subscription.deleted": {
        const object = stripeEvent.data.object;
        console.log(JSON.stringify({
          level: "info",
          eventType: stripeEvent.type,
          stripeObjectId: object.id,
          customerId: object.customer || null,
        }));
        break;
      }
      default:
        console.log(JSON.stringify({
          level: "debug",
          eventType: stripeEvent.type,
          stripeEventId: stripeEvent.id,
        }));
    }

    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ received: true }) };
  } catch (error) {
    console.error("stripe_webhook_handler_failed", {
      message: error instanceof Error ? error.message : "Unknown webhook error",
      eventType: stripeEvent.type,
    });
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: "Webhook handler failed." }) };
  }
}
