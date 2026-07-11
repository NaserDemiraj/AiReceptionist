import Link from "next/link";
import { format } from "date-fns";
import { Download, FileText, Plus } from "lucide-react";
import type { QuoteStatus } from "@prisma/client";
import { Badge, Card, EmptyState } from "@/components/ui";
import { Topbar } from "@/components/layout/topbar";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/features/shared/labels";
import { setQuoteStatus } from "@/features/quotes/actions";
import { EmailQuoteButton } from "@/features/quotes/components/email-quote-button";

export const metadata = { title: "Quotes" };

const STATUS_META: Record<QuoteStatus, { label: string; tone: "accent" | "positive" | "warn" | "danger" | "neutral" }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SENT: { label: "Sent", tone: "accent" },
  ACCEPTED: { label: "Accepted", tone: "positive" },
  DECLINED: { label: "Declined", tone: "danger" },
  EXPIRED: { label: "Expired", tone: "warn" },
};

export default async function QuotesPage() {
  const { org } = await requireOrg();

  const quotes = await prisma.quote.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { customer: true },
  });

  return (
    <>
      <Topbar
        title="Quotes"
        actions={
          <Link
            href="/quotes/new"
            className="h-9 px-4 bg-accent hover:bg-accent-strong text-white rounded-[9px] text-[13px] font-semibold inline-flex items-center gap-1.5"
          >
            <Plus size={15} strokeWidth={2.4} />
            New quote
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto px-[26px] pt-6 pb-10">
        <Card className="overflow-hidden">
          {quotes.length === 0 ? (
            <EmptyState
              title="No quotes yet"
              hint="Create a professional PDF quotation for any lead or customer — takes under a minute."
              icon={<FileText size={28} />}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className="font-mono text-[10.5px] uppercase tracking-wider text-ink-soft font-medium px-4 py-3">Number</th>
                    <th className="font-mono text-[10.5px] uppercase tracking-wider text-ink-soft font-medium px-4 py-3">Customer</th>
                    <th className="font-mono text-[10.5px] uppercase tracking-wider text-ink-soft font-medium px-4 py-3">Total</th>
                    <th className="font-mono text-[10.5px] uppercase tracking-wider text-ink-soft font-medium px-4 py-3">Status</th>
                    <th className="font-mono text-[10.5px] uppercase tracking-wider text-ink-soft font-medium px-4 py-3">Valid until</th>
                    <th className="font-mono text-[10.5px] uppercase tracking-wider text-ink-soft font-medium px-4 py-3">Created</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q) => {
                    const meta = STATUS_META[q.status];
                    return (
                      <tr key={q.id} className="border-b border-line last:border-0 hover:bg-row-hover">
                        <td className="px-4 py-3 font-mono text-[12.5px] font-semibold">{q.number}</td>
                        <td className="px-4 py-3 font-medium">{q.customer.name ?? "Customer"}</td>
                        <td className="px-4 py-3 font-mono text-[12.5px] font-semibold">
                          {formatMoney(q.total, q.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <form action={setQuoteStatus} className="inline-flex items-center gap-2">
                            <input type="hidden" name="quoteId" value={q.id} />
                            <Badge tone={meta.tone}>{meta.label}</Badge>
                            {q.status === "DRAFT" && (
                              <button
                                name="status"
                                value="SENT"
                                className="text-[11px] font-medium text-accent hover:text-accent-strong cursor-pointer"
                              >
                                Mark sent
                              </button>
                            )}
                            {q.status === "SENT" && (
                              <>
                                <button
                                  name="status"
                                  value="ACCEPTED"
                                  className="text-[11px] font-medium text-positive-strong hover:opacity-80 cursor-pointer"
                                >
                                  Accept
                                </button>
                                <button
                                  name="status"
                                  value="DECLINED"
                                  className="text-[11px] font-medium text-danger hover:opacity-80 cursor-pointer"
                                >
                                  Decline
                                </button>
                              </>
                            )}
                          </form>
                        </td>
                        <td className="px-4 py-3 text-ink-mid text-[12.5px]">
                          {q.validUntil ? format(q.validUntil, "MMM d, yyyy") : "—"}
                        </td>
                        <td className="px-4 py-3 text-ink-soft text-[12.5px]">
                          {format(q.createdAt, "MMM d, HH:mm")}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <a
                              href={`/quotes/${q.id}/pdf`}
                              target="_blank"
                              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent hover:text-accent-strong"
                            >
                              <Download size={13} />
                              PDF
                            </a>
                            <EmailQuoteButton quoteId={q.id} hasEmail={!!q.customer.email} />
                          </div>
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
