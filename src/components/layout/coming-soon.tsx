import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui";
import { Topbar } from "@/components/layout/topbar";

/**
 * Premium placeholder for screens whose backend lands in a later milestone.
 * Shows what the feature will do so demos still tell the story.
 */
export function ComingSoonScreen({
  title,
  milestone,
  description,
  bullets,
  icon: Icon,
}: {
  title: string;
  milestone: string;
  description: string;
  bullets: string[];
  icon: LucideIcon;
}) {
  return (
    <>
      <Topbar title={title} />
      <div className="flex-1 overflow-y-auto px-[26px] pt-6 pb-10">
        <Card className="max-w-[620px] p-8">
          <div className="w-11 h-11 rounded-[11px] bg-accent-soft text-accent flex items-center justify-center mb-4">
            <Icon size={20} />
          </div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <h1 className="text-[18px] font-semibold tracking-tight">{title}</h1>
            <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider bg-warn-soft text-warn px-2 py-0.5 rounded-md">
              {milestone}
            </span>
          </div>
          <p className="text-[13.5px] text-ink-mid leading-relaxed mb-5">{description}</p>
          <ul className="space-y-2">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-[13px] text-ink">
                <span className="w-[5px] h-[5px] rounded-full bg-accent mt-[7px] shrink-0" />
                {b}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
