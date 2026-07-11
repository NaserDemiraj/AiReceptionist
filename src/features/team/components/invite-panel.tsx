"use client";

import { useState } from "react";
import { Check, Copy, Trash2, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { createInvite, revokeInvite } from "../actions";
import { Badge, Button, Card, Select } from "@/components/ui";

export interface PendingInvite {
  id: string;
  token: string;
  role: string;
  expiresAt: string; // ISO
}

function CopyLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const url = `${window.location.origin}/invite/${token}`;
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent hover:text-accent-strong cursor-pointer"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "Copied!" : "Copy link"}
    </button>
  );
}

export function InvitePanel({ invites }: { invites: PendingInvite[] }) {
  return (
    <Card className="max-w-[760px] p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-[10px] bg-accent-soft text-accent flex items-center justify-center">
          <UserPlus size={16} />
        </div>
        <div>
          <div className="text-[14px] font-semibold">Invite a team member</div>
          <div className="text-[11.5px] text-ink-soft">
            Generate a link and send it over WhatsApp, email — anything. Valid 7 days.
          </div>
        </div>
      </div>

      <form action={createInvite} className="flex items-center gap-2.5">
        <Select name="role" defaultValue="AGENT" className="max-w-[200px]">
          <option value="AGENT">Agent — handles conversations</option>
          <option value="ADMIN">Admin — full access</option>
        </Select>
        <Button type="submit">
          <UserPlus size={14} />
          Create invite link
        </Button>
      </form>

      {invites.length > 0 && (
        <div className="mt-5 border-t border-line pt-4 space-y-2.5">
          {invites.map((inv) => (
            <div key={inv.id} className="flex items-center gap-3">
              <Badge tone={inv.role === "ADMIN" ? "positive" : "neutral"}>{inv.role}</Badge>
              <code className="font-mono text-[11px] text-ink-soft truncate flex-1">
                /invite/{inv.token}
              </code>
              <span className="text-[11px] text-ink-soft hidden sm:block">
                expires {format(new Date(inv.expiresAt), "MMM d")}
              </span>
              <CopyLinkButton token={inv.token} />
              <form action={revokeInvite}>
                <input type="hidden" name="inviteId" value={inv.id} />
                <button
                  type="submit"
                  title="Revoke invite"
                  className="w-7 h-7 flex items-center justify-center rounded-md text-ink-soft hover:text-danger hover:bg-danger-soft cursor-pointer"
                >
                  <Trash2 size={13} />
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
