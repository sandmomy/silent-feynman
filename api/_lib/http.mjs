export function methodNotAllowed(response, methods) {
  response.setHeader("Allow", methods.join(", "));
  return response.status(405).json({
    error: "Method not allowed.",
    allow: methods,
  });
}

export async function readRawBody(request) {
  if (Buffer.isBuffer(request.body)) {
    return request.body;
  }

  if (typeof request.body === "string") {
    return Buffer.from(request.body, "utf8");
  }

  if (request.body && typeof request.body === "object") {
    return Buffer.from(JSON.stringify(request.body), "utf8");
  }

  const chunks = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk);
  }

  return Buffer.concat(chunks);
}

export async function readJsonBody(request) {
  try {
    if (request.body && typeof request.body === "object" && !Buffer.isBuffer(request.body)) {
      return request.body;
    }

    if (typeof request.body === "string") {
      return request.body ? JSON.parse(request.body) : {};
    }

    if (Buffer.isBuffer(request.body)) {
      const raw = request.body.toString("utf8");
      return raw ? JSON.parse(raw) : {};
    }
  } catch (error) {
    throw new Error("invalid_json");
  }

  const rawBody = await readRawBody(request);
  const rawText = rawBody.toString("utf8").trim();

  if (!rawText) {
    return {};
  }

  try {
    return JSON.parse(rawText);
  } catch (error) {
    throw new Error("invalid_json");
  }
}

export function resolveBaseUrl(request) {
  const configuredBaseUrl =
    process.env.PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.SITE_URL;

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/, "");
  }

  const forwardedProtocol = request.headers["x-forwarded-proto"];
  const forwardedHost = request.headers["x-forwarded-host"];
  const hostHeader = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : forwardedHost || request.headers.host || process.env.VERCEL_URL;
  const protocolHeader = Array.isArray(forwardedProtocol)
    ? forwardedProtocol[0]
    : forwardedProtocol;
  const host = String(hostHeader || "")
    .split(",")[0]
    .trim();
  const protocol =
    String(protocolHeader || "")
      .split(",")[0]
      .trim() || (host.includes("localhost") ? "http" : "https");

  if (!host) {
    return "http://localhost:3000";
  }

  return /^https?:\/\//i.test(host) ? host.replace(/\/+$/, "") : `${protocol}://${host}`;
}
