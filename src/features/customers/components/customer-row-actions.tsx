"use client";

import { Download, Trash2 } from "lucide-react";
import { deleteCustomer } from "../actions";

export function CustomerRowActions({
  customerId,
  customerName,
}: {
  customerId: string;
  customerName: string;
}) {
  return (
    <div className="flex items-center gap-1 justify-end">
      <a
        href={`/customers/${customerId}/export`}
        title="Export all data (GDPR)"
        className="w-7 h-7 flex items-center justify-center rounded-md text-ink-soft hover:text-accent hover:bg-accent-soft"
      >
        <Download size={14} />
      </a>
      <form
        action={deleteCustomer}
        onSubmit={(e) => {
          if (
            !confirm(
              `Permanently delete ${customerName} and ALL their data (conversations, leads, appointments, quotes)?\n\nThis is the GDPR right-to-erasure action and cannot be undone.`,
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="customerId" value={customerId} />
        <button
          type="submit"
          title="Delete all data (GDPR)"
          className="w-7 h-7 flex items-center justify-center rounded-md text-ink-soft hover:text-danger hover:bg-danger-soft cursor-pointer"
        >
          <Trash2 size={14} />
        </button>
      </form>
    </div>
  );
}
