import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { ToolDefinition } from "./provider";

/** Everything a tool needs to act safely inside one tenant + conversation. */
export interface ToolContext {
  orgId: string;
  conversationId: string;
  customerId: string;
  currency: string;
  /** Products surfaced by the last search — used for widget product cards. */
  lastProducts: ProductCard[];
}

export interface ProductCard {
  id: string;
  name: string;
  price: number;
  salePrice: number | null;
  currency: string;
  stock: number;
  colors: string[];
  deliveryDays: number | null;
  image: string | null;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "searchProducts",
    description:
      "Search the store's product catalog. ALWAYS use this before recommending or quoting any product — never invent products, prices, or stock.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text terms, e.g. 'corner sofa' or 'bed'" },
        category: {
          type: "string",
          description: "Category name, e.g. sofas, beds, dining, wardrobes, chairs, tables",
        },
        maxPrice: { type: "number", description: "Maximum price in EUR" },
        minPrice: { type: "number", description: "Minimum price in EUR" },
        color: { type: "string", description: "Desired color, e.g. grey" },
        style: { type: "string", description: "Style, e.g. modern, scandinavian, industrial" },
        minSeats: { type: "number", description: "Minimum seats (sofas/dining tables)" },
      },
    },
  },
  {
    name: "captureLead",
    description:
      "Save the customer as a sales lead. Call this as soon as the customer shares their name AND a phone number or email, or expresses clear buying intent with contact details.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Customer's name" },
        phone: { type: "string", description: "Phone number if provided" },
        email: { type: "string", description: "Email if provided" },
        interestedIn: { type: "string", description: "Short summary of what they want" },
        budget: { type: "number", description: "Budget in EUR if mentioned" },
        preferredContactTime: { type: "string", description: "When they prefer to be contacted" },
        productIds: {
          type: "array",
          items: { type: "string" },
          description: "IDs of products (from searchProducts results) they're interested in",
        },
      },
      required: ["interestedIn"],
    },
  },
  {
    name: "bookAppointment",
    description:
      "Book a showroom visit or consultation once the customer confirms a specific date and time. Times are in the store's local timezone.",
    parameters: {
      type: "object",
      properties: {
        customerName: { type: "string", description: "Customer's name" },
        phone: { type: "string", description: "Phone number for confirmation" },
        type: {
          type: "string",
          enum: ["SHOWROOM_VISIT", "CONSULTATION"],
          description: "Kind of appointment",
        },
        startsAt: {
          type: "string",
          description: "Start date-time in ISO 8601, e.g. 2026-07-12T10:30:00",
        },
        notes: { type: "string", description: "What the visit is about" },
      },
      required: ["type", "startsAt"],
    },
  },
  {
    name: "searchKnowledge",
    description:
      "Search the business's knowledge base: delivery, payment methods, installments, warranty, returns, assembly, opening hours, company info, and other FAQs/policies. Use this for ANY non-product question before answering. Include both the customer's key words and their English translation in the query.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Key words to search for, e.g. 'delivery outside Tirana dërgesa jashtë'",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "requestHuman",
    description:
      "Escalate this conversation to a human team member. Use ONLY when the customer explicitly asks for a person, is clearly upset, or asks about something you genuinely cannot handle (existing order status, refunds, custom manufacturing). NEVER use it for vague or general shopping questions — ask a clarifying question or search the catalog instead.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Why a human is needed" },
      },
      required: ["reason"],
    },
  },
];

/* ============================================================
 * Executors
 * ============================================================ */

const effectivePrice = (p: { price: Prisma.Decimal; salePrice: Prisma.Decimal | null }) =>
  Number(p.salePrice ?? p.price);

/** Models sometimes send numbers as strings ("900") — accept both. */
function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^\d.,-]/g, "").replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

