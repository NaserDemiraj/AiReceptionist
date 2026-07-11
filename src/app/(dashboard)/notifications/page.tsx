import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  Bell,
  CalendarCheck,
  Frown,
  Sparkles,
  UserRound,
} from "lucide-react";
import type { NotificationType } from "@prisma/client";
import { Button, Card, EmptyState, cx } from "@/components/ui";
import { Topbar } from "@/components/layout/topbar";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/notifications/actions";
import { CheckCheck } from "lucide-react";

export const metadata = { title: "Notifications" };

const TYPE_META: Record<
  NotificationType,
  { icon: React.ComponentType<{ size?: number }>; bg: string; fg: string }
> = {
  HIGH_VALUE_LEAD: { icon: Sparkles, bg: "bg-accent-soft", fg: "text-accent" },
  APPOINTMENT_BOOKED: { icon: CalendarCheck, bg: "bg-positive-soft", fg: "text-positive-strong" },
  HUMAN_TAKEOVER: { icon: UserRound, bg: "bg-warn-soft", fg: "text-warn" },
  NEGATIVE_SENTIMENT: { icon: Frown, bg: "bg-danger-soft", fg: "text-danger" },
  URGENT: { icon: AlertTriangle, bg: "bg-danger-soft", fg: "text-danger" },
  SYSTEM: { icon: Bell, bg: "bg-hover", fg: "text-ink-mid" },
};

export default async function NotificationsPage() {
  const { org, user } = await requireOrg();

  const notifications = await prisma.notification.findMany({
    where: { organizationId: org.id, OR: [{ userId: null }, { userId: user.id }] },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <>
      <Topbar
        title="Notifications"
        actions={
          notifications.some((n) => !n.readAt) ? (
            <form action={markAllNotificationsRead}>
              <Button variant="secondary" type="submit">
                <CheckCheck size={14} />
                Mark all read
              </Button>
            </form>
          ) : undefined
        }
      />
      <div className="flex-1 overflow-y-auto px-[26px] pt-6 pb-10">
        <Card className="max-w-[680px] overflow-hidden">
          {notifications.length === 0 ? (
            <EmptyState
              title="All caught up"
              hint="High-value leads, bookings, and urgent issues will appear here."
              icon={<Bell size={28} />}
            />
          ) : (
            notifications.map((n) => {
              const meta = TYPE_META[n.type];
              const Icon = meta.icon;
              return (
                <div
                  key={n.id}
                  className={cx(
                    "flex gap-3.5 px-4 py-3.5 border-b border-line last:border-0",
                    !n.readAt && "bg-accent-soft/30",
                  )}
                >
                  <div
                    className={cx(
                      "w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0",
                      meta.bg,
                      meta.fg,
                    )}
                  >
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-semibold">{n.title}</span>
                      {!n.readAt && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />}
                    </div>
                    {n.body && <p className="text-[12.5px] text-ink-mid mt-0.5">{n.body}</p>}
                    <div className="text-[11px] text-ink-soft mt-1">
                      {formatDistanceToNow(n.createdAt, { addSuffix: true })}
                    </div>
                  </div>
                  {!n.readAt && (
                    <form action={markNotificationRead} className="shrink-0">
                      <input type="hidden" name="notificationId" value={n.id} />
                      <button
                        type="submit"
                        title="Mark as read"
                        className="w-7 h-7 flex items-center justify-center rounded-md text-ink-soft hover:text-accent hover:bg-accent-soft cursor-pointer"
                      >
                        <CheckCheck size={14} />
                      </button>
                    </form>
                  )}
                </div>
              );
            })
          )}
        </Card>
      </div>
    </>
  );
}
