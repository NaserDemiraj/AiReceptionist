"use client";

import { useActionState } from "react";
import { KeyRound, Trash2, Webhook } from "lucide-react";
import { Badge, Button, Card, Field, Input } from "@/components/ui";
import {
  addWebhookEndpoint,
  createApiKey,
  deleteWebhookEndpoint,
  revokeApiKey,
} from "../actions";
import { CopyField, Feedback } from "./form-bits";

export interface ApiKeyView {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  revoked: boolean;
}

export interface WebhookEndpointView {
  id: string;
  url: string;
  secret: string;
  events: string[];
  lastStatus: number | null;
  lastFiredAt: string | null;
}

const EVENT_OPTIONS = [
  { value: "lead.created", label: "Lead created" },
  { value: "appointment.created", label: "Appointment booked" },
  { value: "appointment.cancelled", label: "Appointment cancelled" },
  { value: "conversation.needs_human", label: "Human handoff requested" },
];

function CreateKeyForm() {
  const [state, action, pending] = useActionState(createApiKey, undefined);
  return (
    <div className="space-y-3">
      <form action={action} className="flex items-end gap-2">
        <div className="flex-1">
          <Field label="Create a new API key">
            <Input name="name" placeholder="Key name, e.g. 'Shopify sync'" required />
          </Field>
        </div>
        <Button type="submit" variant="secondary" disabled={pending} className="shrink-0">
          {pending ? "Creating…" : "Create key"}
        </Button>
      </form>
      {state?.error && (
        <p className="text-[12.5px] text-danger bg-danger-soft rounded-[8px] px-3 py-2">{state.error}</p>
      )}
      {state?.plaintextKey && (
        <div className="bg-warn-soft border border-warn/20 rounded-[10px] p-3.5 space-y-2">
          <p className="text-[12.5px] text-warn font-semibold">
            Copy this key now — it won&apos;t be shown again.
          </p>
          <CopyField label="API key" value={state.plaintextKey} />
        </div>
      )}
    </div>
  );
}

function AddWebhookForm() {
  const [state, action, pending] = useActionState(addWebhookEndpoint, undefined);
  return (
    <form action={action} className="space-y-3">
      <Field label="Add a webhook endpoint">
        <Input name="url" type="url" placeholder="https://your-system.com/hooks/ai-receptionist" required />
      </Field>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {EVENT_OPTIONS.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 text-[12.5px] text-ink-mid cursor-pointer">
            <input type="checkbox" name={`event:${opt.value}`} className="accent-accent" />
            {opt.label}
          </label>
        ))}
      </div>
      <Feedback state={state} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Adding…" : "Add webhook"}
      </Button>
    </form>
  );
}

export function ApiCard({
  keys,
  endpoints,
  canManage,
}: {
  keys: ApiKeyView[];
  endpoints: WebhookEndpointView[];
  canManage: boolean;
}) {
  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-[10px] bg-accent-soft text-accent flex items-center justify-center">
          <KeyRound size={18} />
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-semibold">REST API &amp; webhooks</div>
          <div className="text-[12.5px] text-ink-mid">
            Sync your product catalog from any CMS and push events to your own systems.
          </div>
        </div>
      </div>

      <div className="text-[12.5px] text-ink-mid bg-hover rounded-[8px] px-3 py-2 font-mono">
        GET/POST /api/v1/products — header: Authorization: Bearer &lt;key&gt;
      </div>

      {!canManage ? (
        <p className="text-[13px] text-ink-mid">Ask an owner or admin to manage API access.</p>
      ) : (
        <>
          {/* API keys */}
          <div className="space-y-3">
            {keys.length > 0 && (
              <ul className="divide-y divide-line border border-line rounded-[10px]">
                {keys.map((k) => (
                  <li key={k.id} className="flex items-center gap-3 px-3.5 py-2.5">
                    <span className="text-[13px] font-medium flex-1">{k.name}</span>
                    <span className="font-mono text-[12px] text-ink-soft">{k.prefix}…</span>
                    {k.revoked ? (
                      <Badge tone="neutral">Revoked</Badge>
                    ) : (
                      <>
                        <span className="text-[11.5px] text-ink-soft">
                          {k.lastUsedAt ? `Used ${k.lastUsedAt}` : "Never used"}
                        </span>
                        <form action={revokeApiKey}>
                          <input type="hidden" name="keyId" value={k.id} />
                          <Button type="submit" variant="ghost" className="h-[30px] px-2 text-danger text-[12px]">
                            Revoke
                          </Button>
                        </form>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <CreateKeyForm />
          </div>

          {/* Webhook endpoints */}
          <div className="space-y-3 pt-4 border-t border-line">
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              <Webhook size={15} className="text-ink-mid" /> Outbound webhooks
            </div>
            {endpoints.length > 0 && (
              <ul className="divide-y divide-line border border-line rounded-[10px]">
                {endpoints.map((e) => (
                  <li key={e.id} className="px-3.5 py-2.5 space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-[12.5px] font-mono flex-1 truncate">{e.url}</span>
                      {e.lastStatus !== null && (
                        <Badge tone={e.lastStatus >= 200 && e.lastStatus < 300 ? "positive" : "danger"}>
                          {e.lastStatus}
                        </Badge>
                      )}
                      <form action={deleteWebhookEndpoint}>
                        <input type="hidden" name="endpointId" value={e.id} />
                        <Button type="submit" variant="ghost" className="h-[30px] w-[30px] px-0 text-danger" aria-label="Delete webhook">
                          <Trash2 size={14} />
                        </Button>
                      </form>
                    </div>
                    <div className="text-[11.5px] text-ink-soft">
                      {e.events.join(", ")} · secret: <span className="font-mono">{e.secret}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <AddWebhookForm />
          </div>
        </>
      )}
    </Card>
  );
}
