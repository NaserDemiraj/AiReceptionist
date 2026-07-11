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

export type ImportState =
  | { error?: string; imported?: number; skipped?: { line: number; reason: string }[] }
  | undefined;

/**
 * CSV import. Required columns: name, price.
 * Optional: sku, category, description, saleprice, stock, colors, materials,
 * style, widthcm, depthcm, heightcm, seats, deliverydays, warrantymonths.
 * `colors`/`materials` are ; or | separated inside the cell.
 */
export async function importProductsCsv(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const { org, user, role } = await requireOrg();
  if (role === "AGENT") throw forbidden("Only owners and admins can import products");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file first." };
  if (file.size > 2 * 1024 * 1024) return { error: "File too large (max 2 MB)." };

  const { parseCsv } = await import("./csv");
  const rows = parseCsv(await file.text());
  if (rows.length < 2) return { error: "The file has no data rows." };

  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/[^a-z]/g, ""));
  const col = (name: string) => header.indexOf(name);
  if (col("name") === -1 || col("price") === -1) {
    return { error: 'The header row must include "name" and "price" columns.' };
  }

  const cell = (row: string[], name: string): string => {
    const i = col(name);
    return i === -1 ? "" : (row[i] ?? "").trim();
  };
  const num = (s: string): number | null => {
    if (!s) return null;
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };
  const list = (s: string): string[] =>
    s.split(/[;|]/).map((x) => x.trim()).filter(Boolean);

  // Cache categories by lowercase name
  const categories = new Map(
    (
      await prisma.productCategory.findMany({ where: { organizationId: org.id } })
    ).map((c) => [c.name.toLowerCase(), c.id]),
  );

  let imported = 0;
  const skipped: { line: number; reason: string }[] = [];

  for (let r = 1; r < rows.length && imported < 500; r++) {
    const row = rows[r];
    const line = r + 1;
    const name = cell(row, "name");
    const price = num(cell(row, "price"));
    if (!name || name.length < 2) {
      skipped.push({ line, reason: "missing name" });
      continue;
    }
    if (price === null || price <= 0) {
      skipped.push({ line, reason: "invalid price" });
      continue;
    }

    let categoryId: string | null = null;
    const categoryName = cell(row, "category");
    if (categoryName) {
      const key = categoryName.toLowerCase();
      if (!categories.has(key)) {
        const slugBase = key.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "category";
        const cat = await prisma.productCategory.upsert({
          where: { organizationId_slug: { organizationId: org.id, slug: slugBase } },
          create: { organizationId: org.id, name: categoryName, slug: slugBase },
          update: {},
        });
        categories.set(key, cat.id);
      }
      categoryId = categories.get(key) ?? null;
    }

    const salePrice = num(cell(row, "saleprice"));
    const dims: Record<string, number> = {};
    for (const d of ["widthcm", "depthcm", "heightcm", "seats"] as const) {
      const v = num(cell(row, d));
      if (v) dims[d === "widthcm" ? "widthCm" : d === "depthcm" ? "depthCm" : d === "heightcm" ? "heightCm" : "seats"] = v;
    }

    try {
      await prisma.product.create({
        data: {
          organizationId: org.id,
          categoryId,
          name,
          sku: cell(row, "sku") || null,
          description: cell(row, "description") || null,
          price,
          salePrice: salePrice && salePrice < price ? salePrice : null,
          stock: Math.max(0, Math.trunc(num(cell(row, "stock")) ?? 0)),
          colors: list(cell(row, "colors")),
          materials: list(cell(row, "materials")),
          style: cell(row, "style") || null,
          dimensions: Object.keys(dims).length ? dims : undefined,
          deliveryDays: num(cell(row, "deliverydays"))
            ? Math.trunc(num(cell(row, "deliverydays"))!)
            : null,
          warrantyMonths: num(cell(row, "warrantymonths"))
            ? Math.trunc(num(cell(row, "warrantymonths"))!)
            : null,
        },
      });
      imported++;
    } catch {
      skipped.push({ line, reason: "database error (duplicate SKU/external id?)" });
    }
  }

  await prisma.auditLog.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      action: "product.import",
      entityType: "Product",
      metadata: { imported, skipped: skipped.length, fileName: file.name },
    },
  });

  revalidatePath("/products");
  return { imported, skipped };
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
