import { getContactEmail, getPublicServiceCatalog } from "../_lib/service-catalog.mjs";
import { methodNotAllowed } from "../_lib/http.mjs";
import { enforceRateLimit, setApiSecurityHeaders } from "../_lib/security.mjs";

export default function handler(request, response) {
  setApiSecurityHeaders(response);

  if (request.method !== "GET") {
    return methodNotAllowed(response, ["GET"]);
  }

  const limit = Number.parseInt(process.env.RATE_LIMIT_CATALOG_PER_MIN || "120", 10);

  if (
    !enforceRateLimit(request, response, {
      prefix: "stripe-catalog",
      limit,
      windowMs: 60_000,
    })
  ) {
    return;
  }

  response.setHeader("Cache-Control", "no-store");

  return response.status(200).json({
    contactEmail: getContactEmail(),
    services: getPublicServiceCatalog(),
  });
}
