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

    const results: Array<{ externalId: string; id: string; action: "created" | "updated" }> = [];

    for (const item of items) {
      // Category by name — created on first use so CMSs don't pre-register them
      let categoryId: string | null = null;
      if (item.category) {
        const category = await prisma.productCategory.upsert({
          where: { organizationId_slug: { organizationId: orgId, slug: slugify(item.category) } },
          create: { organizationId: orgId, name: item.category, slug: slugify(item.category) },
          update: {},
        });
        categoryId = category.id;
      }

      const data = {
        name: item.name,
        description: item.description ?? null,
        sku: item.sku ?? null,
        categoryId,
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
      };

      const existing = await prisma.product.findUnique({
        where: { organizationId_externalId: { organizationId: orgId, externalId: item.externalId } },
        select: { id: true },
      });
      const product = existing
        ? await prisma.product.update({ where: { id: existing.id }, data })
        : await prisma.product.create({
            data: { ...data, organizationId: orgId, externalId: item.externalId },
          });
      results.push({
        externalId: item.externalId,
        id: product.id,
        action: existing ? "updated" : "created",
      });
    }

    logger.info({ orgId, count: results.length }, "products synced via API");
    return NextResponse.json({ synced: results.length, results });
  } catch (err) {
    return errorResponse(err);
  }
}
