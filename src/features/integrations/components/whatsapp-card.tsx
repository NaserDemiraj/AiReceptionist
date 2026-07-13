"use client";

import { useActionState } from "react";
import { MessageCircle } from "lucide-react";
import { Badge, Button, Card, Field, Input } from "@/components/ui";
import { connectWhatsApp, disconnectWhatsApp, sendWhatsAppTest } from "../actions";
import { CopyField, Feedback } from "./form-bits";

export interface WhatsAppIntegrationView {
  status: "CONNECTED" | "ERROR" | "DISCONNECTED";
  phoneNumberId: string;
  verifyToken: string;
  webhookUrl: string;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  lastError: string | null;
}

function ConnectForm() {
  const [state, action, pending] = useActionState(connectWhatsApp, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="Phone number ID">
        <Input name="phoneNumberId" placeholder="e.g. 106540352242922" required />
      </Field>
      <Field label="Access token">
        <Input name="accessToken" type="password" placeholder="Permanent system-user token" required />
      </Field>
      <Field label="App secret">
        <Input name="appSecret" type="password" placeholder="From Meta App Settings → Basic" required />
      </Field>
      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Connecting…" : "Connect WhatsApp"}
      </Button>
    </form>
  );
}

function TestSendForm() {
  const [state, action, pending] = useActionState(sendWhatsAppTest, undefined);
  return (
    <form action={action} className="space-y-3">
      <Field label="Send a test message">
        <div className="flex gap-2">
          <Input name="phone" placeholder="+355 69 123 4567" required />
          <Button type="submit" variant="secondary" disabled={pending} className="shrink-0">
            {pending ? "Sending…" : "Send test"}
          </Button>
        </div>
      </Field>
      <Feedback state={state} />
    </form>
  );
}

const STATUS_META = {
  CONNECTED: { label: "Connected", tone: "positive" as const },
  ERROR: { label: "Error", tone: "danger" as const },
  DISCONNECTED: { label: "Disconnected", tone: "neutral" as const },
};

export function WhatsAppCard({
  integration,
  canManage,
}: {
  integration: WhatsAppIntegrationView | null;
  canManage: boolean;
}) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-[10px] bg-positive-soft text-positive-strong flex items-center justify-center">
          <MessageCircle size={18} />
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-semibold">WhatsApp Business</div>
          <div className="text-[12.5px] text-ink-mid">
            Customers message your WhatsApp number — the AI answers 24/7.
          </div>
        </div>
        {integration ? (
          <Badge tone={STATUS_META[integration.status].tone}>
            {STATUS_META[integration.status].label}
          </Badge>
        ) : (
          <Badge tone="neutral">Not connected</Badge>
        )}
      </div>

      {!canManage ? (
        <p className="text-[13px] text-ink-mid">
          Ask an owner or admin to manage this integration.
        </p>
      ) : !integration ? (
        <div className="space-y-5">
          <ol className="text-[13px] text-ink-mid space-y-1.5 list-decimal pl-5">
            <li>
              Create a Meta app with the <strong>WhatsApp</strong> product at{" "}
              <span className="font-mono text-[12px]">developers.facebook.com</span>.
            </li>
            <li>
              From <strong>WhatsApp → API Setup</strong>, copy the phone number ID and generate a
              permanent access token.
            </li>
            <li>
              Copy the app secret from <strong>App Settings → Basic</strong>, then connect below —
              you&apos;ll get the webhook URL to paste back into Meta.
            </li>
          </ol>
          <ConnectForm />
        </div>
      ) : (
        <div className="space-y-5">
          {integration.lastError && (
            <p className="text-[12.5px] text-danger bg-danger-soft rounded-[8px] px-3 py-2">
              Last error: {integration.lastError}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <CopyField label="Webhook URL (paste into Meta → WhatsApp → Configuration)" value={integration.webhookUrl} />
            <CopyField label="Verify token" value={integration.verifyToken} />
          </div>

          <p className="text-[12.5px] text-ink-mid bg-hover rounded-[8px] px-3 py-2">
            In Meta&apos;s webhook configuration, subscribe to the <strong>messages</strong> field.
            Phone number ID: <span className="font-mono">{integration.phoneNumberId}</span>
            {integration.lastInboundAt && <> · Last inbound: {integration.lastInboundAt}</>}
            {integration.lastOutboundAt && <> · Last outbound: {integration.lastOutboundAt}</>}
          </p>

          <TestSendForm />

          <div className="pt-1 border-t border-line flex justify-end">
            <form action={disconnectWhatsApp}>
              <Button type="submit" variant="ghost" className="text-danger">
                Disconnect
              </Button>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}
