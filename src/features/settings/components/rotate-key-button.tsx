"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { rotateWidgetKey } from "../actions";
import { Button } from "@/components/ui";

export function RotateKeyButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() => {
        if (
          confirm(
            "Rotate the widget key?\n\nThe old key stops working immediately — every website using the current embed snippet must be updated with the new one.",
          )
        ) {
          startTransition(() => rotateWidgetKey());
        }
      }}
    >
      <RefreshCw size={14} />
      {pending ? "Rotating…" : "Rotate key"}
    </Button>
  );
}
