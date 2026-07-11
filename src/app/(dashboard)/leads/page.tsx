import Link from "next/link";
import { format } from "date-fns";
import { Users } from "lucide-react";
import { Card, EmptyState, cx } from "@/components/ui";
import { Topbar } from "@/components/layout/topbar";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { LEAD_STATUS_META, formatMoney } from "@/features/shared/labels";
import { LeadStatusSelect } from "@/features/leads/components/lead-status-select";
import type { LeadStatus } from "@prisma/client";

export const metadata = { title: "Leads" };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { org } = await requireOrg();
  const params = await searchParams;

  const statusFilter =
    params.status && params.status in LEAD_STATUS_META
      ? (params.status as LeadStatus)
      : undefined;

  const [leads, counts] = await Promise.all([
    prisma.lead.findMany({
      where: { organizationId: org.id, ...(statusFilter ? { status: statusFilter } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        customer: true,
        products: { include: { product: true } },
      },
    }),
    prisma.lead.groupBy({
      by: ["status"],
      where: { organizationId: org.id },
      _count: true,
    }),
  ]);

  const countByStatus = Object.fromEntries(counts.map((c) => [c.status, c._count]));
  const total = counts.reduce((sum, c) => sum + c._count, 0);

  const tabs: Array<{ key: LeadStatus | undefined; label: string; count: number }> = [
    { key: undefined, label: "All", count: total },
    ...(Object.keys(LEAD_STATUS_META) as LeadStatus[]).map((s) => ({
      key: s as LeadStatus | undefined,
      label: LEAD_STATUS_META[s].label,
      count: countByStatus[s] ?? 0,
    })),
  ];

  return (
    <>
      <Topbar title="Leads" />
      <div className="flex-1 overflow-y-auto px-[26px] pt-6 pb-10">
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {tabs.map((t) => (
            <Link
              key={t.label}
              href={t.key ? `/leads?status=${t.key}` : "/leads"}
              className={cx(
                "px-3 py-1.5 rounded-lg text-[12.5px] font-medium inline-flex items-center gap-1.5",
                statusFilter === t.key
                  ? "bg-accent-soft text-accent font-semibold"
                  : "text-ink-mid hover:bg-hover bg-card border border-line",
              )}
            >
              {t.label}
              <span className="font-mono text-[10.5px] text-ink-soft">{t.count}</span>
            </Link>
          ))}
        </div>

        <Card className="overflow-hidden">
          {leads.length === 0 ? (
            <EmptyState
              title="No leads yet"
              hint="When customers share contact details with your AI receptionist, leads appear here automatically."
              icon={<Users size={28} />}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className="font-mono text-[10.5px] uppercase tracking-wider text-ink-soft font-medium px-4 py-3">Customer</th>
                    <th className="font-mono text-[10.5px] uppercase tracking-wider text-ink-soft font-medium px-4 py-3">Interested in</th>
                    <th className="font-mono text-[10.5px] uppercase tracking-wider text-ink-soft font-medium px-4 py-3">Budget</th>
                    <th className="font-mono text-[10.5px] uppercase tracking-wider text-ink-soft font-medium px-4 py-3">Status</th>
                    <th className="font-mono text-[10.5px] uppercase tracking-wider text-ink-soft font-medium px-4 py-3">Contact</th>
                    <th className="font-mono text-[10.5px] uppercase tracking-wider text-ink-soft font-medium px-4 py-3">Created</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => {
                    return (
                      <tr key={lead.id} className="border-b border-line last:border-0 hover:bg-row-hover">
                        <td className="px-4 py-3">
                          <div className="font-semibold">{lead.customer.name ?? "Unknown"}</div>
                        </td>
                        <td className="px-4 py-3 text-ink-mid max-w-[260px]">
                          <div className="truncate">
                            {lead.products.length > 0
                              ? lead.products.map((p) => p.product.name).join(", ")
                              : (lead.interestedIn ?? "—")}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-[12.5px]">
                          {lead.budget ? formatMoney(lead.budget, lead.currency) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <LeadStatusSelect leadId={lead.id} status={lead.status} />
                        </td>
                        <td className="px-4 py-3 text-ink-mid">
                          <div className="text-[12.5px]">{lead.customer.phone ?? lead.customer.email ?? "—"}</div>
                          {lead.preferredContactTime && (
                            <div className="text-[11px] text-ink-soft">{lead.preferredContactTime}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-ink-soft text-[12.5px]">
                          {format(lead.createdAt, "MMM d, HH:mm")}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/quotes/new?lead=${lead.id}`}
                            className="text-[12px] font-semibold text-accent hover:text-accent-strong"
                          >
                            Quote →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
