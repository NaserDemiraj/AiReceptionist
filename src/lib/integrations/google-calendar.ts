import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "../prisma";
import { logger } from "../logger";

/**
 * Google Calendar sync — one connected Google account per org.
 * Appointments are pushed to the calendar (insert / patch / delete).
 * Env: GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET. Absent → feature hidden.
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";
const SCOPE = "https://www.googleapis.com/auth/calendar.events openid email";

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/* ---------- OAuth state: HMAC-signed orgId so the callback can't be forged ---------- */

function stateSecret(): string {
  return process.env.AUTH_SECRET ?? "dev-secret";
}

export function signOAuthState(orgId: string): string {
  const sig = createHmac("sha256", stateSecret()).update(orgId).digest("hex").slice(0, 32);
  return `${orgId}.${sig}`;
}

export function verifyOAuthState(state: string | null, orgId: string): boolean {
  if (!state) return false;
  const expected = signOAuthState(orgId);
  const a = Buffer.from(state);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/* ---------- OAuth flow ---------- */

export function getGoogleAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent", // always returns a refresh_token
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export interface GoogleTokens {
  refreshToken: string;
  accessToken: string;
  expiresAt: Date;
  email: string | null;
}

export async function exchangeGoogleCode(
  code: string,
  redirectUri: string,
): Promise<GoogleTokens | null> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  if (!res.ok) {
    logger.warn({ status: res.status }, "google code exchange failed");
    return null;
  }
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    id_token?: string;
  };
  if (!data.access_token || !data.refresh_token) return null;

  // id_token came straight from Google over TLS — decoding without
  // re-verification is fine for a display-only email.
  let email: string | null = null;
  try {
    const payload = data.id_token?.split(".")[1];
    if (payload) email = (JSON.parse(Buffer.from(payload, "base64url").toString()) as { email?: string }).email ?? null;
  } catch {
    /* display-only */
  }

  return {
    refreshToken: data.refresh_token,
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
    email,
  };
}

/** Returns a fresh access token for the org's connection, refreshing when expired. */
async function getValidAccessToken(orgId: string): Promise<{ token: string; calendarId: string } | null> {
  const conn = await prisma.googleCalendarConnection.findUnique({ where: { organizationId: orgId } });
  if (!conn) return null;

  const stillValid =
    conn.accessToken &&
    conn.accessTokenExpiresAt &&
    conn.accessTokenExpiresAt.getTime() > Date.now() + 60_000;
  if (stillValid) return { token: conn.accessToken!, calendarId: conn.calendarId };

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: conn.refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.warn({ status: res.status, orgId, body: body.slice(0, 200) }, "google token refresh failed");
    await prisma.googleCalendarConnection.update({
      where: { organizationId: orgId },
      data: { lastError: `token_refresh_${res.status}` },
    });
    return null;
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;

  await prisma.googleCalendarConnection.update({
    where: { organizationId: orgId },
    data: {
      accessToken: data.access_token,
      accessTokenExpiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
      lastError: null,
    },
  });
  return { token: data.access_token, calendarId: conn.calendarId };
}

/* ---------- Appointment sync (best-effort — callers never fail on it) ---------- */

const TYPE_LABELS: Record<string, string> = {
  SHOWROOM_VISIT: "Showroom visit",
  CONSULTATION: "Consultation",
  DELIVERY: "Delivery",
  OTHER: "Appointment",
};

export async function syncAppointmentToCalendar(appointmentId: string): Promise<void> {
  try {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { customer: true, organization: { select: { timezone: true } } },
    });
    if (!appt) return;
    const access = await getValidAccessToken(appt.organizationId);
    if (!access) return;

    const event = {
      summary: `${TYPE_LABELS[appt.type] ?? "Appointment"}: ${appt.customer.name ?? "Customer"}`,
      description: [
        appt.notes,
        appt.customer.phone ? `Phone: +${appt.customer.phone.replace(/^\+/, "")}` : null,
        appt.customer.email ? `Email: ${appt.customer.email}` : null,
        "Booked via AI Receptionist",
      ]
        .filter(Boolean)
        .join("\n"),
      start: { dateTime: appt.startsAt.toISOString(), timeZone: appt.organization.timezone },
      end: { dateTime: appt.endsAt.toISOString(), timeZone: appt.organization.timezone },
    };

    const base = `${CALENDAR_BASE}/calendars/${encodeURIComponent(access.calendarId)}/events`;
    const url = appt.googleEventId ? `${base}/${appt.googleEventId}` : base;
    const res = await fetch(url, {
      method: appt.googleEventId ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${access.token}`,
      },
      body: JSON.stringify(event),
    });
    if (!res.ok) {
      logger.warn({ status: res.status, appointmentId }, "calendar event sync failed");
      return;
    }
    const data = (await res.json()) as { id?: string };
    if (!appt.googleEventId && data.id) {
      await prisma.appointment.update({
        where: { id: appointmentId },
        data: { googleEventId: data.id },
      });
    }
  } catch (err) {
    logger.warn({ err, appointmentId }, "calendar sync threw");
  }
}

export async function removeAppointmentFromCalendar(appointmentId: string): Promise<void> {
  try {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { organizationId: true, googleEventId: true },
    });
    if (!appt?.googleEventId) return;
    const access = await getValidAccessToken(appt.organizationId);
    if (!access) return;

    await fetch(
      `${CALENDAR_BASE}/calendars/${encodeURIComponent(access.calendarId)}/events/${appt.googleEventId}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${access.token}` } },
    );
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { googleEventId: null },
    });
  } catch (err) {
    logger.warn({ err, appointmentId }, "calendar event delete threw");
  }
}
