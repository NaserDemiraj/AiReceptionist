import { Card } from "@/components/ui";
import { Topbar } from "@/components/layout/topbar";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { ProductForm } from "@/features/products/components/product-form";

export const metadata = { title: "New product" };

export default async function NewProductPage() {
  const { org } = await requireOrg();
  const categories = await prisma.productCategory.findMany({
    where: { organizationId: org.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <>
      <Topbar title="New product" />
      <div className="flex-1 overflow-y-auto px-[26px] pt-6 pb-10">
        <Card className="max-w-[720px] p-6">
          <ProductForm
            categories={categories}
            initial={{
              name: "",
              sku: "",
              categoryId: "",
              description: "",
              price: "",
              salePrice: "",
              stock: "0",
              style: "",
              colors: "",
              materials: "",
              widthCm: "",
              depthCm: "",
              heightCm: "",
              seats: "",
              deliveryDays: "",
              warrantyMonths: "",
              isActive: true,
            }}
          />
        </Card>
      </div>
    </>
  );
}
