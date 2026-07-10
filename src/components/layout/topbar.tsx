import type { ReactNode } from "react";
import { Bell, Search } from "lucide-react";

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
      <div className="hidden md:flex items-center gap-2 h-9 px-3 bg-hover border border-line rounded-[9px] w-[250px] text-ink-soft">
        <Search size={15} />
        <span className="text-[13px]">Search…</span>
        <span className="ml-auto font-mono text-[10.5px] bg-card border border-line-strong rounded-[5px] px-[5px] py-px">
          ⌘K
        </span>
      </div>
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
