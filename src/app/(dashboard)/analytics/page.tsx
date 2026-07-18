import Link from "next/link";
import { Card, cx } from "@/components/ui";
import { Topbar } from "@/components/layout/topbar";
import { requireOrg } from "@/lib/org";
import { getAnalytics, getTeamPerformance } from "@/features/analytics/queries";
import { ColumnChart, BarList } from "@/features/analytics/components/charts";
import { CHANNEL_LABELS, LEAD_STATUS_META, formatMoney } from "@/features/shared/labels";

export const metadata = { title: "Analytics" };

const RANGES = [
  { key: "7", label: "7 days", days: 7 },
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
] as const;

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-[12px] text-ink-mid font-medium">{label}</div>
      <div className="font-display text-[26px] font-semibold tracking-tight mt-1.5 leading-none">
        {value}
      </div>
      {hint && <div className="text-[11px] text-ink-soft mt-1.5">{hint}</div>}
    </Card>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { org } = await requireOrg();
  const params = await searchParams;
  const range = RANGES.find((r) => r.key === params.range) ?? RANGES[1];

  const [data, team] = await Promise.all([
    getAnalytics(org.id, range.days),
    getTeamPerformance(org.id, range.days),
  ]);
  const funnelLabels = Object.fromEntries(
    Object.entries(LEAD_STATUS_META).map(([k, v]) => [k, v.label]),
  );

  return (
    <>
      <Topbar
        title="Analytics"
        actions={
          <div className="flex gap-1 bg-hover border border-line rounded-[9px] p-0.5">
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={`/analytics?range=${r.key}`}
                className={cx(
                  "px-3 h-[30px] flex items-center rounded-[7px] text-[12.5px] font-medium",
                  r.key === range.key
                    ? "bg-card text-ink font-semibold shadow-sm"
                    : "text-ink-mid hover:text-ink",
                )}
              >
                {r.label}
              </Link>
            ))}
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto px-[26px] pt-6 pb-10">
        {/* KPI row */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3.5 mb-4">
          <Stat label="Conversations" value={data.kpis.conversations.toLocaleString()} />
          <Stat
            label="Leads captured"
            value={data.kpis.leads.toLocaleString()}
            hint={`${data.kpis.conversionRate}% of conversations become leads`}
          />
          <Stat label="Appointments booked" value={data.kpis.appointments.toLocaleString()} />
          <Stat
            label="Revenue influenced"
            value={formatMoney(data.kpis.revenueInfluenced, org.currency)}
            hint={`${formatMoney(data.kpis.revenueWon, org.currency)} closed won`}
          />
        </div>
        <div className="grid grid-cols-3 gap-3.5 mb-4">
          <Stat
            label="Customer satisfaction"
            value={data.kpis.csat !== null ? `${data.kpis.csat}%` : "—"}
            hint={
              data.kpis.csatResponses
                ? `${data.kpis.csatResponses} rating${data.kpis.csatResponses === 1 ? "" : "s"} from the widget`
                : "No ratings yet — customers rate in the chat widget"
            }
          />
          <Stat
            label="Missed opportunities"
            value={data.kpis.missedOpportunities.toLocaleString()}
            hint="Conversations that didn't become a lead"
          />
          <Stat
            label="Resolved by AI"
            value={data.kpis.resolutionRate ? `${data.kpis.resolutionRate}%` : "—"}
            hint="Conversations closed without a human"
          />
        </div>

        {/* Conversations over time */}
        <Card className="p-5 mb-4">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-[14px] font-semibold">Conversations per day</h2>
            <span className="text-[11.5px] text-ink-soft">
              {data.kpis.avgResponseSec !== null
                ? `avg. first response ${data.kpis.avgResponseSec}s`
                : ""}
              {data.kpis.resolutionRate ? ` · ${data.kpis.resolutionRate}% resolved by AI` : ""}
            </span>
          </div>
          <ColumnChart data={data.byDay} />
        </Card>

        <div className="grid md:grid-cols-3 gap-4">
          <Card className="p-5">
            <h2 className="text-[14px] font-semibold mb-4">Channels</h2>
            <BarList
              data={data.channels}
              labelMap={CHANNEL_LABELS}
              emptyText="No conversations yet in this period"
            />
          </Card>
          <Card className="p-5">
            <h2 className="text-[14px] font-semibold mb-4">Lead pipeline</h2>
            <BarList
              data={data.funnel}
              labelMap={funnelLabels}
              emptyText="No leads yet in this period"
            />
          </Card>
          <Card className="p-5">
            <h2 className="text-[14px] font-semibold mb-4">Most wanted products</h2>
            <BarList
              data={data.topProducts}
              emptyText="No product interest captured yet"
            />
          </Card>
          <Card className="p-5">
            <h2 className="text-[14px] font-semibold mb-4">Most common topics</h2>
            <BarList
              data={data.topTopics}
              emptyText="Not enough customer messages yet"
            />
          </Card>
        </div>

        {/* Team performance */}
        <Card className="p-5 mt-4">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-[14px] font-semibold">Team performance</h2>
            <span className="text-[11.5px] text-ink-soft">last {range.label}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-ink-soft border-b border-line">
                  <th className="py-2 pr-4 font-medium">Member</th>
                  <th className="py-2 pr-4 font-medium text-right">Replies sent</th>
                  <th className="py-2 pr-4 font-medium text-right">Conversations</th>
                  <th className="py-2 pr-4 font-medium text-right">Resolved</th>
                  <th className="py-2 pr-4 font-medium text-right">CSAT</th>
                  <th className="py-2 font-medium text-right">Appointments</th>
                </tr>
              </thead>
              <tbody>
                {team.map((m) => (
                  <tr key={m.userId} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-4">
                      <span className="font-medium text-ink">{m.name}</span>
                      <span className="ml-2 text-[11px] text-ink-soft">
                        {m.role === "OWNER" ? "Owner" : m.role === "ADMIN" ? "Admin" : "Agent"}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{m.repliesSent}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{m.conversationsHandled}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{m.resolved}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {m.csat !== null ? `${m.csat}%` : "—"}
                      {m.csatResponses > 0 && (
                        <span className="text-[10.5px] text-ink-soft"> ({m.csatResponses})</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{m.appointments}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {team.length === 0 && (
              <p className="text-[12.5px] text-ink-soft py-4 text-center">No team members yet.</p>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
