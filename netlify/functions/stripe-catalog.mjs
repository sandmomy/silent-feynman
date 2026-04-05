import { getContactEmail, getPublicServiceCatalog } from "../../api/_lib/service-catalog.mjs";

const HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
};

export async function handler(event) {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { ...HEADERS, Allow: "GET" },
      body: JSON.stringify({ error: "Method not allowed.", allow: ["GET"] }),
    };
  }

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({
      contactEmail: getContactEmail(),
      services: getPublicServiceCatalog(),
    }),
  };
}
