"use client";

import { useActionState, useState } from "react";
import { Download } from "lucide-react";
import { deleteOrganization } from "../actions";
import { Button, Field, Input } from "@/components/ui";

export function DangerZoneCard({ orgName }: { orgName: string }) {
  const [armed, setArmed] = useState(false);
  const [state, formAction, pending] = useActionState(deleteOrganization, undefined);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="text-[13px] font-medium">Export all data</div>
          <p className="text-[12px] text-ink-mid">
            Everything — customers, conversations, leads, products, knowledge — as one JSON file.
          </p>
        </div>
        <a
          href="/api/v1/org/export"
          download
          className="inline-flex items-center gap-1.5 h-8 px-3 text-[12.5px] font-medium bg-hover border border-line rounded-[9px] hover:border-line-strong"
        >
          <Download size={14} />
          Download
        </a>
      </div>

      <div className="border-t border-danger/20 pt-5">
        <div className="text-[13px] font-medium text-danger">Delete this organization</div>
        <p className="text-[12px] text-ink-mid mt-0.5 mb-3">
          Permanently removes the workspace and every conversation, customer, lead, product and
          appointment in it. This cannot be undone — export your data first.
        </p>
        {!armed ? (
          <Button variant="secondary" onClick={() => setArmed(true)}
            className="border-danger/30 text-danger hover:bg-danger-soft">
            Delete organization…
          </Button>
        ) : (
          <form action={formAction} className="space-y-3 max-w-[420px]">
            <Field label={`Type the business name (${orgName}) to confirm`}>
              <Input name="confirmName" placeholder={orgName} autoComplete="off" required />
            </Field>
            <Field label="Your password">
              <Input name="password" type="password" autoComplete="current-password" required />
            </Field>
            {state?.error && (
              <p className="text-[12.5px] text-danger bg-danger-soft border border-danger/15 rounded-lg px-3 py-2">
                {state.error}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={pending}
                className="bg-danger hover:bg-danger/90 text-white">
                {pending ? "Deleting…" : "Permanently delete everything"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setArmed(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
