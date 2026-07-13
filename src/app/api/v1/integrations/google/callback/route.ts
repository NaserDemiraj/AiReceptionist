import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/base-url";
import { exchangeGoogleCode, verifyOAuthState } from "@/lib/integrations/google-calendar";

/** GET /api/v1/integrations/google/callback — completes the OAuth flow. */
export async function GET(req: NextRequest) {
  const { org, user, role } = await requireOrg();
  const base = await getBaseUrl();
  const fail = (reason: string) =>
    NextResponse.redirect(`${base}/integrations?google=${reason}`);

  if (role === "AGENT") return fail("forbidden");

  const search = req.nextUrl.searchParams;
  const code = search.get("code");
  if (!code) return fail("denied");
  if (!verifyOAuthState(search.get("state"), org.id)) {
    logger.warn({ orgId: org.id }, "google oauth state mismatch");
    return fail("state_mismatch");
  }

  const tokens = await exchangeGoogleCode(code, `${base}/api/v1/integrations/google/callback`);
  if (!tokens) return fail("exchange_failed");

  await prisma.$transaction([
    prisma.googleCalendarConnection.upsert({
      where: { organizationId: org.id },
      create: {
        organizationId: org.id,
        email: tokens.email,
        refreshToken: tokens.refreshToken,
        accessToken: tokens.accessToken,
        accessTokenExpiresAt: tokens.expiresAt,
      },
      update: {
        email: tokens.email,
        refreshToken: tokens.refreshToken,
        accessToken: tokens.accessToken,
        accessTokenExpiresAt: tokens.expiresAt,
        lastError: null,
      },
    }),
    prisma.auditLog.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        action: "integration.google_calendar.connect",
        entityType: "GoogleCalendarConnection",
      },
    }),
  ]);

  return NextResponse.redirect(`${base}/integrations?google=connected`);
}
