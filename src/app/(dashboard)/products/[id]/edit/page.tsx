import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { Topbar } from "@/components/layout/topbar";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import {
  DeleteProductButton,
  ProductForm,
} from "@/features/products/components/product-form";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { org } = await requireOrg();
  const { id } = await params;

  const [product, categories] = await Promise.all([
    prisma.product.findFirst({ where: { id, organizationId: org.id } }),
    prisma.productCategory.findMany({
      where: { organizationId: org.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!product) notFound();

  const dims = (product.dimensions ?? {}) as {
    widthCm?: number;
    depthCm?: number;
    heightCm?: number;
    seats?: number;
  };

  return (
    <>
      <Topbar title={product.name} />
      <div className="flex-1 overflow-y-auto px-[26px] pt-6 pb-10">
        <Card className="max-w-[720px] p-6">
          <ProductForm
            categories={categories}
            initial={{
              id: product.id,
              name: product.name,
              sku: product.sku ?? "",
              categoryId: product.categoryId ?? "",
              description: product.description ?? "",
              price: String(product.price),
              salePrice: product.salePrice ? String(product.salePrice) : "",
              stock: String(product.stock),
              style: product.style ?? "",
              colors: product.colors.join(", "),
              materials: product.materials.join(", "),
              widthCm: dims.widthCm ? String(dims.widthCm) : "",
              depthCm: dims.depthCm ? String(dims.depthCm) : "",
              heightCm: dims.heightCm ? String(dims.heightCm) : "",
              seats: dims.seats ? String(dims.seats) : "",
              deliveryDays: product.deliveryDays ? String(product.deliveryDays) : "",
              warrantyMonths: product.warrantyMonths ? String(product.warrantyMonths) : "",
              isActive: product.isActive,
            }}
          />
        </Card>
        <div className="max-w-[720px] mt-4 flex justify-end">
          <DeleteProductButton productId={product.id} name={product.name} />
        </div>
      </div>
    </>
  );
}
