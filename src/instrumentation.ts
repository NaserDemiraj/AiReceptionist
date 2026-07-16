/**
 * Next.js server instrumentation — runs once at server startup.
 * Importing the sentry module initializes it (env-gated by SENTRY_DSN).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/sentry");
  }
}
