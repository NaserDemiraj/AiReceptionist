"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import type { IntegrationFormState } from "../actions";

export function Feedback({ state }: { state: IntegrationFormState }) {
  if (!state) return null;
  if (state.error) {
    return (
      <p className="text-[12.5px] text-danger bg-danger-soft rounded-[8px] px-3 py-2">{state.error}</p>
    );
  }
  if (state.success) {
    return (
      <p className="text-[12.5px] text-positive-strong bg-positive-soft rounded-[8px] px-3 py-2">
        {state.success}
      </p>
    );
  }
  return null;
}

export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <Input readOnly value={value} onFocus={(e) => e.currentTarget.select()} className="font-mono text-[12px]" />
        <Button
          type="button"
          variant="secondary"
          className="shrink-0 w-[42px] px-0"
          aria-label={`Copy ${label}`}
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check size={15} className="text-positive-strong" /> : <Copy size={15} />}
        </Button>
      </div>
    </Field>
  );
}
