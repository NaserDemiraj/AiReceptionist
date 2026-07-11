import type { ReactNode } from "react";
import { Bell } from "lucide-react";
import { CommandPalette } from "@/features/search/components/command-palette";

/**
 * 60px sticky topbar used by every dashboard screen.
 * `actions` renders on the right (buttons, filters).
 */
export function Topbar({
  title,
  actions,
  showNotificationDot = false,
}: {
  title: string;
  actions?: ReactNode;
  showNotificationDot?: boolean;
}) {
  return (
    <header className="h-[60px] shrink-0 bg-white/80 backdrop-blur-lg border-b border-line flex items-center gap-4 px-[26px] sticky top-0 z-10">
      <div className="text-[16px] font-semibold tracking-tight text-ink">{title}</div>
      <div className="flex-1" />
      <CommandPalette />
      {actions}
      <button className="w-9 h-9 bg-card border border-line rounded-[9px] flex items-center justify-center relative cursor-pointer hover:bg-hover">
        <Bell size={17} className="text-ink-mid" />
        {showNotificationDot && (
          <span className="absolute top-[7px] right-2 w-[7px] h-[7px] bg-danger border-[1.5px] border-white rounded-full" />
        )}
      </button>
    </header>
  );
}
