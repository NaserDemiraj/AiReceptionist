import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import { getBaseUrl } from "@/lib/base-url";
import {
  getGoogleAuthUrl,
  isGoogleCalendarConfigured,
  signOAuthState,
} from "@/lib/integrations/google-calendar";

/** GET /api/v1/integrations/google/authorize — kicks off the OAuth consent flow. */
export async function GET() {
  const { org, role } = await requireOrg();
  if (role === "AGENT") {
    return NextResponse.redirect(`${await getBaseUrl()}/integrations`);
  }
  if (!isGoogleCalendarConfigured()) {
    return NextResponse.redirect(`${await getBaseUrl()}/integrations?google=not_configured`);
  }

  const redirectUri = `${await getBaseUrl()}/api/v1/integrations/google/callback`;
  return NextResponse.redirect(getGoogleAuthUrl(redirectUri, signOAuthState(org.id)));
}