async function searchProducts(ctx: ToolContext, args: Record<string, unknown>): Promise<string> {
  const query = typeof args.query === "string" ? args.query : undefined;
  const category = typeof args.category === "string" ? args.category : undefined;
  const color = typeof args.color === "string" ? args.color : undefined;
  const style = typeof args.style === "string" ? args.style : undefined;
  const maxPrice = num(args.maxPrice);
  const minPrice = num(args.minPrice);
  const minSeats = num(args.minSeats);

  const terms = query?.toLowerCase().split(/\s+/).filter((t) => t.length > 2) ?? [];

  const rows = await prisma.product.findMany({
    where: {
      organizationId: ctx.orgId,
      isActive: true,
      ...(category
        ? { category: { is: { name: { contains: category, mode: "insensitive" } } } }
        : {}),
      ...(style ? { style: { contains: style, mode: "insensitive" } } : {}),
    },
    include: { category: true },
    take: 100,
  });

  const matchesStructured = (p: (typeof rows)[number]) => {
    const price = effectivePrice(p);
    if (maxPrice !== undefined && price > maxPrice) return false;
    if (minPrice !== undefined && price < minPrice) return false;
    if (color && !p.colors.some((c) => c.toLowerCase().includes(color.toLowerCase()))) return false;
    if (minSeats !== undefined) {
      const seats = (p.dimensions as { seats?: number } | null)?.seats;
      if (!seats || seats < minSeats) return false;
    }
    return true;
  };
  const matchesTerms = (p: (typeof rows)[number]) => {
    if (!terms.length) return true;
    const hay = `${p.name} ${p.description ?? ""} ${p.category?.name ?? ""} ${p.style ?? ""}`.toLowerCase();
    return terms.some((t) => hay.includes(t));
  };

  let results = rows.filter((p) => matchesStructured(p) && matchesTerms(p));
  // Text terms are a soft signal (may be in the customer's language) —
  // if they eliminate everything, fall back to the structured filters alone.
  if (results.length === 0 && terms.length) {
    results = rows.filter(matchesStructured);
  }

  results = results.sort((a, b) => effectivePrice(a) - effectivePrice(b)).slice(0, 5);

  ctx.lastProducts = results.map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
    salePrice: p.salePrice ? Number(p.salePrice) : null,
    currency: p.currency,
    stock: p.stock,
    colors: p.colors,
    deliveryDays: p.deliveryDays,
    image: p.images[0] ?? null,
  }));

  if (results.length === 0) {
    return JSON.stringify({ found: 0, message: "No products match. Suggest loosening a filter." });
  }

  return JSON.stringify({
    found: results.length,
    products: results.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category?.name,
      price: Number(p.price),
      salePrice: p.salePrice ? Number(p.salePrice) : undefined,
      currency: p.currency,
      stock: p.stock,
      colors: p.colors,
      materials: p.materials,
      style: p.style,
      dimensions: p.dimensions,
      deliveryDays: p.deliveryDays,
      warrantyMonths: p.warrantyMonths,
    })),
  });
}

