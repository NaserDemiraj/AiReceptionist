"use client";

import { useActionState } from "react";
import { Camera, MessageSquare } from "lucide-react";
import { Badge, Button, Card, Field, Input } from "@/components/ui";
import { connectMessenger, disconnectChannel } from "../actions";
import { CopyField, Feedback } from "./form-bits";

export interface MessengerIntegrationView {
  status: "CONNECTED" | "ERROR" | "DISCONNECTED";
  pageId: string;
  verifyToken: string;
  webhookUrl: string;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  lastError: string | null;
}

const CHANNEL_META = {
  FACEBOOK: {
    title: "Facebook Messenger",
    hint: "The AI answers your Facebook Page's messages 24/7.",
    icon: MessageSquare,
    field: "messages",
  },
  INSTAGRAM: {
    title: "Instagram DMs",
    hint: "The AI answers Instagram direct messages 24/7.",
    icon: Camera,
    field: "instagram messages",
  },
};

const STATUS_META = {
  CONNECTED: { label: "Connected", tone: "positive" as const },
  ERROR: { label: "Error", tone: "danger" as const },
  DISCONNECTED: { label: "Disconnected", tone: "neutral" as const },
};

function ConnectForm({ channel }: { channel: "FACEBOOK" | "INSTAGRAM" }) {
  const [state, action, pending] = useActionState(connectMessenger, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="channel" value={channel} />
      <Field label="Facebook Page ID">
        <Input name="pageId" placeholder="e.g. 104857203919325" required />
      </Field>
      <Field label="Page access token">
        <Input name="pageAccessToken" type="password" placeholder="From Meta → Messenger API settings" required />
      </Field>
      <Field label="App secret">
        <Input name="appSecret" type="password" placeholder="From Meta App Settings → Basic" required />
      </Field>
      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Connecting…" : "Connect"}
      </Button>
    </form>
  );
}

export function MessengerCard({
  channel,
  integration,
  canManage,
}: {
  channel: "FACEBOOK" | "INSTAGRAM";
  integration: MessengerIntegrationView | null;
  canManage: boolean;
}) {
  const meta = CHANNEL_META[channel];
  const Icon = meta.icon;
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-[10px] bg-accent-soft text-accent flex items-center justify-center">
          <Icon size={18} />
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-semibold">{meta.title}</div>
          <div className="text-[12.5px] text-ink-mid">{meta.hint}</div>
        </div>
        {integration ? (
          <Badge tone={STATUS_META[integration.status].tone}>{STATUS_META[integration.status].label}</Badge>
        ) : (
          <Badge tone="neutral">Not connected</Badge>
        )}
      </div>

      {!canManage ? (
        <p className="text-[13px] text-ink-mid">Ask an owner or admin to manage this integration.</p>
      ) : !integration ? (
        <div className="space-y-5">
          <ol className="text-[13px] text-ink-mid space-y-1.5 list-decimal pl-5">
            <li>
              In your Meta app, add the <strong>Messenger</strong> product and link your Facebook
              Page{channel === "INSTAGRAM" ? " (with the Instagram account connected to it)" : ""}.
            </li>
            <li>Generate a Page access token and copy the numeric Page ID.</li>
            <li>Connect below — you&apos;ll get the webhook URL to paste back into Meta.</li>
          </ol>
          <ConnectForm channel={channel} />
        </div>
      ) : (
        <div className="space-y-5">
          {integration.lastError && (
            <p className="text-[12.5px] text-danger bg-danger-soft rounded-[8px] px-3 py-2">
              Last error: {integration.lastError}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <CopyField label="Webhook URL (Meta → Messenger → Webhooks)" value={integration.webhookUrl} />
            <CopyField label="Verify token" value={integration.verifyToken} />
          </div>
          <p className="text-[12.5px] text-ink-mid bg-hover rounded-[8px] px-3 py-2">
            Subscribe to the <strong>{meta.field}</strong> webhook field. Page ID:{" "}
            <span className="font-mono">{integration.pageId}</span>
            {integration.lastInboundAt && <> · Last inbound: {integration.lastInboundAt}</>}
            {integration.lastOutboundAt && <> · Last outbound: {integration.lastOutboundAt}</>}
          </p>
          <div className="pt-1 border-t border-line flex justify-end">
            <form action={disconnectChannel}>
              <input type="hidden" name="channel" value={channel} />
              <Button type="submit" variant="ghost" className="text-danger">Disconnect</Button>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}
