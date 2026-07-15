import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  debug: process.env.NODE_ENV !== "production",

  // Only send errors, not performance/transactions (to save quota)
  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],

  beforeSend: (event, hint) => {
    // Filter out certain errors (e.g., 4xx client errors we don't care about)
    if (hint.originalException instanceof Error) {
      const msg = hint.originalException.message;
      if (msg?.includes("ResizeObserver loop limit exceeded")) {
        return null; // Browser noise
      }
    }
    return event;
  },
});
