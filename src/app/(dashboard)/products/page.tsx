import Link from "next/link";
import { Plus, Sofa } from "lucide-react";
import { Badge, Card, EmptyState, cx } from "@/components/ui";
import { Topbar } from "@/components/layout/topbar";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/features/shared/labels";

export const metadata = { title: "Products" };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { org } = await requireOrg();
  const params = await searchParams;

  const categories = await prisma.productCategory.findMany({
    where: { organizationId: org.id },
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });

  const activeCategory = categories.find((c) => c.slug === params.category);

  const products = await prisma.product.findMany({
    where: {
      organizationId: org.id,
      ...(activeCategory ? { categoryId: activeCategory.id } : {}),
    },
    orderBy: { name: "asc" },
    take: 200,
    include: { category: true },
  });

  const totalCount = categories.reduce((sum, c) => sum + c._count.products, 0);

  return (
    <>
      <Topbar
        title="Products"
        actions={
          <Link
            href="/products/new"
            className="h-9 px-4 bg-accent hover:bg-accent-strong text-white rounded-[9px] text-[13px] font-semibold inline-flex items-center gap-1.5"
          >
            <Plus size={15} strokeWidth={2.4} />
            Add product
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto px-[26px] pt-6 pb-10">
        <div className="flex gap-1.5 mb-4 flex-wrap">
          <Link
            href="/products"
            className={cx(
              "px-3 py-1.5 rounded-lg text-[12.5px] font-medium inline-flex items-center gap-1.5",
              !activeCategory
                ? "bg-accent-soft text-accent font-semibold"
                : "text-ink-mid hover:bg-hover bg-card border border-line",
            )}
          >
            All <span className="font-mono text-[10.5px] text-ink-soft">{totalCount}</span>
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/products?category=${c.slug}`}
              className={cx(
                "px-3 py-1.5 rounded-lg text-[12.5px] font-medium inline-flex items-center gap-1.5",
                activeCategory?.id === c.id
                  ? "bg-accent-soft text-accent font-semibold"
                  : "text-ink-mid hover:bg-hover bg-card border border-line",
              )}
            >
              {c.name}
              <span className="font-mono text-[10.5px] text-ink-soft">{c._count.products}</span>
            </Link>
          ))}
        </div>

        <Card className="overflow-hidden">
          {products.length === 0 ? (
            <EmptyState
              title="No products yet"
              hint="Add products or connect your CMS so the AI can recommend them to customers."
              icon={<Sofa size={28} />}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className="font-mono text-[10.5px] uppercase tracking-wider text-ink-soft font-medium px-4 py-3">Product</th>
                    <th className="font-mono text-[10.5px] uppercase tracking-wider text-ink-soft font-medium px-4 py-3">Category</th>
                    <th className="font-mono text-[10.5px] uppercase tracking-wider text-ink-soft font-medium px-4 py-3">Price</th>
                    <th className="font-mono text-[10.5px] uppercase tracking-wider text-ink-soft font-medium px-4 py-3">Stock</th>
                    <th className="font-mono text-[10.5px] uppercase tracking-wider text-ink-soft font-medium px-4 py-3">Colors</th>
                    <th className="font-mono text-[10.5px] uppercase tracking-wider text-ink-soft font-medium px-4 py-3">Delivery</th>
                    <th className="font-mono text-[10.5px] uppercase tracking-wider text-ink-soft font-medium px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-b border-line last:border-0 hover:bg-row-hover">
                      <td className="px-4 py-3">
                        <Link href={`/products/${p.id}/edit`} className="group">
                          <div className="font-semibold group-hover:text-accent">{p.name}</div>
                          {p.sku && <div className="font-mono text-[11px] text-ink-soft">{p.sku}</div>}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-ink-mid">{p.category?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        {p.salePrice ? (
                          <div>
                            <span className="font-mono text-[12.5px] font-semibold text-positive-strong">
                              {formatMoney(p.salePrice, p.currency)}
                            </span>{" "}
                            <span className="font-mono text-[11px] text-ink-soft line-through">
                              {formatMoney(p.price, p.currency)}
                            </span>
                          </div>
                        ) : (
                          <span className="font-mono text-[12.5px]">{formatMoney(p.price, p.currency)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cx(
                            "font-mono text-[12.5px]",
                            p.stock === 0 ? "text-danger" : p.stock < 5 ? "text-warn" : "text-ink",
                          )}
                        >
                          {p.stock}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-mid text-[12.5px]">
                        {p.colors.length ? p.colors.join(", ") : "—"}
                      </td>
                      <td className="px-4 py-3 text-ink-mid text-[12.5px]">
                        {p.deliveryDays ? `${p.deliveryDays} days` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {p.isActive ? (
                          <Badge tone="positive">Active</Badge>
                        ) : (
                          <Badge tone="neutral">Hidden</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
