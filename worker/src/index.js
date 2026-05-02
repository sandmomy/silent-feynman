import { router } from "./api.js";
import { runD1Backup } from "./backup.js";
import { runReminderCron } from "./reminders.js";
import { wrapWithSentry } from "./sentry-wrap.js";

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: https: blob:",
  "connect-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com https://accounts.google.com",
  "object-src 'none'",
].join("; ");

function applySecurityHeaders(response, contentType) {
  const headers = response.headers;
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  if (contentType === "html") {
    headers.set("Content-Security-Policy", CSP);
    headers.set("X-Frame-Options", "DENY");
  }
  return response;
}

const handlers = {
  async scheduled(event, env, ctx) {
    const cron = event?.cron || "";
    if (cron === "0 3 * * SUN") {
      ctx.waitUntil(runD1Backup(env).catch((err) => console.error("d1_backup_failed", err)));
    } else if (cron === "0 10 * * *") {
      ctx.waitUntil(runReminderCron(env).catch((err) => console.error("reminder_cron_failed", err)));
    } else {
      // Fallback: treat unknown schedule as the weekly backup to preserve previous behaviour.
      ctx.waitUntil(runD1Backup(env).catch((err) => console.error("d1_backup_failed", err)));
    }
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": env.PUBLIC_BASE_URL || "*",
          "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (pathname.startsWith("/api/")) {
      const match = router.match(request.method, pathname);
      if (match) {
        try {
          const response = await match.handler(request, env, match.params);
          const origin = env.PUBLIC_BASE_URL || "*";
          response.headers.set("Access-Control-Allow-Origin", origin);
          response.headers.set("Access-Control-Allow-Credentials", "true");
          return applySecurityHeaders(response, "json");
        } catch (err) {
          if (err.status) {
            return applySecurityHeaders(new Response(JSON.stringify({ error: err.message }), {
              status: err.status,
              headers: { "Content-Type": "application/json" },
            }), "json");
          }
          console.error(err);
          return applySecurityHeaders(new Response(JSON.stringify({ error: "Internal error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }), "json");
        }
      }
      return applySecurityHeaders(new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }), "json");
    }

    if (
      pathname === "/index.html" ||
      pathname === "/app.js" ||
      pathname === "/library-mock.html"
    ) {
      return applySecurityHeaders(
        new Response(null, { status: 301, headers: { Location: "/" } }),
        "text"
      );
    }

    if (pathname === "/" || pathname.startsWith("/b/") || pathname.startsWith("/library/")) {
      const ua = request.headers.get("User-Agent") || "";
      const isMobile = /android|iphone|ipad|ipod|mobile/i.test(ua);
      const forceDesktop = url.searchParams.get("desktop") === "1";
      const assetKey = isMobile && !forceDesktop ? "web/mobile.html" : "web/customer.html";
      const asset = await env.ASSETS.get(assetKey);
      if (asset) {
        return applySecurityHeaders(new Response(asset.body, {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
        }), "html");
      }
    }

    if (pathname.startsWith("/m/")) {
      const ua = request.headers.get("User-Agent") || "";
      const isMobile = /android|iphone|ipad|ipod|mobile/i.test(ua);
      const forceDesktop = url.searchParams.get("desktop") === "1";
      const assetKey = isMobile && !forceDesktop ? "web/mobile.html" : "web/m.html";
      const asset = await env.ASSETS.get(assetKey);
      if (asset) {
        return applySecurityHeaders(new Response(asset.body, {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
        }), "html");
      }
    }

    if (pathname === "/admin") {
      const asset = await env.ASSETS.get("web/admin.html");
      if (asset) {
        return applySecurityHeaders(new Response(asset.body, {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
        }), "html");
      }
    }

    if (pathname === "/privacy" || pathname === "/terms" || pathname === "/legal" || pathname === "/delete-account" || pathname === "/reset-password" || pathname === "/forgot-password") {
      const asset = await env.ASSETS.get(`web${pathname}.html`);
      if (asset) {
        return applySecurityHeaders(new Response(asset.body, {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
        }), "html");
      }
    }

    const staticKey = `web${pathname}`;
    const asset = await env.ASSETS.get(staticKey);
    if (asset) {
      const ext = pathname.split(".").pop().toLowerCase();
      const contentTypes = {
        html: "text/html; charset=utf-8",
        css: "text/css; charset=utf-8",
        js: "application/javascript; charset=utf-8",
        mjs: "application/javascript; charset=utf-8",
        json: "application/json",
        webmanifest: "application/manifest+json",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        svg: "image/svg+xml",
        ico: "image/x-icon",
        woff2: "font/woff2",
        mp3: "audio/mpeg",
        wav: "audio/wav",
        pdf: "application/pdf",
      };
      // Files that change often need short cache: HTML, SW, mobile SPA, customer SPA
      const alwaysFresh = pathname === "/sw.js" ||
        pathname === "/mobile.js" || pathname === "/mobile.css" || pathname === "/mobile.html" ||
        pathname === "/customer.js" || pathname === "/customer.css" || pathname === "/customer.html";
      let cacheControl;
      if (ext === "html") cacheControl = "no-cache";
      else if (alwaysFresh) cacheControl = "no-cache, must-revalidate";
      else cacheControl = "public, max-age=604800";
      return applySecurityHeaders(new Response(asset.body, {
        headers: {
          "Content-Type": contentTypes[ext] || "application/octet-stream",
          "Cache-Control": cacheControl,
        },
      }), ext === "html" ? "html" : "static");
    }

    const fallback = await env.ASSETS.get("web/customer.html");
    if (fallback) {
      return applySecurityHeaders(new Response(fallback.body, {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
      }), "html");
    }

    return applySecurityHeaders(new Response("Not found", { status: 404 }), "text");
  },
};

export default wrapWithSentry(handlers);
