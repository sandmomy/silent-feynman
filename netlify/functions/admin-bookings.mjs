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

export async function handler(event) {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: "Method not allowed." }) };
  }

  const token = (event.headers.authorization || "").replace("Bearer ", "").trim();

  if (!(await validateToken(token))) {
    return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: "Unauthorized." }) };
  }

  try {
    const bookings = await queryD1(
      "SELECT * FROM bookings ORDER BY created_at DESC"
    );

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ bookings }),
    };
  } catch (error) {
    console.error("admin_bookings_failed", error);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: "Failed to load bookings." }) };
  }
}
