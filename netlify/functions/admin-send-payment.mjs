import Stripe from "stripe";
import { queryD1 } from "./lib/d1.mjs";

const HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

async function validateToken(token) {
  if (!token) return false;
  const rows = await queryD1(
    "SELECT id FROM admin_sessions WHERE token = ? AND expires_at > datetime('now') LIMIT 1",
    [token]
  );
  return rows.length > 0;
}

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    appInfo: { name: "eugene-mierak-admin", version: "1.0.0" },
  });
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: "Method not allowed." }) };
  }

  const token = (event.headers.authorization || "").replace("Bearer ", "").trim();

  if (!(await validateToken(token))) {
    return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: "Unauthorized." }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "Invalid JSON." }) };
  }

  const bookingId = payload.bookingId;
  if (!bookingId) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "Missing bookingId." }) };
  }

  try {
    const rows = await queryD1("SELECT * FROM bookings WHERE id = ? LIMIT 1", [String(bookingId)]);
    const booking = rows[0];

    if (!booking) {
      return { statusCode: 404, headers: HEADERS, body: JSON.stringify({ error: "Booking not found." }) };
    }

    if (!booking.deposit_paid) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "Deposit not yet paid." }) };
    }

    if (booking.full_payment_paid) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "Full payment already completed." }) };
    }

    const priceId = process.env.STRIPE_PRICE_INDONESIA_FULL;

    if (!priceId) {
      return { statusCode: 503, headers: HEADERS, body: JSON.stringify({ error: "Full payment price not configured." }) };
    }

    const baseUrl = process.env.PUBLIC_SITE_URL || "";

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: booking.guests || 1 }],
      customer_email: booking.email,
      client_reference_id: `full-payment-${booking.id}`,
      metadata: {
        bookingId: String(booking.id),
        type: "full_payment",
        firstName: booking.first_name,
        lastName: booking.last_name,
        retreatName: booking.retreat_name,
      },
      success_url: `${baseUrl}/booking.html?checkout=success&type=full`,
      cancel_url: `${baseUrl}/booking.html?checkout=cancel&type=full`,
    });

    // Update booking with session info
    await queryD1(
      "UPDATE bookings SET full_payment_session_id = ?, status = 'payment_sent', updated_at = datetime('now') WHERE id = ?",
      [session.id, String(bookingId)]
    );

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        checkoutUrl: session.url,
        booking: {
          id: booking.id,
          name: `${booking.first_name} ${booking.last_name}`,
          email: booking.email,
          phone: booking.phone,
        },
      }),
    };
  } catch (error) {
    console.error("admin_send_payment_failed", error);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: "Failed to create payment link." }) };
  }
}
