import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  debug: process.env.NODE_ENV !== "production",

  integrations: [],

  beforeSend: (event, hint) => {
    // Ignore low-severity errors to keep the noise down
    if (hint.originalException instanceof Error) {
      const msg = hint.originalException.message.toLowerCase();

      // Skip rate limit errors (we handle these internally)
      if (msg.includes("rate limit") || msg.includes("429")) {
        // Still log locally but don't send to Sentry
        console.warn("[Rate limit]", hint.originalException.message);
        return null;
      }

      // Skip expected client errors
      if (msg.includes("network") || msg.includes("timeout")) {
        return event; // Send as warning, not error
      }
    }

    return event;
  },
});
