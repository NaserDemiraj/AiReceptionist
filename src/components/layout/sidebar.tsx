"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Blocks,
  Bot,
  BookOpen,
  CalendarCheck,
  ChartLine,
  ChevronsUpDown,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  PanelsTopLeft,
  Settings,
  Sofa,
  Users,
  UsersRound,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { cx } from "@/components/ui";
import { logout } from "@/features/auth/actions";

export interface SidebarCounts {
  conversations: number;
  leads: number;
  appointments: number;
  notifications: number;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  badgeKind?: "purple" | "amber";
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cx(
        "flex items-center gap-[11px] px-2.5 py-2 rounded-[9px] text-[13px] mb-0.5 transition-colors",
        active
          ? "font-semibold text-accent bg-accent-soft"
          : "font-medium text-[#5A5A64] hover:bg-hover hover:text-ink",
      )}
    >
      <Icon size={17} strokeWidth={2} className="shrink-0" />
      <span className="flex-1">{item.label}</span>
      {item.badge ? (
        <span
          className={cx(
            "font-mono text-[10.5px] font-semibold px-[7px] py-px rounded-full",
            item.badgeKind === "amber"
              ? "bg-warn-soft text-warn"
              : "bg-accent text-white",
          )}
        >
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

export function Sidebar({
  orgName,
  planLabel,
  industry,
  userName,
  roleLabel,
  counts,
}: {
  orgName: string;
  planLabel: string;
  industry: string;
  userName: string;
  roleLabel: string;
  counts: SidebarCounts;
}) {
  const pathname = usePathname();

  const main: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    {
      href: "/conversations",
      label: "Conversations",
      icon: MessageSquare,
      badge: counts.conversations,
      badgeKind: "purple",
    },
    { href: "/leads", label: "Leads", icon: Users, badge: counts.leads, badgeKind: "amber" },
    { href: "/products", label: "Products", icon: Sofa },
    {
      href: "/appointments",
      label: "Appointments",
      icon: CalendarCheck,
      badge: counts.appointments,
      badgeKind: "amber",
    },
    { href: "/knowledge", label: "Knowledge Base", icon: BookOpen },
    { href: "/automation", label: "Automation", icon: Workflow },
    { href: "/analytics", label: "Analytics", icon: ChartLine },
    {
      href: "/notifications",
      label: "Notifications",
      icon: Bell,
      badge: counts.notifications,
      badgeKind: "purple",
    },
  ];

  const config: NavItem[] = [
    { href: "/ai-config", label: "AI Configuration", icon: Bot },
    { href: "/integrations", label: "Integrations", icon: Blocks },
    { href: "/website", label: "Website Builder", icon: PanelsTopLeft },
    { href: "/team", label: "Team Members", icon: UsersRound },
    { href: "/billing", label: "Billing", icon: CreditCard },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  const initials = userName
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className="w-[250px] shrink-0 bg-card border-r border-line flex flex-col sticky top-0 h-screen">
      {/* Logo */}
      <div className="px-[18px] pt-5 pb-4 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
          <Bot size={17} color="#fff" strokeWidth={2.2} />
        </div>
        <div className="leading-[1.1]">
          <div className="font-bold text-[14px] tracking-tight text-ink">AI Receptionist</div>
          <div className="font-mono text-[10px] text-ink-soft tracking-wide">
            v1.0 · {industry}
          </div>
        </div>
      </div>

      {/* Org switcher */}
      <div className="mx-3 mb-3.5 mt-1 px-[11px] py-[9px] border border-line rounded-[10px] flex items-center gap-[9px] cursor-pointer bg-[#FBFBFC]">
        <div className="w-[26px] h-[26px] rounded-md bg-gradient-to-br from-[#2b2b30] to-[#4b4b52] text-white flex items-center justify-center font-bold text-[12px] shrink-0">
          {orgName[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="flex-1 leading-[1.15] min-w-0">
          <div className="text-[12.5px] font-semibold truncate text-ink">{orgName}</div>
          <div className="text-[10.5px] text-ink-soft">{planLabel}</div>
        </div>
        <ChevronsUpDown size={14} className="text-ink-soft" />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2.5">
        {main.map((item) => (
          <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
        ))}
        <div className="font-mono text-[9.5px] tracking-[0.08em] uppercase text-[#B4B4BE] px-2.5 pt-4 pb-[7px]">
          Configure
        </div>
        {config.map((item) => (
          <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
        ))}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-line">
        <div className="flex items-center gap-2.5 p-1.5 rounded-[9px] hover:bg-hover group">
          <div className="w-[30px] h-[30px] rounded-full bg-[#E9E8F9] text-accent flex items-center justify-center font-semibold text-[12px]">
            {initials}
          </div>
          <div className="flex-1 leading-[1.2] min-w-0">
            <div className="text-[12.5px] font-semibold truncate text-ink">{userName}</div>
            <div className="text-[10.5px] text-ink-soft">{roleLabel}</div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              title="Sign out"
              className="w-7 h-7 flex items-center justify-center rounded-md text-ink-soft hover:text-danger hover:bg-danger-soft cursor-pointer"
            >
              <LogOut size={14} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
