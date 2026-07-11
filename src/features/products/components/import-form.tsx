"use client";

import { useActionState } from "react";
import { Upload } from "lucide-react";
import { importProductsCsv } from "../actions";
import { Button } from "@/components/ui";

export function ImportForm() {
  const [state, formAction, pending] = useActionState(importProductsCsv, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <input
        type="file"
        name="file"
        accept=".csv,text/csv"
        required
        className="block w-full text-[13px] text-ink-mid file:mr-3 file:h-9 file:px-4 file:rounded-[9px] file:border file:border-line file:bg-card file:text-[12.5px] file:font-semibold file:text-ink file:cursor-pointer hover:file:bg-hover"
      />

      {state?.error && (
        <p className="text-[12.5px] text-danger bg-danger-soft border border-danger/15 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}
      {state?.imported !== undefined && (
        <div className="text-[12.5px] bg-positive-soft border border-positive-line text-positive-strong rounded-lg px-3 py-2">
          Imported {state.imported} product{state.imported === 1 ? "" : "s"}.
          {state.skipped && state.skipped.length > 0 && (
            <span className="block mt-1 text-warn">
              Skipped {state.skipped.length} row{state.skipped.length === 1 ? "" : "s"}:{" "}
              {state.skipped
                .slice(0, 5)
                .map((s) => `line ${s.line} (${s.reason})`)
                .join(", ")}
              {state.skipped.length > 5 ? "…" : ""}
            </span>
          )}
        </div>
      )}

      <Button type="submit" disabled={pending}>
        <Upload size={14} />
        {pending ? "Importing…" : "Import CSV"}
      </Button>
    </form>
  );
}
