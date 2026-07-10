"use client";

import { useActionState } from "react";
import { updateOrgProfile } from "../actions";
import { Button, Field, Input, Select } from "@/components/ui";

const TIMEZONES = [
  "Europe/Tirane",
  "Europe/Berlin",
  "Europe/Zurich",
  "Europe/Vienna",
  "Europe/London",
  "Europe/Paris",
  "Europe/Rome",
  "America/New_York",
];

const CURRENCIES = ["EUR", "USD", "CHF", "GBP", "ALL"];

export interface OrgProfileValues {
  name: string;
  website: string;
  phone: string;
  email: string;
  address: string;
  timezone: string;
  currency: string;
}

export function OrgProfileForm({ initial }: { initial: OrgProfileValues }) {
  const [state, formAction, pending] = useActionState(updateOrgProfile, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Business name">
        <Input name="name" defaultValue={initial.name} required />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Public email">
          <Input name="email" type="email" defaultValue={initial.email} placeholder="hello@business.com" />
        </Field>
        <Field label="Phone">
          <Input name="phone" defaultValue={initial.phone} placeholder="+355 69 000 0000" />
        </Field>
      </div>
      <Field label="Website">
        <Input name="website" defaultValue={initial.website} placeholder="https://your-store.com" />
      </Field>
      <Field label="Address">
        <Input name="address" defaultValue={initial.address} placeholder="Street, city" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Timezone">
          <Select name="timezone" defaultValue={initial.timezone}>
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Currency">
          <Select name="currency" defaultValue={initial.currency}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {state?.error && (
        <p className="text-[12.5px] text-danger bg-danger-soft border border-danger/15 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="text-[12.5px] text-positive-strong bg-positive-soft border border-positive-line rounded-lg px-3 py-2">
          Settings saved.
        </p>
      )}

      <div className="pt-1">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
