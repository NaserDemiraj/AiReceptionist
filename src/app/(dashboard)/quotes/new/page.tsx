import { Card } from "@/components/ui";
import { Topbar } from "@/components/layout/topbar";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { QuoteBuilder } from "@/features/quotes/components/quote-builder";
import type { QuoteItem } from "@/features/quotes/pdf";

export const metadata = { title: "New quote" };

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const { org } = await requireOrg();
  const params = await searchParams;

  const [customers, products, lead] = await Promise.all([
    prisma.customer.findMany({
      where: { organizationId: org.id, OR: [{ name: { not: null } }, { email: { not: null } }] },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    prisma.product.findMany({
      where: { organizationId: org.id, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, price: true, salePrice: true },
    }),
    params.lead
      ? prisma.lead.findFirst({
          where: { id: params.lead, organizationId: org.id },
          include: { products: { include: { product: true } } },
        })
      : null,
  ]);

  // Prefill line items from the lead's interested products
  const initialItems: QuoteItem[] =
    lead?.products.map((lp) => ({
      productId: lp.product.id,
      name: lp.product.name,
      quantity: 1,
      unitPrice: Number(lp.product.salePrice ?? lp.product.price),
      discountPct: 0,
    })) ?? [];

  return (
    <>
      <Topbar title="New quote" />
      <div className="flex-1 overflow-y-auto px-[26px] pt-6 pb-10">
        <Card className="max-w-[820px] p-6">
          <QuoteBuilder
            currency={org.currency}
            customers={customers.map((c) => ({
              id: c.id,
              label: `${c.name ?? "Unnamed"}${c.phone ? ` · ${c.phone}` : c.email ? ` · ${c.email}` : ""}`,
            }))}
            products={products.map((p) => ({
              id: p.id,
              name: p.name,
              price: Number(p.price),
              salePrice: p.salePrice ? Number(p.salePrice) : null,
            }))}
            initialCustomerId={lead?.customerId}
            leadId={lead?.id}
            initialItems={initialItems}
          />
        </Card>
      </div>
    </>
  );
}
