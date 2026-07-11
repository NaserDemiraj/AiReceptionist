import Link from "next/link";
import { Card, cx } from "@/components/ui";
import { Topbar } from "@/components/layout/topbar";
import { requireOrg } from "@/lib/org";
import { getAnalytics } from "@/features/analytics/queries";
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

  const data = await getAnalytics(org.id, range.days);
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
        </div>
      </div>
    </>
  );
}
