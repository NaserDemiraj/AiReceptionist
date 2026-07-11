import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowDown,
  ArrowUp,
  CalendarCheck,
  MessageSquare,
  Timer,
  Users,
} from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { Topbar } from "@/components/layout/topbar";
import { requireOrg } from "@/lib/org";
import { getDashboardData, getSetupSteps } from "@/features/dashboard/queries";
import { SetupChecklist } from "@/features/dashboard/components/setup-checklist";
import {
  CHANNEL_LABELS,
  CONVERSATION_STATUS_META,
  LEAD_STATUS_META,
} from "@/features/shared/labels";

export const metadata = { title: "Dashboard" };

function KpiCard({
  label,
  value,
  delta,
  icon,
}: {
  label: string;
  value: string;
  delta: number | null;
  icon: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12.5px] text-ink-mid font-medium">{label}</span>
        <span className="w-7 h-7 rounded-lg bg-accent-soft text-accent flex items-center justify-center">
          {icon}
        </span>
      </div>
      <div className="font-display text-[30px] font-semibold tracking-tight leading-none text-ink">
        {value}
      </div>
      <div className="flex items-center gap-1.5 mt-2.5">
        {delta !== null ? (
          <>
            <Badge tone={delta >= 0 ? "positive" : "danger"}>
              {delta >= 0 ? <ArrowUp size={11} strokeWidth={3} /> : <ArrowDown size={11} strokeWidth={3} />}
              {Math.abs(delta)}%
            </Badge>
            <span className="text-[11.5px] text-ink-soft">vs last week</span>
          </>
        ) : (
          <span className="text-[11.5px] text-ink-soft">no prior data</span>
        )}
      </div>
    </Card>
  );
}

export default async function DashboardPage() {
  const { org, user } = await requireOrg();
  const [data, setupSteps] = await Promise.all([
    getDashboardData(org.id),
    getSetupSteps(org),
  ]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = user.name.split(" ")[0];

  return (
    <>
      <Topbar title="Dashboard" showNotificationDot />
      <div className="flex-1 overflow-y-auto px-[26px] pt-6 pb-10">
        <SetupChecklist steps={setupSteps} />
        {/* Status strip */}
        <div className="flex items-end gap-3.5 mb-[22px] flex-wrap">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">
              {greeting}, {firstName}
            </h1>
            <p className="text-[13.5px] text-ink-mid mt-0.5">
              Here&apos;s what your AI receptionist handled this week ·{" "}
              {format(new Date(), "EEE, MMM d")}
            </p>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2 h-[38px] px-3.5 bg-positive-soft border border-positive-line rounded-[10px]">
            <span className="w-2 h-2 rounded-full bg-positive animate-pulse-dot" />
            <span className="text-[13px] font-semibold text-positive-strong">AI online</span>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3.5 mb-4">
          <KpiCard
            label="Conversations"
            value={data.kpis.conversations.value.toLocaleString()}
            delta={data.kpis.conversations.delta}
            icon={<MessageSquare size={15} />}
          />
          <KpiCard
            label="Leads captured"
            value={data.kpis.leads.value.toLocaleString()}
            delta={data.kpis.leads.delta}
            icon={<Users size={15} />}
          />
          <KpiCard
            label="Appointments booked"
            value={data.kpis.appointments.value.toLocaleString()}
            delta={data.kpis.appointments.delta}
            icon={<CalendarCheck size={15} />}
          />
          <KpiCard
            label="Avg. response time"
            value={data.kpis.avgResponseSec !== null ? `${data.kpis.avgResponseSec}s` : "—"}
            delta={null}
            icon={<Timer size={15} />}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3.5">
          {/* Recent conversations */}
          <Card className="xl:col-span-2">
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-line">
              <span className="text-[14px] font-semibold">Recent conversations</span>
              <Link href="/conversations" className="text-[12.5px] font-medium text-accent">
                View all
              </Link>
            </div>
            {data.recentConversations.length === 0 ? (
              <p className="px-4 py-10 text-center text-[13px] text-ink-soft">
                No conversations yet — install the chat widget to get started.
              </p>
            ) : (
              <ul>
                {data.recentConversations.map((c) => {
                  const meta = CONVERSATION_STATUS_META[c.status];
                  const last = c.messages[0];
                  return (
                    <li key={c.id} className="border-b border-line last:border-0">
                      <Link
                        href={`/conversations?c=${c.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-row-hover"
                      >
                        <div className="w-8 h-8 rounded-full bg-accent-soft text-accent flex items-center justify-center text-[12px] font-semibold shrink-0">
                          {(c.customer.name ?? "Visitor")[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-semibold truncate">
                              {c.customer.name ?? "Web visitor"}
                            </span>
                            <span className="font-mono text-[10px] text-ink-soft">
                              {CHANNEL_LABELS[c.channel]}
                            </span>
                          </div>
                          <div className="text-[12.5px] text-ink-mid truncate mt-0.5">
                            {last?.content ?? c.subject ?? "…"}
                          </div>
                        </div>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        <span className="text-[11.5px] text-ink-soft w-[54px] text-right shrink-0">
                          {format(c.updatedAt, "HH:mm")}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Right column */}
          <div className="flex flex-col gap-3.5">
            <Card>
              <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-line">
                <span className="text-[14px] font-semibold">Upcoming appointments</span>
                <Link href="/appointments" className="text-[12.5px] font-medium text-accent">
                  All
                </Link>
              </div>
              {data.upcomingAppointments.length === 0 ? (
                <p className="px-4 py-8 text-center text-[13px] text-ink-soft">
                  Nothing scheduled yet.
                </p>
              ) : (
                <ul className="p-2">
                  {data.upcomingAppointments.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-row-hover">
                      <div className="w-10 text-center shrink-0">
                        <div className="font-mono text-[10px] text-ink-soft uppercase">
                          {format(a.startsAt, "MMM")}
                        </div>
                        <div className="font-display text-[17px] font-semibold leading-none">
                          {format(a.startsAt, "d")}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold truncate">
                          {a.customer.name ?? "Customer"}
                        </div>
                        <div className="text-[11.5px] text-ink-soft">
                          {format(a.startsAt, "HH:mm")} ·{" "}
                          {a.type === "SHOWROOM_VISIT" ? "Showroom visit" : "Consultation"}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-line">
                <span className="text-[14px] font-semibold">Newest leads</span>
                <Link href="/leads" className="text-[12.5px] font-medium text-accent">
                  All
                </Link>
              </div>
              {data.recentLeads.length === 0 ? (
                <p className="px-4 py-8 text-center text-[13px] text-ink-soft">No leads yet.</p>
              ) : (
                <ul className="p-2">
                  {data.recentLeads.map((l) => {
                    const meta = LEAD_STATUS_META[l.status];
                    return (
                      <li key={l.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-row-hover">
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold truncate">
                            {l.customer.name ?? l.customer.email ?? "Unknown"}
                          </div>
                          <div className="text-[11.5px] text-ink-soft truncate">
                            {l.interestedIn ?? "—"}
                          </div>
                        </div>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
