/**
 * CORS header generation with security-first defaults.
 *
 * Public widget endpoints (chat, config, feedback) need wildcard origin
 * because the widget is embedded on customer websites.
 * No CSRF risk since these use widgetKey (public) not session cookies.
 */

export function getPublicCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

export function getAuthenticatedCorsHeaders(req: Request) {
  // For future authenticated endpoints: restrict to configured origins
  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(",") ?? [];
  const origin = req.headers.get("origin");
  const isAllowed = allowedOrigins.includes(origin ?? "");

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}
