"use client";

import { useRef, useTransition } from "react";
import { setLeadStatus } from "../actions";

const OPTIONS: Array<[string, string, string]> = [
  ["NEW", "New", "#5B57D4"],
  ["CONTACTED", "Contacted", "#6B6B76"],
  ["QUALIFIED", "Qualified", "#8A6D2F"],
  ["VISIT_BOOKED", "Visit booked", "#12805C"],
  ["WON", "Won", "#0E6B4D"],
  ["LOST", "Lost", "#C4362E"],
];

export function LeadStatusSelect({
  leadId,
  status,
}: {
  leadId: string;
  status: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const color = OPTIONS.find(([v]) => v === status)?.[2] ?? "#6B6B76";

  return (
    <form ref={formRef} action={setLeadStatus}>
      <input type="hidden" name="leadId" value={leadId} />
      <select
        name="status"
        defaultValue={status}
        disabled={pending}
        onChange={() => startTransition(() => formRef.current?.requestSubmit())}
        className="h-[28px] pl-2 pr-6 text-[12px] font-semibold bg-card border border-line rounded-lg cursor-pointer outline-none focus:border-accent-line disabled:opacity-50"
        style={{ color }}
      >
        {OPTIONS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </form>
  );
}
