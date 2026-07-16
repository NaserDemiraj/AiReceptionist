"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { Prisma, type Channel } from "@prisma/client";
import { z } from "zod";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { forbidden } from "@/lib/errors";
import { parseWhatsAppCredentials, sendWhatsAppText } from "@/lib/channels/whatsapp";
import { twilioCredentialsSchema } from "@/lib/channels/twilio";
import { parseMessengerCredentials } from "@/lib/channels/messenger";
import { generateApiKey } from "@/lib/api-auth";
import { sealCredentials } from "@/lib/credentials-crypto";
import { WEBHOOK_EVENTS, type WebhookEvent } from "@/lib/webhooks";
import { getSubscriptionAccess, isChannelAllowed, PLAN_LIMITS } from "@/lib/billing/plans";

export type IntegrationFormState = { error?: string; success?: string } | undefined;

const CHANNEL_NAMES: Partial<Record<Channel, string>> = {
  WHATSAPP: "WhatsApp",
  SMS: "Phone & SMS",
  FACEBOOK: "Facebook Messenger",
  INSTAGRAM: "Instagram DMs",
};

/** Returns an upgrade-nudge error when the org's plan doesn't include the channel. */
async function channelPlanError(orgId: string, channel: Channel): Promise<string | null> {
  const access = await getSubscriptionAccess(orgId);
  if (isChannelAllowed(access.planForLimits, channel)) return null;
  const neededPlan = PLAN_LIMITS.PROFESSIONAL.channels.includes(channel) ? "Professional" : "Business";
  return `${CHANNEL_NAMES[channel] ?? channel} is available on the ${neededPlan} plan — upgrade on the Billing page to connect it.`;
}

const connectSchema = z.object({
  phoneNumberId: z
    .string()
    .regex(/^\d{5,}$/, "Phone number ID is the numeric ID from Meta's API Setup page"),
  accessToken: z.string().min(20, "Paste the permanent access token from Meta"),
  appSecret: z.string().min(10, "Paste the app secret from Meta App Settings → Basic"),
});

export async function connectWhatsApp(
  _prev: IntegrationFormState,
  formData: FormData,
): Promise<IntegrationFormState> {
  const { org, user, role } = await requireOrg();
  if (role === "AGENT") throw forbidden("Only owners and admins can manage integrations");

  const planError = await channelPlanError(org.id, "WHATSAPP");
  if (planError) return { error: planError };

  const parsed = connectSchema.safeParse({
    phoneNumberId: (formData.get("phoneNumberId") as string | null)?.trim(),
    accessToken: (formData.get("accessToken") as string | null)?.trim(),
    appSecret: (formData.get("appSecret") as string | null)?.trim(),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  // Kept across reconnects so the Meta webhook config doesn't break
  const existing = await prisma.channelIntegration.findUnique({
    where: { organizationId_channel: { organizationId: org.id, channel: "WHATSAPP" } },
  });
  const verifyToken =
    parseWhatsAppCredentials(existing?.credentials)?.verifyToken ??
    `vt_${randomUUID().replace(/-/g, "")}`;

  const credentials = sealCredentials({ ...d, verifyToken }) as object;

  try {
    await prisma.$transaction([
      prisma.channelIntegration.upsert({
        where: { organizationId_channel: { organizationId: org.id, channel: "WHATSAPP" } },
        create: {
          organizationId: org.id,
          channel: "WHATSAPP",
          externalId: d.phoneNumberId,
          credentials,
          status: "CONNECTED",
        },
        update: {
          externalId: d.phoneNumberId,
          credentials,
          status: "CONNECTED",
          lastError: null,
        },
      }),
      prisma.auditLog.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          action: "integration.whatsapp.connect",
          entityType: "ChannelIntegration",
        },
      }),
    ]);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "That WhatsApp phone number is already connected to another account." };
    }
    throw err;
  }

  revalidatePath("/integrations");
  return { success: "WhatsApp connected. Now finish the webhook setup in Meta (steps below)." };
}

async function disconnectChannelFor(channel: Channel): Promise<void> {
  const { org, user, role } = await requireOrg();
  if (role === "AGENT") throw forbidden("Only owners and admins can manage integrations");

  await prisma.$transaction([
    prisma.channelIntegration.deleteMany({
      where: { organizationId: org.id, channel },
    }),
    prisma.auditLog.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        action: `integration.${channel.toLowerCase()}.disconnect`,
        entityType: "ChannelIntegration",
      },
    }),
  ]);

  revalidatePath("/integrations");
}

export async function disconnectWhatsApp(): Promise<void> {
  await disconnectChannelFor("WHATSAPP");
}

export async function disconnectChannel(formData: FormData): Promise<void> {
  const channel = z.enum(["SMS", "FACEBOOK", "INSTAGRAM"]).parse(formData.get("channel"));
  await disconnectChannelFor(channel);
}

