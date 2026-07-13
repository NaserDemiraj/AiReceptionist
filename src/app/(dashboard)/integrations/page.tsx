import { format } from "date-fns";
import { Calendar } from "lucide-react";
import type { Channel, ChannelIntegration } from "@prisma/client";
import { Badge, Button, Card } from "@/components/ui";
import { Topbar } from "@/components/layout/topbar";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/lib/base-url";
import { parseWhatsAppCredentials } from "@/lib/channels/whatsapp";
import { parseTwilioCredentials } from "@/lib/channels/twilio";
import { parseMessengerCredentials } from "@/lib/channels/messenger";
import { isGoogleCalendarConfigured } from "@/lib/integrations/google-calendar";
import { disconnectGoogleCalendar } from "@/features/integrations/actions";
import { WhatsAppCard, type WhatsAppIntegrationView } from "@/features/integrations/components/whatsapp-card";
import { TwilioCard, type TwilioIntegrationView } from "@/features/integrations/components/twilio-card";
import { MessengerCard, type MessengerIntegrationView } from "@/features/integrations/components/messenger-card";
import { ApiCard } from "@/features/integrations/components/api-card";

export const metadata = { title: "Integrations" };

const fmt = (d: Date | null) => (d ? format(d, "MMM d, HH:mm") : null);

function whatsAppView(record: ChannelIntegration | undefined, baseUrl: string): WhatsAppIntegrationView | null {
  const creds = parseWhatsAppCredentials(record?.credentials);
  if (!record || !creds) return null;
  return {
    status: record.status,
    phoneNumberId: creds.phoneNumberId,
    verifyToken: creds.verifyToken,
    webhookUrl: `${baseUrl}/api/v1/channels/whatsapp/webhook/${record.id}`,
    lastInboundAt: fmt(record.lastInboundAt),
    lastOutboundAt: fmt(record.lastOutboundAt),
    lastError: record.lastError,
  };
}

function twilioView(record: ChannelIntegration | undefined, baseUrl: string): TwilioIntegrationView | null {
  const creds = parseTwilioCredentials(record?.credentials);
  if (!record || !creds) return null;
  return {
    status: record.status,
    phoneNumber: creds.phoneNumber,
    forwardTo: creds.forwardTo,
    voiceUrl: `${baseUrl}/api/v1/channels/twilio/${record.id}/voice`,
    smsUrl: `${baseUrl}/api/v1/channels/twilio/${record.id}/sms`,
    lastInboundAt: fmt(record.lastInboundAt),
    lastOutboundAt: fmt(record.lastOutboundAt),
    lastError: record.lastError,
  };
}

function messengerView(record: ChannelIntegration | undefined, baseUrl: string): MessengerIntegrationView | null {
  const creds = parseMessengerCredentials(record?.credentials);
  if (!record || !creds) return null;
  return {
    status: record.status,
    pageId: creds.pageId,
    verifyToken: creds.verifyToken,
    webhookUrl: `${baseUrl}/api/v1/channels/messenger/webhook/${record.id}`,
    lastInboundAt: fmt(record.lastInboundAt),
    lastOutboundAt: fmt(record.lastOutboundAt),
    lastError: record.lastError,
  };
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const { org, role } = await requireOrg();
  const { google } = await searchParams;
  const canManage = role !== "AGENT";
  const baseUrl = await getBaseUrl();

  const [channels, googleConn, apiKeys, webhookEndpoints] = await Promise.all([
    prisma.channelIntegration.findMany({ where: { organizationId: org.id } }),
    prisma.googleCalendarConnection.findUnique({ where: { organizationId: org.id } }),
    prisma.apiKey.findMany({ where: { organizationId: org.id }, orderBy: { createdAt: "desc" } }),
    prisma.webhookEndpoint.findMany({ where: { organizationId: org.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const byChannel = new Map<Channel, ChannelIntegration>(channels.map((c) => [c.channel, c]));

  return (
    <>
      <Topbar title="Integrations" />
      <div className="flex-1 overflow-y-auto px-[26px] pt-6 pb-10">
        <div className="max-w-[760px] space-y-5">
          {google === "connected" && (
            <p className="text-[13px] text-positive-strong bg-positive-soft border border-positive/20 rounded-[10px] px-3.5 py-3">
              Google Calendar connected — new appointments now appear in your calendar.
            </p>
          )}
          {google && google !== "connected" && (
            <p className="text-[13px] text-danger bg-danger-soft rounded-[10px] px-3.5 py-3">
              Google Calendar connection failed ({google.replace(/_/g, " ")}). Please try again.
            </p>
          )}

          <WhatsAppCard integration={whatsAppView(byChannel.get("WHATSAPP"), baseUrl)} canManage={canManage} />
          <TwilioCard integration={twilioView(byChannel.get("SMS"), baseUrl)} canManage={canManage} />
          <MessengerCard
            channel="FACEBOOK"
            integration={messengerView(byChannel.get("FACEBOOK"), baseUrl)}
            canManage={canManage}
          />
          <MessengerCard
            channel="INSTAGRAM"
            integration={messengerView(byChannel.get("INSTAGRAM"), baseUrl)}
            canManage={canManage}
          />

          {/* Google Calendar */}
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[10px] bg-accent-soft text-accent flex items-center justify-center">
                <Calendar size={18} />
              </div>
              <div className="flex-1">
                <div className="text-[15px] font-semibold">Google Calendar</div>
                <div className="text-[12.5px] text-ink-mid">
                  {googleConn
                    ? `Appointments sync to ${googleConn.email ?? "your calendar"}.`
                    : "Push booked appointments straight into your calendar."}
                </div>
              </div>
              {googleConn ? (
                <>
                  <Badge tone={googleConn.lastError ? "danger" : "positive"}>
                    {googleConn.lastError ? "Error" : "Connected"}
                  </Badge>
                  {canManage && (
                    <form action={disconnectGoogleCalendar}>
                      <Button type="submit" variant="ghost" className="text-danger">Disconnect</Button>
                    </form>
                  )}
                </>
              ) : canManage && isGoogleCalendarConfigured() ? (
                <a href="/api/v1/integrations/google/authorize">
                  <Button type="button">Connect Google</Button>
                </a>
              ) : (
                <Badge tone="neutral">{isGoogleCalendarConfigured() ? "Not connected" : "Needs setup"}</Badge>
              )}
            </div>
            {!isGoogleCalendarConfigured() && (
              <p className="mt-4 text-[12.5px] text-ink-mid bg-hover rounded-[8px] px-3 py-2">
                Add <span className="font-mono text-[12px]">GOOGLE_CLIENT_ID</span> and{" "}
                <span className="font-mono text-[12px]">GOOGLE_CLIENT_SECRET</span> to enable this.
              </p>
            )}
          </Card>

          <ApiCard
            canManage={canManage}
            keys={apiKeys.map((k) => ({
              id: k.id,
              name: k.name,
              prefix: k.prefix,
              lastUsedAt: fmt(k.lastUsedAt),
              revoked: Boolean(k.revokedAt),
            }))}
            endpoints={webhookEndpoints.map((e) => ({
              id: e.id,
              url: e.url,
              secret: e.secret,
              events: e.events,
              lastStatus: e.lastStatus,
              lastFiredAt: fmt(e.lastFiredAt),
            }))}
          />
        </div>
      </div>
    </>
  );
}
