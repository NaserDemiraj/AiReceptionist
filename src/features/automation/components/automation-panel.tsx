"use client";

import { useActionState, useState, useTransition } from "react";
import { Play } from "lucide-react";
import { updateAutomationSettings, type AiConfigFormState } from "@/features/ai-config/actions";
import { Toggle, Feedback } from "@/features/ai-config/components/persona-form";
import { runAutomationsNow, type RunState } from "../actions";
import { Button, Field, Input } from "@/components/ui";

export function AutomationSettingsForm({
  initial,
}: {
  initial: { remindersEnabled: boolean; followUpsEnabled: boolean; followUpAfterHours: number };
}) {
  const [state, formAction, pending] = useActionState<AiConfigFormState, FormData>(
    updateAutomationSettings,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <Toggle
        name="remindersEnabled"
        label="Appointment reminders"
        hint="Message customers automatically when their visit is within 24 hours."
        defaultChecked={initial.remindersEnabled}
      />
      <Toggle
        name="followUpsEnabled"
        label="Lead follow-ups"
        hint="If a lead goes quiet after the AI's reply, send one friendly nudge."
        defaultChecked={initial.followUpsEnabled}
      />
      <Field label="Follow up after (hours of silence)">
        <Input
          name="followUpAfterHours"
          type="number"
          min={1}
          max={168}
          defaultValue={initial.followUpAfterHours}
          className="w-32"
        />
      </Field>
      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}

export function RunNowButton() {
  const [result, setResult] = useState<RunState>(undefined);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="secondary"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setResult(await runAutomationsNow());
          })
        }
      >
        <Play size={14} />
        {isPending ? "Running…" : "Run automations now"}
      </Button>
      {result && !result.error && (
        <span className="text-[12.5px] text-ink-mid">
          Sent {result.remindersSent ?? 0} reminder{result.remindersSent === 1 ? "" : "s"} and{" "}
          {result.followUpsSent ?? 0} follow-up{result.followUpsSent === 1 ? "" : "s"}.
        </span>
      )}
    </div>
  );
}
