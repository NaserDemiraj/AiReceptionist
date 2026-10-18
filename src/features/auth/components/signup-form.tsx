"use client";

import { useActionState } from "react";
import { signup } from "../actions";
import { Button, Field, Input, Select } from "@/components/ui";

const INDUSTRIES = [
  ["furniture", "Furniture store"],
  ["dental", "Dental clinic"],
  ["restaurant", "Restaurant"],
  ["salon", "Beauty salon"],
  ["gym", "Gym / Fitness"],
  ["real-estate", "Real estate agency"],
  ["law", "Law firm"],
  ["accounting", "Accounting firm"],
  ["construction", "Construction company"],
  ["automotive", "Car dealership"],
  ["general", "Other"],
] as const;

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Your name">
        <Input name="name" placeholder="Blerta Krasniqi" required autoComplete="name" />
      </Field>
      <Field label="Work email">
        <Input name="email" type="email" placeholder="you@business.com" required autoComplete="email" />
      </Field>
      <Field label="Password">
        <Input
          name="password"
          type="password"
          placeholder="At least 8 characters"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </Field>
      <Field label="Business name">
        <Input name="businessName" placeholder="MAMAJ Furniture" required autoComplete="organization" />
      </Field>
      <Field label="Industry">
        <Select name="industry" defaultValue="furniture">
          {INDUSTRIES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      {state?.error && (
        <p className="text-[12.5px] text-danger bg-danger-soft border border-danger/15 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full h-[42px]">
        {pending ? "Creating your AI employee…" : "Create account"}
      </Button>
    </form>
  );
}