async function captureLead(ctx: ToolContext, args: Record<string, unknown>): Promise<string> {
  const name = typeof args.name === "string" ? args.name.trim() : undefined;
  const phone = typeof args.phone === "string" ? args.phone.trim() : undefined;
  const email = typeof args.email === "string" ? args.email.trim() : undefined;
  const interestedIn = typeof args.interestedIn === "string" ? args.interestedIn : "General inquiry";
  const budget = num(args.budget);
  const preferredContactTime =
    typeof args.preferredContactTime === "string" ? args.preferredContactTime : undefined;
  const productIds = Array.isArray(args.productIds)
    ? args.productIds.filter((x): x is string => typeof x === "string")
    : [];

  // Enrich the customer record with whatever we just learned
  await prisma.customer.update({
    where: { id: ctx.customerId },
    data: {
      ...(name ? { name } : {}),
      ...(phone ? { phone } : {}),
      ...(email ? { email } : {}),
    },
  });

  // Only link products that really belong to this org (the model echoes IDs)
  const validProducts = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds }, organizationId: ctx.orgId },
        select: { id: true, price: true, salePrice: true },
      })
    : [];
  const estimatedValue = validProducts.length
    ? validProducts.reduce((sum, p) => sum + effectivePrice(p), 0)
    : undefined;

  // One lead per conversation — update it if the AI learns more
  const existing = await prisma.lead.findFirst({
    where: { organizationId: ctx.orgId, conversationId: ctx.conversationId },
  });

  const lead = existing
    ? await prisma.lead.update({
        where: { id: existing.id },
        data: {
          interestedIn,
          ...(budget !== undefined ? { budget } : {}),
          ...(preferredContactTime ? { preferredContactTime } : {}),
          ...(estimatedValue !== undefined ? { estimatedValue } : {}),
        },
      })
    : await prisma.lead.create({
        data: {
          organizationId: ctx.orgId,
          customerId: ctx.customerId,
          conversationId: ctx.conversationId,
          status: "NEW",
          interestedIn,
          budget,
          preferredContactTime,
          estimatedValue,
          currency: ctx.currency,
        },
      });

  if (validProducts.length) {
    await prisma.leadProduct.createMany({
      data: validProducts.map((p) => ({ leadId: lead.id, productId: p.id })),
      skipDuplicates: true,
    });
  }

  const highValue = (budget ?? estimatedValue ?? 0) >= 800;
  await prisma.notification.create({
    data: {
      organizationId: ctx.orgId,
      type: highValue ? "HIGH_VALUE_LEAD" : "SYSTEM",
      title: highValue
        ? `High-value lead: ${name ?? "new customer"}`
        : `New lead: ${name ?? "new customer"}`,
      body: `${interestedIn}${budget ? ` · budget ${ctx.currency} ${budget}` : ""}`,
      payload: { leadId: lead.id, conversationId: ctx.conversationId },
    },
  });

  logger.info({ leadId: lead.id, orgId: ctx.orgId }, "lead captured by AI");
  return JSON.stringify({ ok: true, leadId: lead.id, message: "Lead saved. Thank the customer naturally." });
}

