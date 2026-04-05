import { queryD1 } from "./lib/d1.mjs";

const HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

function generateToken() {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "";
  for (let i = 0; i < 64; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: "Method not allowed." }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: "Invalid JSON." }) };
  }

  const password = (payload.password || "").trim();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: "Admin not configured." }) };
  }

  if (password !== adminPassword) {
    return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: "Invalid password." }) };
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  try {
    // Clean expired sessions
    await queryD1("DELETE FROM admin_sessions WHERE expires_at < datetime('now')");
    // Create new session
    await queryD1("INSERT INTO admin_sessions (token, expires_at) VALUES (?, ?)", [token, expiresAt]);

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ token, expiresAt }),
    };
  } catch (error) {
    console.error("admin_login_failed", error);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: "Login failed." }) };
  }
}