/* ============ Twilio (phone + SMS, missed call recovery) ============ */

export async function connectTwilio(
  _prev: IntegrationFormState,
  formData: FormData,
): Promise<IntegrationFormState> {
  const { org, user, role } = await requireOrg();
  if (role === "AGENT") throw forbidden("Only owners and admins can manage integrations");

  const planError = await channelPlanError(org.id, "SMS");
  if (planError) return { error: planError };

  const parsed = twilioCredentialsSchema.safeParse({
    accountSid: (formData.get("accountSid") as string | null)?.trim(),
    authToken: (formData.get("authToken") as string | null)?.trim(),
    phoneNumber: (formData.get("phoneNumber") as string | null)?.trim(),
    forwardTo: (formData.get("forwardTo") as string | null)?.trim(),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const twilioCredentials = sealCredentials(parsed.data) as object;

  try {
    await prisma.$transaction([
      prisma.channelIntegration.upsert({
        where: { organizationId_channel: { organizationId: org.id, channel: "SMS" } },
        create: {
          organizationId: org.id,
          channel: "SMS",
          externalId: parsed.data.phoneNumber,
          credentials: twilioCredentials,
          status: "CONNECTED",
        },
        update: { externalId: parsed.data.phoneNumber, credentials: twilioCredentials, status: "CONNECTED", lastError: null },
      }),
      prisma.auditLog.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          action: "integration.sms.connect",
          entityType: "ChannelIntegration",
        },
      }),
    ]);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "That Twilio number is already connected to another account." };
    }
    throw err;
  }

  revalidatePath("/integrations");
  return { success: "Phone connected. Point your Twilio number's voice & SMS webhooks at the URLs shown." };
}

/* ============ Facebook / Instagram Messenger ============ */

const messengerConnectSchema = z.object({
  channel: z.enum(["FACEBOOK", "INSTAGRAM"]),
  pageId: z.string().regex(/^\d{5,}$/, "Page ID is the numeric ID of your Facebook Page"),
  pageAccessToken: z.string().min(20, "Paste the Page access token from Meta"),
  appSecret: z.string().min(10, "Paste the app secret from Meta App Settings → Basic"),
});

export async function connectMessenger(
  _prev: IntegrationFormState,
  formData: FormData,
): Promise<IntegrationFormState> {
  const { org, user, role } = await requireOrg();
  if (role === "AGENT") throw forbidden("Only owners and admins can manage integrations");

  const parsed = messengerConnectSchema.safeParse({
    channel: formData.get("channel"),
    pageId: (formData.get("pageId") as string | null)?.trim(),
    pageAccessToken: (formData.get("pageAccessToken") as string | null)?.trim(),
    appSecret: (formData.get("appSecret") as string | null)?.trim(),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { channel, ...creds } = parsed.data;

  const planError = await channelPlanError(org.id, channel);
  if (planError) return { error: planError };

  const existing = await prisma.channelIntegration.findUnique({
    where: { organizationId_channel: { organizationId: org.id, channel } },
  });
  const verifyToken =
    parseMessengerCredentials(existing?.credentials)?.verifyToken ??
    `vt_${randomUUID().replace(/-/g, "")}`;
  const messengerCredentials = sealCredentials({ ...creds, verifyToken }) as object;

  try {
    await prisma.$transaction([
      prisma.channelIntegration.upsert({
        where: { organizationId_channel: { organizationId: org.id, channel } },
        create: {
          organizationId: org.id,
          channel,
          externalId: creds.pageId,
          credentials: messengerCredentials,
          status: "CONNECTED",
        },
        update: {
          externalId: creds.pageId,
          credentials: messengerCredentials,
          status: "CONNECTED",
          lastError: null,
        },
      }),
      prisma.auditLog.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          action: `integration.${channel.toLowerCase()}.connect`,
          entityType: "ChannelIntegration",
        },
      }),
    ]);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "That Facebook Page is already connected to another account." };
    }
    throw err;
  }

  revalidatePath("/integrations");
  return { success: "Connected. Now finish the webhook setup in Meta (steps below)." };
}

/* ============ Google Calendar ============ */

export async function disconnectGoogleCalendar(): Promise<void> {
  const { org, user, role } = await requireOrg();
  if (role === "AGENT") throw forbidden("Only owners and admins can manage integrations");

  await prisma.$transaction([
    prisma.googleCalendarConnection.deleteMany({ where: { organizationId: org.id } }),
    prisma.auditLog.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        action: "integration.google_calendar.disconnect",
        entityType: "GoogleCalendarConnection",
      },
    }),
  ]);

  revalidatePath("/integrations");
}

/* ============ API keys ============ */

export type ApiKeyFormState = { error?: string; plaintextKey?: string } | undefined;

