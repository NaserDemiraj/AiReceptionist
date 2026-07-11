"use client";

import { useTransition } from "react";
import { setAppointmentStatus } from "../actions";

function ActionButton({
  appointmentId,
  status,
  label,
  tone,
}: {
  appointmentId: string;
  status: string;
  label: string;
  tone: "positive" | "danger" | "neutral";
}) {
  const [pending, startTransition] = useTransition();
  const colors = {
    positive: "text-positive-strong hover:bg-positive-soft",
    danger: "text-danger hover:bg-danger-soft",
    neutral: "text-ink-mid hover:bg-hover",
  };
  return (
    <button
      disabled={pending}
      onClick={() => {
        const fd = new FormData();
        fd.set("appointmentId", appointmentId);
        fd.set("status", status);
        startTransition(() => setAppointmentStatus(fd));
      }}
      className={`px-2 py-1 rounded-md text-[11.5px] font-semibold cursor-pointer disabled:opacity-50 ${colors[tone]}`}
    >
      {label}
    </button>
  );
}

export function AppointmentActions({
  appointmentId,
  status,
}: {
  appointmentId: string;
  status: string;
}) {
  if (status === "PENDING") {
    return (
      <div className="flex items-center gap-1">
        <ActionButton appointmentId={appointmentId} status="CONFIRMED" label="Confirm" tone="positive" />
        <ActionButton appointmentId={appointmentId} status="CANCELLED" label="Cancel" tone="danger" />
      </div>
    );
  }
  if (status === "CONFIRMED") {
    return (
      <div className="flex items-center gap-1">
        <ActionButton appointmentId={appointmentId} status="COMPLETED" label="Complete" tone="positive" />
        <ActionButton appointmentId={appointmentId} status="NO_SHOW" label="No-show" tone="neutral" />
        <ActionButton appointmentId={appointmentId} status="CANCELLED" label="Cancel" tone="danger" />
      </div>
    );
  }
  if (status === "CANCELLED" || status === "NO_SHOW") {
    return (
      <ActionButton appointmentId={appointmentId} status="PENDING" label="Reopen" tone="neutral" />
    );
  }
  return null;
}