async function bookAppointment(ctx: ToolContext, args: Record<string, unknown>): Promise<string> {
  const type = args.type === "CONSULTATION" ? "CONSULTATION" : "SHOWROOM_VISIT";
  const startsAtRaw = typeof args.startsAt === "string" ? args.startsAt : "";
  const notes = typeof args.notes === "string" ? args.notes : undefined;
  const customerName = typeof args.customerName === "string" ? args.customerName.trim() : undefined;
  const phone = typeof args.phone === "string" ? args.phone.trim() : undefined;

  const startsAt = new Date(startsAtRaw);
  if (Number.isNaN(startsAt.getTime())) {
    return JSON.stringify({ ok: false, error: "Invalid date format. Ask the customer to confirm the date and time." });
  }
  if (startsAt.getTime() < Date.now()) {
    return JSON.stringify({ ok: false, error: "That time is in the past. Ask for a future date." });
  }
  const endsAt = new Date(startsAt.getTime() + 30 * 60_000);

  // Double-booking guard
  const conflict = await prisma.appointment.findFirst({
    where: {
      organizationId: ctx.orgId,
      status: { in: ["PENDING", "CONFIRMED"] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });
  if (conflict) {
    return JSON.stringify({
      ok: false,
      conflict: true,
      message: "That slot is already taken. Offer the customer a nearby time instead.",
    });
  }

  if (customerName || phone) {
    await prisma.customer.update({
      where: { id: ctx.customerId },
      data: { ...(customerName ? { name: customerName } : {}), ...(phone ? { phone } : {}) },
    });
  }

  const appointment = await prisma.appointment.create({
    data: {
      organizationId: ctx.orgId,
      customerId: ctx.customerId,
      type,
      status: "PENDING",
      startsAt,
      endsAt,
      notes,
    },
  });

  // If this conversation produced a lead, move it along the pipeline
  await prisma.lead.updateMany({
    where: {
      organizationId: ctx.orgId,
      conversationId: ctx.conversationId,
      status: { in: ["NEW", "CONTACTED", "QUALIFIED"] },
    },
    data: { status: "VISIT_BOOKED" },
  });

  await prisma.notification.create({
    data: {
      organizationId: ctx.orgId,
      type: "APPOINTMENT_BOOKED",
      title: `${type === "SHOWROOM_VISIT" ? "Showroom visit" : "Consultation"} booked`,
      body: `${customerName ?? "Customer"} — ${startsAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`,
      payload: { appointmentId: appointment.id, conversationId: ctx.conversationId },
    },
  });

  logger.info({ appointmentId: appointment.id, orgId: ctx.orgId }, "appointment booked by AI");
  return JSON.stringify({
    ok: true,
    appointmentId: appointment.id,
    message: "Booked. Confirm the date/time to the customer and mention they'll get a reminder.",
  });
}

async function searchKnowledge(ctx: ToolContext, args: Record<string, unknown>): Promise<string> {
  const query = typeof args.query === "string" ? args.query : "";
  const terms = [
    ...new Set(
      query
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((t) => t.length > 2),
    ),
  ];
  if (!terms.length) {
    return JSON.stringify({ found: 0, message: "Empty query" });
  }

  const chunks = await prisma.knowledgeChunk.findMany({
    where: { source: { is: { organizationId: ctx.orgId, status: "READY" } } },
    select: { content: true, heading: true, source: { select: { title: true } } },
    take: 500,
  });

  if (chunks.length === 0) {
    return JSON.stringify({
      found: 0,
      message:
        "The knowledge base is empty. Answer only from the business facts you already have; if you can't, offer to connect a team member.",
    });
  }

  const scored = chunks
    .map((c) => {
      const heading = (c.heading ?? "").toLowerCase();
      const content = c.content.toLowerCase();
      let score = 0;
      for (const t of terms) {
        if (heading.includes(t)) score += 3;
        if (content.includes(t)) score += 1;
      }
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (scored.length === 0) {
    return JSON.stringify({
      found: 0,
      message:
        "Nothing relevant found. If the business facts don't cover it either, say you'll check with the team rather than guessing.",
    });
  }

  return JSON.stringify({
    found: scored.length,
    entries: scored.map(({ c }) => ({
      source: c.source.title,
      heading: c.heading ?? undefined,
      content: c.content,
    })),
  });
}

async function requestHuman(ctx: ToolContext, args: Record<string, unknown>): Promise<string> {
  const reason = typeof args.reason === "string" ? args.reason : "Customer requested a human";

  await prisma.conversation.update({
    where: { id: ctx.conversationId },
    data: { status: "NEEDS_HUMAN" },
  });
  await prisma.message.create({
    data: {
      conversationId: ctx.conversationId,
      role: "SYSTEM",
      content: `AI requested human handoff — ${reason}`,
    },
  });
  await prisma.notification.create({
    data: {
      organizationId: ctx.orgId,
      type: "HUMAN_TAKEOVER",
      title: "Human needed in a conversation",
      body: reason,
      payload: { conversationId: ctx.conversationId },
    },
  });

  return JSON.stringify({
    ok: true,
    message:
      "Handoff registered. Tell the customer a team member will reply here shortly, and offer to keep helping meanwhile.",
  });
}

export async function executeTool(
  ctx: ToolContext,
  name: string,
  argsJson: string,
): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(argsJson);
  } catch {
    return JSON.stringify({ ok: false, error: "Invalid tool arguments" });
  }

  try {
    switch (name) {
      case "searchProducts":
        return await searchProducts(ctx, args);
      case "captureLead":
        return await captureLead(ctx, args);
      case "bookAppointment":
        return await bookAppointment(ctx, args);
      case "searchKnowledge":
        return await searchKnowledge(ctx, args);
      case "requestHuman":
        return await requestHuman(ctx, args);
      default:
        return JSON.stringify({ ok: false, error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    logger.error({ err, tool: name }, "tool execution failed");
    return JSON.stringify({ ok: false, error: "Tool failed — apologise and offer to connect a human." });
  }
}
