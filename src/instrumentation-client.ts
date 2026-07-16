/**
 * Next.js client instrumentation — runs in the browser before the app
 * becomes interactive. Captures unhandled frontend errors to Sentry.
 * Env-gated: without NEXT_PUBLIC_SENTRY_DSN this is a no-op.
 */
import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0, // errors only — keeps the free quota for what matters
    beforeSend(event, hint) {
      const err = hint.originalException;
      // Browser noise, not actionable
      if (err instanceof Error && err.message.includes("ResizeObserver loop")) {
        return null;
      }
      return event;
    },
  });
}
