import { format, isToday, isTomorrow } from "date-fns";
import { CalendarCheck } from "lucide-react";
import { Badge, Card, EmptyState } from "@/components/ui";
import { Topbar } from "@/components/layout/topbar";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { APPOINTMENT_STATUS_META } from "@/features/shared/labels";

export const metadata = { title: "Appointments" };

const TYPE_LABELS: Record<string, string> = {
  SHOWROOM_VISIT: "Showroom visit",
  CONSULTATION: "Consultation",
  DELIVERY: "Delivery",
  OTHER: "Other",
};

function dayLabel(d: Date): string {
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEEE, MMM d");
}

export default async function AppointmentsPage() {
  const { org } = await requireOrg();

  const appointments = await prisma.appointment.findMany({
    where: { organizationId: org.id, startsAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
    orderBy: { startsAt: "asc" },
    take: 100,
    include: { customer: true, staff: true },
  });

  // Group by calendar day
  const groups = new Map<string, typeof appointments>();
  for (const a of appointments) {
    const key = format(a.startsAt, "yyyy-MM-dd");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }

  return (
    <>
      <Topbar title="Appointments" />
      <div className="flex-1 overflow-y-auto px-[26px] pt-6 pb-10">
        {appointments.length === 0 ? (
          <Card>
            <EmptyState
              title="No upcoming appointments"
              hint="When the AI books showroom visits or consultations, they land on this calendar."
              icon={<CalendarCheck size={28} />}
            />
          </Card>
        ) : (
          <div className="space-y-6 max-w-[860px]">
            {[...groups.entries()].map(([key, items]) => (
              <div key={key}>
                <h2 className="text-[13px] font-semibold text-ink-mid mb-2.5">
                  {dayLabel(items[0].startsAt)}
                </h2>
                <Card className="overflow-hidden">
                  {items.map((a) => {
                    const meta = APPOINTMENT_STATUS_META[a.status];
                    return (
                      <div
                        key={a.id}
                        className="flex items-center gap-4 px-4 py-3.5 border-b border-line last:border-0 hover:bg-row-hover"
                      >
                        <div className="w-[92px] shrink-0">
                          <div className="font-display text-[16px] font-semibold leading-tight">
                            {format(a.startsAt, "HH:mm")}
                          </div>
                          <div className="text-[11px] text-ink-soft">
                            – {format(a.endsAt, "HH:mm")}
                          </div>
                        </div>
                        <div className="w-px h-9 bg-line shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[13.5px] font-semibold truncate">
                            {a.customer.name ?? "Customer"}
                          </div>
                          <div className="text-[12px] text-ink-mid">
                            {TYPE_LABELS[a.type]}
                            {a.staff ? ` · with ${a.staff.name}` : ""}
                            {a.notes ? ` · ${a.notes}` : ""}
                          </div>
                        </div>
                        <div className="text-[12px] text-ink-soft hidden md:block">
                          {a.customer.phone ?? a.customer.email ?? ""}
                        </div>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </div>
                    );
                  })}
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
