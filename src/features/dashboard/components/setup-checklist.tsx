import Link from "next/link";
import { ArrowRight, Check, Rocket } from "lucide-react";
import { Card, cx } from "@/components/ui";

export interface SetupStep {
  key: string;
  label: string;
  hint: string;
  href: string;
  done: boolean;
}

/** Onboarding checklist shown on the Dashboard until every step is done. */
export function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  return (
    <Card className="mb-5 overflow-hidden">
      <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-line">
        <div className="w-9 h-9 rounded-[10px] bg-accent-soft text-accent flex items-center justify-center">
          <Rocket size={16} />
        </div>
        <div className="flex-1">
          <div className="text-[14px] font-semibold">Set up your AI receptionist</div>
          <div className="text-[11.5px] text-ink-soft">
            {doneCount} of {steps.length} steps done — finish these and you&apos;re live.
          </div>
        </div>
        {/* progress */}
        <div className="w-[120px] h-[6px] bg-hover rounded-full overflow-hidden hidden sm:block">
          <div
            className="h-full bg-accent rounded-full transition-all"
            style={{ width: `${(doneCount / steps.length) * 100}%` }}
          />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step, i) => (
          <Link
            key={step.key}
            href={step.href}
            className={cx(
              "flex items-start gap-3 px-5 py-3.5 border-b border-line sm:[&:nth-last-child(-n+1)]:border-b-0 lg:[&:nth-last-child(-n+3)]:border-b-0 hover:bg-row-hover group",
              step.done && "opacity-60",
            )}
          >
            <span
              className={cx(
                "w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold",
                step.done
                  ? "bg-positive text-white"
                  : "bg-hover border border-line-strong text-ink-mid",
              )}
            >
              {step.done ? <Check size={12} strokeWidth={3} /> : i + 1}
            </span>
            <span className="flex-1 min-w-0">
              <span
                className={cx(
                  "block text-[13px] font-semibold",
                  step.done && "line-through decoration-ink-soft",
                )}
              >
                {step.label}
              </span>
              <span className="block text-[11.5px] text-ink-soft mt-0.5">{step.hint}</span>
            </span>
            {!step.done && (
              <ArrowRight
                size={14}
                className="text-ink-soft group-hover:text-accent shrink-0 mt-1"
              />
            )}
          </Link>
        ))}
      </div>
    </Card>
  );
}
