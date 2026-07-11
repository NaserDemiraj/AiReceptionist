"use client";

import { useActionState } from "react";
import { updateWidgetSettings } from "../actions";
import { Button, Field, Select } from "@/components/ui";
import { Toggle } from "@/features/ai-config/components/persona-form";

export function WidgetSettingsForm({
  initial,
}: {
  initial: { widgetColor: string; widgetPosition: string; showBranding: boolean };
}) {
  const [state, formAction, pending] = useActionState(updateWidgetSettings, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Accent color">
          <div className="flex items-center gap-2">
            <input
              type="color"
              name="widgetColor"
              defaultValue={initial.widgetColor}
              className="w-[52px] h-[40px] p-1 bg-card border border-line rounded-[10px] cursor-pointer"
            />
            <span className="font-mono text-[11.5px] text-ink-soft">
              button, header &amp; bubbles
            </span>
          </div>
        </Field>
        <Field label="Position on the page">
          <Select name="widgetPosition" defaultValue={initial.widgetPosition}>
            <option value="right">Bottom right</option>
            <option value="left">Bottom left</option>
          </Select>
        </Field>
      </div>
      <Toggle
        name="showBranding"
        label={'Show "Powered by AI Receptionist"'}
        hint="White-label plans can hide this."
        defaultChecked={initial.showBranding}
      />
      {state?.error && (
        <p className="text-[12.5px] text-danger bg-danger-soft border border-danger/15 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="text-[12.5px] text-positive-strong bg-positive-soft border border-positive-line rounded-lg px-3 py-2">
          Saved — reload any page using the widget to see it.
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save widget settings"}
      </Button>
    </form>
  );
}
