import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSite } from "@/features/website/site-data";
import { formatMoney } from "@/features/shared/labels";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const org = await prisma.organization.findUnique({ where: { slug } });
  return { title: org ? `Products — ${org.name}` : "Products" };
}

export default async function SiteProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { slug } = await params;
  const { category } = await searchParams;
  const { org, site } = await getSite(slug);
  const accent = site.primaryColor;

  const categories = await prisma.productCategory.findMany({
    where: { organizationId: org.id },
    orderBy: { name: "asc" },
  });
  const activeCategory = categories.find((c) => c.slug === category);

  const products = await prisma.product.findMany({
    where: {
      organizationId: org.id,
      isActive: true,
      ...(activeCategory ? { categoryId: activeCategory.id } : {}),
    },
    orderBy: { name: "asc" },
    take: 200,
    include: { category: true },
  });

  return (
    <div className="bg-white text-[#17171A] min-h-screen">
      <nav className="sticky top-0 z-20 h-16 bg-white/90 backdrop-blur-lg border-b border-[#EEEEF0] flex items-center gap-4 px-6 lg:px-10">
        <Link
          href={`/site/${slug}`}
          className="flex items-center gap-1.5 text-[13.5px] font-medium text-[#5A5A64] hover:text-[#17171A]"
        >
          <ArrowLeft size={15} />
          {org.name}
        </Link>
        <div className="flex-1" />
        <span className="font-display font-semibold text-[15px]">Products</span>
      </nav>

      <div className="max-w-[1080px] mx-auto px-6 lg:px-10 py-10">
        <div className="flex gap-2 mb-8 flex-wrap">
          <Link
            href={`/site/${slug}/products`}
            className="px-3.5 py-1.5 rounded-full text-[13px] font-medium border"
            style={
              !activeCategory
                ? { background: accent, color: "#fff", borderColor: accent }
                : { borderColor: "#E0E0E6", color: "#5A5A64" }
            }
          >
            All
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/site/${slug}/products?category=${c.slug}`}
              className="px-3.5 py-1.5 rounded-full text-[13px] font-medium border"
              style={
                activeCategory?.id === c.id
                  ? { background: accent, color: "#fff", borderColor: accent }
                  : { borderColor: "#E0E0E6", color: "#5A5A64" }
              }
            >
              {c.name}
            </Link>
          ))}
        </div>

        {products.length === 0 ? (
          <p className="text-center text-[#9A9AA5] py-20">No products in this category yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map((p) => {
              const dims = p.dimensions as { widthCm?: number; seats?: number } | null;
              return (
                <div key={p.id} className="bg-white border border-[#EEEEF0] rounded-2xl overflow-hidden">
                  <div
                    className="h-[150px] flex items-end p-3"
                    style={{ background: `linear-gradient(135deg, ${accent}14, ${accent}30)` }}
                  >
                    {p.category && (
                      <span className="text-[10.5px] font-mono uppercase tracking-wide bg-white/85 rounded-md px-2 py-0.5 text-[#5A5A64]">
                        {p.category.name}
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="text-[14.5px] font-semibold">{p.name}</div>
                    <div className="text-[12px] text-[#9A9AA5] mt-0.5">
                      {[
                        p.colors.slice(0, 3).join(", "),
                        dims?.widthCm ? `${dims.widthCm}cm` : null,
                        dims?.seats ? `${dims.seats} seats` : null,
                        p.deliveryDays ? `delivery ${p.deliveryDays}d` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    <div className="mt-2 text-[14.5px]">
                      {p.salePrice ? (
                        <>
                          <span className="font-semibold" style={{ color: accent }}>
                            {formatMoney(p.salePrice, p.currency)}
                          </span>{" "}
                          <span className="text-[12px] text-[#9A9AA5] line-through">
                            {formatMoney(p.price, p.currency)}
                          </span>
                        </>
                      ) : (
                        <span className="font-semibold">{formatMoney(p.price, p.currency)}</span>
                      )}
                    </div>
                    <div className="text-[11.5px] mt-1.5" style={{ color: p.stock > 0 ? "#12805C" : "#C4362E" }}>
                      {p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-center text-[13px] text-[#9A9AA5] mt-12">
          Questions about a product? Ask our assistant in the chat — it knows sizes, colors,
          stock and delivery times.
        </p>
      </div>

      <Script src="/widget.js" data-key={org.widgetKey} strategy="afterInteractive" />
    </div>
  );
}
