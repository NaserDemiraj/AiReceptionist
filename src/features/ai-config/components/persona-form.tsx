"use client";

import { useActionState } from "react";
import { updateAiConfig, type AiConfigFormState } from "../actions";
import { Button, Field, Input, Select, cx } from "@/components/ui";

const TONES = [
  ["friendly-professional", "Friendly & professional"],
  ["warm-casual", "Warm & casual"],
  ["formal", "Formal"],
  ["energetic", "Energetic & salesy"],
] as const;

export function Feedback({ state }: { state: AiConfigFormState }) {
  if (!state) return null;
  if (state.error) {
    return (
      <p className="text-[12.5px] text-danger bg-danger-soft border border-danger/15 rounded-lg px-3 py-2">
        {state.error}
      </p>
    );
  }
  return (
    <p className="text-[12.5px] text-positive-strong bg-positive-soft border border-positive-line rounded-lg px-3 py-2">
      Saved — takes effect on the very next customer message.
    </p>
  );
}

export function Toggle({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span
        className={cx(
          "mt-0.5 w-9 h-5 rounded-full relative transition-colors shrink-0",
          "bg-line-strong peer-checked:bg-accent",
          "after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-transform peer-checked:after:translate-x-4",
        )}
      />
      <span>
        <span className="block text-[13px] font-medium text-ink">{label}</span>
        {hint && <span className="block text-[11.5px] text-ink-soft mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}

export function PersonaForm({
  initial,
}: {
  initial: {
    assistantName: string;
    greeting: string;
    tone: string;
    instructions: string;
    temperature: number;
    isEnabled: boolean;
    handoffEnabled: boolean;
  };
}) {
  const [state, formAction, pending] = useActionState(updateAiConfig, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Assistant name">
          <Input name="assistantName" defaultValue={initial.assistantName} required />
        </Field>
        <Field label="Tone">
          <Select name="tone" defaultValue={initial.tone}>
            {TONES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Greeting (first thing customers see)">
        <Input name="greeting" defaultValue={initial.greeting} required />
      </Field>
      <Field label="Business instructions (what the AI should know & how to behave)">
        <textarea
          name="instructions"
          rows={6}
          defaultValue={initial.instructions}
          placeholder="Delivery takes 3-7 days across Albania. Assembly is free over €500. We accept cash, card, and 12-month installments…"
          className="w-full px-3.5 py-2.5 bg-card border border-line rounded-[10px] text-[13.5px] text-ink placeholder:text-ink-soft outline-none focus:border-accent-line focus:ring-2 focus:ring-accent-soft transition resize-y"
        />
      </Field>
      <Field label={`Creativity (temperature)`}>
        <div className="flex items-center gap-3">
          <input
            type="range"
            name="temperature"
            min="0"
            max="1"
            step="0.1"
            defaultValue={initial.temperature}
            className="flex-1 accent-[#5B57D4]"
          />
          <span className="font-mono text-[11.5px] text-ink-soft w-20">precise ↔ creative</span>
        </div>
      </Field>

      <div className="space-y-3 pt-1">
        <Toggle
          name="isEnabled"
          label="AI receptionist online"
          hint="Turn off to pause all automatic replies (customers can still leave messages)."
          defaultChecked={initial.isEnabled}
        />
        <Toggle
          name="handoffEnabled"
          label="Human handoff"
          hint="Let the AI escalate to your team when customers ask for a person."
          defaultChecked={initial.handoffEnabled}
        />
      </div>

      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
