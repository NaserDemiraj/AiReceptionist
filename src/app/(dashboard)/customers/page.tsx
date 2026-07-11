import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Contact } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";
import { Topbar } from "@/components/layout/topbar";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Customers" };

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  sq: "Albanian",
  de: "German",
};

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { org } = await requireOrg();
  const { q } = await searchParams;

  const customers = await prisma.customer.findMany({
    where: {
      organizationId: org.id,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: {
      _count: { select: { conversations: true, leads: true, appointments: true } },
      conversations: { orderBy: { updatedAt: "desc" }, take: 1, select: { id: true, updatedAt: true } },
    },
  });

  return (
    <>
      <Topbar title="Customers" />
      <div className="flex-1 overflow-y-auto px-[26px] pt-6 pb-10">
        <form className="mb-4 max-w-[340px]">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search name, email or phone…"
            className="w-full h-[38px] px-3.5 bg-card border border-line rounded-[10px] text-[13.5px] outline-none focus:border-accent-line focus:ring-2 focus:ring-accent-soft"
          />
        </form>

        <Card className="overflow-hidden">
          {customers.length === 0 ? (
            <EmptyState
              title={q ? "No customers match" : "No customers yet"}
              hint={
                q
                  ? "Try a different search."
                  : "Everyone who talks to your AI receptionist appears here automatically."
              }
              icon={<Contact size={28} />}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className="font-mono text-[10.5px] uppercase tracking-wider text-ink-soft font-medium px-4 py-3">Customer</th>
                    <th className="font-mono text-[10.5px] uppercase tracking-wider text-ink-soft font-medium px-4 py-3">Contact</th>
                    <th className="font-mono text-[10.5px] uppercase tracking-wider text-ink-soft font-medium px-4 py-3">Language</th>
                    <th className="font-mono text-[10.5px] uppercase tracking-wider text-ink-soft font-medium px-4 py-3 text-center">Chats</th>
                    <th className="font-mono text-[10.5px] uppercase tracking-wider text-ink-soft font-medium px-4 py-3 text-center">Leads</th>
                    <th className="font-mono text-[10.5px] uppercase tracking-wider text-ink-soft font-medium px-4 py-3 text-center">Visits</th>
                    <th className="font-mono text-[10.5px] uppercase tracking-wider text-ink-soft font-medium px-4 py-3">Last active</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => {
                    const lastConv = c.conversations[0];
                    return (
                      <tr key={c.id} className="border-b border-line last:border-0 hover:bg-row-hover">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-accent-soft text-accent flex items-center justify-center text-[12px] font-semibold shrink-0">
                              {(c.name ?? "V")[0].toUpperCase()}
                            </div>
                            <span className="font-semibold">{c.name ?? "Web visitor"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ink-mid text-[12.5px]">
                          <div>{c.phone ?? "—"}</div>
                          {c.email && <div className="text-ink-soft">{c.email}</div>}
                        </td>
                        <td className="px-4 py-3 text-ink-mid text-[12.5px]">
                          {LANGUAGE_LABELS[c.language] ?? c.language}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {lastConv ? (
                            <Link
                              href={`/conversations?c=${lastConv.id}`}
                              className="font-mono text-[12.5px] text-accent hover:text-accent-strong font-semibold"
                            >
                              {c._count.conversations}
                            </Link>
                          ) : (
                            <span className="font-mono text-[12.5px] text-ink-soft">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-[12.5px]">
                          {c._count.leads}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-[12.5px]">
                          {c._count.appointments}
                        </td>
                        <td className="px-4 py-3 text-ink-soft text-[12.5px]">
                          {formatDistanceToNow(lastConv?.updatedAt ?? c.updatedAt, { addSuffix: true })}
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
