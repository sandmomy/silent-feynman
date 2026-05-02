import * as Sentry from "@sentry/cloudflare";

export function wrapWithSentry(handlers) {
  return Sentry.withSentry(
    (env) => ({
      dsn: env.SENTRY_DSN || undefined,
      enabled: !!env.SENTRY_DSN,
      environment: env.SENTRY_ENV || "production",
      release: env.SENTRY_RELEASE || "bookvoice-worker@1.0.0",
      tracesSampleRate: 0,
      sendDefaultPii: false,
      beforeSend(event) {
        if (event.request?.headers) {
          delete event.request.headers.cookie;
          delete event.request.headers.authorization;
        }
        if (event.request?.query_string && event.request.query_string.includes("mobile_token")) {
          event.request.query_string = "[redacted]";
        }
        return event;
      },
    }),
    handlers
  );
}
