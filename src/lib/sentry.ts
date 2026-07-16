/**
 * Sentry error tracking integration
 * https://sentry.io — centralized error monitoring, alerts, and issue grouping
 *
 * Set SENTRY_DSN (server) and NEXT_PUBLIC_SENTRY_DSN (client) env vars to enable.
 * Without DSN, all errors go to console only (local dev is fine).
 */

import * as Sentry from "@sentry/nextjs";

const serverDsn = process.env.SENTRY_DSN;
const clientDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (typeof window === "undefined" && serverDsn) {
  // Server-side Sentry initialization
  Sentry.init({
    dsn: serverDsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    debug: false,
  });
}

/**
 * Capture error for Sentry (with fallback to console if DSN not configured)
 */
export function captureError(
  error: Error | string,
  context?: Record<string, unknown>,
  level: "error" | "warning" | "info" = "error"
) {
  const message = typeof error === "string" ? error : error.message;
  const exception = error instanceof Error ? error : new Error(message);

  if (serverDsn || clientDsn) {
    Sentry.captureException(exception, {
      level,
      contexts: { custom: context },
    });
  } else {
    console.error(`[${level.toUpperCase()}]`, message, context);
  }
}

/**
 * Capture message for Sentry (info, warnings)
 */
export function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info"
) {
  if (serverDsn || clientDsn) {
    Sentry.captureMessage(message, level);
  } else {
    console.log(`[${level.toUpperCase()}]`, message);
  }
}
