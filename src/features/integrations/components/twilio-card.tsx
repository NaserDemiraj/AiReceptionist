"use client";

import { useActionState } from "react";
import { PhoneMissed } from "lucide-react";
import { Badge, Button, Card, Field, Input } from "@/components/ui";
import { connectTwilio, disconnectChannel } from "../actions";
import { CopyField, Feedback } from "./form-bits";

export interface TwilioIntegrationView {
  status: "CONNECTED" | "ERROR" | "DISCONNECTED";
  phoneNumber: string;
  forwardTo: string;
  voiceUrl: string;
  smsUrl: string;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  lastError: string | null;
}

const STATUS_META = {
  CONNECTED: { label: "Connected", tone: "positive" as const },
  ERROR: { label: "Error", tone: "danger" as const },
  DISCONNECTED: { label: "Disconnected", tone: "neutral" as const },
};

function ConnectForm() {
  const [state, action, pending] = useActionState(connectTwilio, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Twilio Account SID">
          <Input name="accountSid" placeholder="AC…" required />
        </Field>
        <Field label="Auth token">
          <Input name="authToken" type="password" required />
        </Field>
        <Field label="Twilio phone number">
          <Input name="phoneNumber" placeholder="+35569000000" required />
        </Field>
        <Field label="Forward calls to (your real phone)">
          <Input name="forwardTo" placeholder="+355691234567" required />
        </Field>
      </div>
      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Connecting…" : "Connect phone"}
      </Button>
    </form>
  );
}

export function TwilioCard({
  integration,
  canManage,
}: {
  integration: TwilioIntegrationView | null;
  canManage: boolean;
}) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-[10px] bg-warn-soft text-warn flex items-center justify-center">
          <PhoneMissed size={18} />
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-semibold">Phone &amp; missed call recovery</div>
          <div className="text-[12.5px] text-ink-mid">
            Calls forward to your phone. Miss one, and the AI texts the caller back instantly.
          </div>
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
            <li>Buy a phone number at <span className="font-mono text-[12px]">twilio.com</span> (voice + SMS capable).</li>
            <li>Copy the Account SID and Auth Token from the Twilio Console dashboard.</li>
            <li>Connect below — you&apos;ll get webhook URLs to paste into the number&apos;s settings.</li>
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
            <CopyField label="Voice webhook (A call comes in)" value={integration.voiceUrl} />
            <CopyField label="SMS webhook (A message comes in)" value={integration.smsUrl} />
          </div>
          <p className="text-[12.5px] text-ink-mid bg-hover rounded-[8px] px-3 py-2">
            Twilio number <span className="font-mono">{integration.phoneNumber}</span> forwards to{" "}
            <span className="font-mono">{integration.forwardTo}</span>
            {integration.lastInboundAt && <> · Last inbound: {integration.lastInboundAt}</>}
            {integration.lastOutboundAt && <> · Last outbound: {integration.lastOutboundAt}</>}
          </p>
          <div className="pt-1 border-t border-line flex justify-end">
            <form action={disconnectChannel}>
              <input type="hidden" name="channel" value="SMS" />
              <Button type="submit" variant="ghost" className="text-danger">Disconnect</Button>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}