export async function createApiKey(
  _prev: ApiKeyFormState,
  formData: FormData,
): Promise<ApiKeyFormState> {
  const { org, user, role } = await requireOrg();
  if (role === "AGENT") throw forbidden("Only owners and admins can manage API keys");

  const name = z.string().min(2).max(60).safeParse((formData.get("name") as string | null)?.trim());
  if (!name.success) return { error: "Give the key a name (e.g. 'Shopify sync')" };

  const { key, hashedKey, prefix } = generateApiKey();
  await prisma.$transaction([
    prisma.apiKey.create({
      data: { organizationId: org.id, name: name.data, hashedKey, prefix },
    }),
    prisma.auditLog.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        action: "apikey.create",
        entityType: "ApiKey",
      },
    }),
  ]);

  revalidatePath("/integrations");
  return { plaintextKey: key };
}

export async function revokeApiKey(formData: FormData): Promise<void> {
  const { org, user, role } = await requireOrg();
  if (role === "AGENT") throw forbidden("Only owners and admins can manage API keys");
  const keyId = z.string().min(1).parse(formData.get("keyId"));

  await prisma.$transaction([
    prisma.apiKey.updateMany({
      where: { id: keyId, organizationId: org.id },
      data: { revokedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        action: "apikey.revoke",
        entityType: "ApiKey",
        entityId: keyId,
      },
    }),
  ]);

  revalidatePath("/integrations");
}

/* ============ Outbound webhook endpoints ============ */

export async function addWebhookEndpoint(
  _prev: IntegrationFormState,
  formData: FormData,
): Promise<IntegrationFormState> {
  const { org, user, role } = await requireOrg();
  if (role === "AGENT") throw forbidden("Only owners and admins can manage webhooks");

  const url = z.string().url("Enter a full https:// URL").safeParse((formData.get("url") as string | null)?.trim());
  if (!url.success) return { error: url.error.issues[0].message };

  const events = WEBHOOK_EVENTS.filter((e) => formData.get(`event:${e}`) === "on") as WebhookEvent[];
  if (events.length === 0) return { error: "Pick at least one event to subscribe to." };

  await prisma.$transaction([
    prisma.webhookEndpoint.create({
      data: {
        organizationId: org.id,
        url: url.data,
        secret: `whsec_${randomUUID().replace(/-/g, "")}`,
        events,
      },
    }),
    prisma.auditLog.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        action: "webhook.create",
        entityType: "WebhookEndpoint",
      },
    }),
  ]);

  revalidatePath("/integrations");
  return { success: "Webhook added — the signing secret is shown in the list." };
}

export async function deleteWebhookEndpoint(formData: FormData): Promise<void> {
  const { org, user, role } = await requireOrg();
  if (role === "AGENT") throw forbidden("Only owners and admins can manage webhooks");
  const endpointId = z.string().min(1).parse(formData.get("endpointId"));

  await prisma.$transaction([
    prisma.webhookEndpoint.deleteMany({ where: { id: endpointId, organizationId: org.id } }),
    prisma.auditLog.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        action: "webhook.delete",
        entityType: "WebhookEndpoint",
        entityId: endpointId,
      },
    }),
  ]);

  revalidatePath("/integrations");
}

const testSchema = z.object({
  phone: z
    .string()
    .regex(/^\+?[\d\s]{8,20}$/, "Enter a phone number in international format, e.g. +355 69 123 4567"),
});

export async function sendWhatsAppTest(
  _prev: IntegrationFormState,
  formData: FormData,
): Promise<IntegrationFormState> {
  const { org, role } = await requireOrg();
  if (role === "AGENT") throw forbidden("Only owners and admins can manage integrations");

  const parsed = testSchema.safeParse({ phone: (formData.get("phone") as string | null)?.trim() });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const integration = await prisma.channelIntegration.findUnique({
    where: { organizationId_channel: { organizationId: org.id, channel: "WHATSAPP" } },
  });
  const creds = parseWhatsAppCredentials(integration?.credentials);
  if (!integration || !creds) return { error: "WhatsApp is not connected." };

  const result = await sendWhatsAppText(
    creds,
    parsed.data.phone,
    `👋 Test message from ${org.name} — your AI Receptionist WhatsApp connection works!`,
  );

  await prisma.channelIntegration.update({
    where: { id: integration.id },
    data: result.ok
      ? { lastOutboundAt: new Date(), status: "CONNECTED", lastError: null }
      : { status: "ERROR", lastError: result.error ?? "send_failed" },
  });

  revalidatePath("/integrations");
  if (!result.ok) {
    return {
      error:
        "Send failed — check the access token and phone number ID. (Note: with a test number, the recipient must first be added to Meta's allowed list.)",
    };
  }
  return { success: "Test message sent! Check the phone." };
}
