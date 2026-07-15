import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { authenticateApiKey } from "@/lib/api-auth";
import { errorResponse } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";

/**
 * Public REST API — product catalog sync for external CMSs.
 * Auth: `Authorization: Bearer airk_...` (Settings → API keys).
 *
 * GET  /api/v1/products?page=1&limit=50 — list products
 * POST /api/v1/products — upsert one product or an array, keyed by externalId.
 *   Pushing the full catalog on every CMS change keeps both sides in sync
 *   with no manual re-entry ("no duplicate data entry").
 */

const productSchema = z.object({
  /** The CMS's own product id — the upsert key */
  externalId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  sku: z.string().max(64).optional(),
  category: z.string().max(80).optional(),
  price: z.number().nonnegative(),
  salePrice: z.number().nonnegative().nullish(),
  currency: z.string().length(3).optional(),
  stock: z.number().int().min(0).optional(),
  dimensions: z
    .object({
      widthCm: z.number().optional(),
      heightCm: z.number().optional(),
      depthCm: z.number().optional(),
      seats: z.number().optional(),
    })
    .optional(),
  materials: z.array(z.string()).optional(),
  colors: z.array(z.string()).optional(),
  style: z.string().max(60).optional(),
  images: z.array(z.string().url()).max(10).optional(),
  deliveryDays: z.number().int().min(0).nullish(),
  warrantyMonths: z.number().int().min(0).nullish(),
  isActive: z.boolean().optional(),
});

const postSchema = z.union([productSchema, z.array(productSchema).min(1).max(500)]);

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "general";
}

export async function GET(req: NextRequest) {
  try {
    const { orgId } = await authenticateApiKey(req);
    if (!(await rateLimit(`api:${orgId}`, 120, 60_000)).allowed) {
      throw new AppError("Rate limit exceeded", 429, "rate_limited");
    }

    const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? 1) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 50) || 50));

    const [total, products] = await Promise.all([
      prisma.product.count({ where: { organizationId: orgId } }),
      prisma.product.findMany({
        where: { organizationId: orgId },
        include: { category: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      page,
      limit,
      total,
      products: products.map((p) => ({
        id: p.id,
        externalId: p.externalId,
        sku: p.sku,
        name: p.name,
        description: p.description,
        category: p.category?.name ?? null,
        price: Number(p.price),
        salePrice: p.salePrice ? Number(p.salePrice) : null,
        currency: p.currency,
        stock: p.stock,
        dimensions: p.dimensions,
        materials: p.materials,
        colors: p.colors,
        style: p.style,
        images: p.images,
        deliveryDays: p.deliveryDays,
        warrantyMonths: p.warrantyMonths,
        isActive: p.isActive,
        lastSyncedAt: p.lastSyncedAt,
        updatedAt: p.updatedAt,
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { orgId } = await authenticateApiKey(req);
    if (!(await rateLimit(`api:${orgId}`, 120, 60_000)).allowed) {
      throw new AppError("Rate limit exceeded", 429, "rate_limited");
    }

    const parsed = postSchema.parse(await req.json());
    const items = Array.isArray(parsed) ? parsed : [parsed];
    const now = new Date();

    // 1. Resolve categories in bulk — created on first use so CMSs don't pre-register them
    const categoryNames = new Map<string, string>(); // slug → name (first occurrence wins)
    for (const item of items) {
      if (item.category) {
        const slug = slugify(item.category);
        if (!categoryNames.has(slug)) categoryNames.set(slug, item.category);
      }
    }
    const categoryIdBySlug = new Map<string, string>();
    if (categoryNames.size > 0) {
      const slugs = [...categoryNames.keys()];
      const existing = await prisma.productCategory.findMany({
        where: { organizationId: orgId, slug: { in: slugs } },
        select: { id: true, slug: true },
      });
      for (const c of existing) categoryIdBySlug.set(c.slug, c.id);

      const missing = slugs.filter((s) => !categoryIdBySlug.has(s));
      if (missing.length > 0) {
        await prisma.productCategory.createMany({
          data: missing.map((slug) => ({
            organizationId: orgId,
            name: categoryNames.get(slug)!,
            slug,
          })),
          skipDuplicates: true,
        });
        const created = await prisma.productCategory.findMany({
          where: { organizationId: orgId, slug: { in: missing } },
          select: { id: true, slug: true },
        });
        for (const c of created) categoryIdBySlug.set(c.slug, c.id);
      }
    }

    // 2. One lookup for all existing products by externalId
    const externalIds = items.map((i) => i.externalId);
    const existingProducts = await prisma.product.findMany({
      where: { organizationId: orgId, externalId: { in: externalIds } },
      select: { id: true, externalId: true },
    });
    const existingByExternalId = new Map(existingProducts.map((p) => [p.externalId!, p.id]));

    const toData = (item: (typeof items)[number]) => ({
      name: item.name,
      description: item.description ?? null,
      sku: item.sku ?? null,
      categoryId: item.category ? (categoryIdBySlug.get(slugify(item.category)) ?? null) : null,
      price: item.price,
      salePrice: item.salePrice ?? null,
      ...(item.currency ? { currency: item.currency.toUpperCase() } : {}),
      stock: item.stock ?? 0,
      dimensions: item.dimensions ?? undefined,
      materials: item.materials ?? [],
      colors: item.colors ?? [],
      style: item.style ?? null,
      images: item.images ?? [],
      deliveryDays: item.deliveryDays ?? null,
      warrantyMonths: item.warrantyMonths ?? null,
      isActive: item.isActive ?? true,
      lastSyncedAt: now,
    });

    // 3. Bulk-create the new ones, batch-update the existing ones in one transaction
    const creates = items.filter((i) => !existingByExternalId.has(i.externalId));
    const updates = items.filter((i) => existingByExternalId.has(i.externalId));

    if (creates.length > 0) {
      await prisma.product.createMany({
        data: creates.map((item) => ({
          ...toData(item),
          organizationId: orgId,
          externalId: item.externalId,
        })),
        skipDuplicates: true,
      });
    }
    if (updates.length > 0) {
      await prisma.$transaction(
        updates.map((item) =>
          prisma.product.update({
            where: { id: existingByExternalId.get(item.externalId)! },
            data: toData(item),
          }),
        ),
      );
    }

    // Fetch ids of newly created products for the response
    const createdProducts = creates.length
      ? await prisma.product.findMany({
          where: { organizationId: orgId, externalId: { in: creates.map((i) => i.externalId) } },
          select: { id: true, externalId: true },
        })
      : [];
    const createdByExternalId = new Map(createdProducts.map((p) => [p.externalId!, p.id]));

    const results = items.map((item) => {
      const existingId = existingByExternalId.get(item.externalId);
      return {
        externalId: item.externalId,
        id: existingId ?? createdByExternalId.get(item.externalId) ?? "",
        action: (existingId ? "updated" : "created") as "created" | "updated",
      };
    });

    logger.info(
      { orgId, count: results.length, created: creates.length, updated: updates.length },
      "products synced via API",
    );
    return NextResponse.json({ synced: results.length, results });
  } catch (err) {
    return errorResponse(err);
  }
}
