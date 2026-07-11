"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { forbidden, notFound } from "@/lib/errors";

export type ProductFormState = { error?: string } | undefined;

const csvToList = (v: unknown) =>
  typeof v === "string"
    ? v.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

const optionalNumber = (v: unknown) => {
  if (typeof v !== "string" || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const productSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Product name is too short").max(140),
  sku: z.string().max(40),
  categoryId: z.string(),
  newCategory: z.string().max(60),
  description: z.string().max(2000),
  price: z.coerce.number().positive("Price must be a positive number"),
  salePrice: z.preprocess(optionalNumber, z.number().positive().optional()),
  stock: z.coerce.number().int().min(0),
  style: z.string().max(60),
  colors: z.preprocess(csvToList, z.array(z.string().max(40)).max(12)),
  materials: z.preprocess(csvToList, z.array(z.string().max(40)).max(12)),
  widthCm: z.preprocess(optionalNumber, z.number().positive().optional()),
  depthCm: z.preprocess(optionalNumber, z.number().positive().optional()),
  heightCm: z.preprocess(optionalNumber, z.number().positive().optional()),
  seats: z.preprocess(optionalNumber, z.number().int().positive().optional()),
  deliveryDays: z.preprocess(optionalNumber, z.number().int().positive().optional()),
  warrantyMonths: z.preprocess(optionalNumber, z.number().int().positive().optional()),
  isActive: z.coerce.boolean(),
});

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function saveProduct(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const { org, user, role } = await requireOrg();
  if (role === "AGENT") throw forbidden("Only owners and admins can edit products");

  const raw = Object.fromEntries(formData);
  const parsed = productSchema.safeParse({ ...raw, isActive: raw.isActive === "on" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (d.salePrice && d.salePrice >= d.price) {
    return { error: "Sale price must be lower than the regular price." };
  }

  // Resolve category: create a new one if requested, else use the selected id
  let categoryId: string | null = d.categoryId || null;
  if (d.newCategory.trim()) {
    const slug = slugify(d.newCategory) || "category";
    const cat = await prisma.productCategory.upsert({
      where: { organizationId_slug: { organizationId: org.id, slug } },
      create: { organizationId: org.id, name: d.newCategory.trim(), slug },
      update: {},
    });
    categoryId = cat.id;
  } else if (categoryId) {
    const owned = await prisma.productCategory.findFirst({
      where: { id: categoryId, organizationId: org.id },
      select: { id: true },
    });
    if (!owned) categoryId = null;
  }

  const dimensions =
    d.widthCm || d.depthCm || d.heightCm || d.seats
      ? {
          ...(d.widthCm ? { widthCm: d.widthCm } : {}),
          ...(d.depthCm ? { depthCm: d.depthCm } : {}),
          ...(d.heightCm ? { heightCm: d.heightCm } : {}),
          ...(d.seats ? { seats: d.seats } : {}),
        }
      : undefined;

  const data = {
    name: d.name,
    sku: d.sku.trim() || null,
    categoryId,
    description: d.description.trim() || null,
    price: d.price,
    salePrice: d.salePrice ?? null,
    stock: d.stock,
    style: d.style.trim() || null,
    colors: d.colors,
    materials: d.materials,
    dimensions,
    deliveryDays: d.deliveryDays ?? null,
    warrantyMonths: d.warrantyMonths ?? null,
    isActive: d.isActive,
  };

  if (d.id) {
    const existing = await prisma.product.findFirst({
      where: { id: d.id, organizationId: org.id },
      select: { id: true },
    });
    if (!existing) throw notFound("Product not found");
    await prisma.product.update({ where: { id: d.id }, data });
  } else {
    await prisma.product.create({ data: { ...data, organizationId: org.id } });
  }

  await prisma.auditLog.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      action: d.id ? "product.update" : "product.create",
      entityType: "Product",
      entityId: d.id,
      metadata: { name: d.name },
    },
  });

  revalidatePath("/products");
  redirect("/products");
}

export async function deleteProduct(formData: FormData): Promise<void> {
  const { org, user, role } = await requireOrg();
  if (role === "AGENT") throw forbidden("Only owners and admins can delete products");

  const id = z.string().min(1).parse(formData.get("productId"));
  const product = await prisma.product.findFirst({
    where: { id, organizationId: org.id },
    select: { id: true, name: true },
  });
  if (!product) throw notFound("Product not found");

  await prisma.$transaction([
    prisma.product.delete({ where: { id: product.id } }),
    prisma.auditLog.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        action: "product.delete",
        entityType: "Product",
        entityId: product.id,
        metadata: { name: product.name },
      },
    }),
  ]);

  revalidatePath("/products");
  redirect("/products");
}
