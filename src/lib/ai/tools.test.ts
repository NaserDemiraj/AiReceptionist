import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * AI tool executor tests — the core business logic the LLM drives.
 * Prisma and side-effect modules are mocked; each test checks both the
 * JSON the model gets back AND the database writes that were requested.
 */

const prismaMock = vi.hoisted(() => ({
  product: { findMany: vi.fn() },
  customer: { update: vi.fn(), findUnique: vi.fn() },
  lead: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  leadProduct: { createMany: vi.fn() },
  notification: { create: vi.fn() },
  appointment: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  organization: { findUnique: vi.fn() },
  knowledgeChunk: { findMany: vi.fn() },
  conversation: { update: vi.fn() },
  message: { create: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/webhooks", () => ({ dispatchWebhooks: vi.fn() }));
vi.mock("@/lib/integrations/google-calendar", () => ({
  syncAppointmentToCalendar: vi.fn(),
}));
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(),
  emailLayout: vi.fn((_t: string, body: string) => body),
}));
vi.mock("./embeddings", () => ({ semanticSearch: vi.fn().mockResolvedValue(null) }));

import { executeTool, type ToolContext } from "./tools";
import { dispatchWebhooks } from "@/lib/webhooks";
import { syncAppointmentToCalendar } from "@/lib/integrations/google-calendar";

function ctx(): ToolContext {
  return {
    orgId: "org_1",
    conversationId: "conv_1",
    customerId: "cust_1",
    currency: "EUR",
    lastProducts: [],
  };
}

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    name: "Milano Corner Sofa",
    description: "A comfy grey corner sofa",
    price: 900,
    salePrice: null,
    currency: "EUR",
    stock: 3,
    colors: ["Grey"],
    materials: ["fabric"],
    style: "modern",
    dimensions: { seats: 5 },
    images: [],
    deliveryDays: 10,
    warrantyMonths: 24,
    category: { name: "Sofas" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Benign defaults so tests only override what they assert on
  prismaMock.customer.update.mockResolvedValue({});
  prismaMock.customer.findUnique.mockResolvedValue(null);
  prismaMock.notification.create.mockResolvedValue({});
  prismaMock.lead.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.leadProduct.createMany.mockResolvedValue({ count: 0 });
  prismaMock.message.create.mockResolvedValue({});
  prismaMock.conversation.update.mockResolvedValue({});
  prismaMock.organization.findUnique.mockResolvedValue(null);
});

describe("executeTool plumbing", () => {
  it("rejects malformed JSON arguments", async () => {
    const out = JSON.parse(await executeTool(ctx(), "searchProducts", "{not json"));
    expect(out.ok).toBe(false);
  });

  it("rejects unknown tools", async () => {
    const out = JSON.parse(await executeTool(ctx(), "dropDatabase", "{}"));
    expect(out.ok).toBe(false);
    expect(out.error).toContain("Unknown tool");
  });

  it("turns executor crashes into a safe error message for the model", async () => {
    prismaMock.product.findMany.mockRejectedValue(new Error("db down"));
    const out = JSON.parse(await executeTool(ctx(), "searchProducts", "{}"));
    expect(out.ok).toBe(false);
    expect(out.error).toContain("apologise");
  });
});

describe("searchProducts", () => {
  it("filters by max price using the sale price when present", async () => {
    prismaMock.product.findMany.mockResolvedValue([
      product({ id: "cheap", price: 1000, salePrice: 450 }),
      product({ id: "expensive", price: 900 }),
    ]);
    const out = JSON.parse(await executeTool(ctx(), "searchProducts", '{"maxPrice": 500}'));
    expect(out.found).toBe(1);
    expect(out.products[0].id).toBe("cheap");
  });

  it("matches colors case-insensitively", async () => {
    prismaMock.product.findMany.mockResolvedValue([
      product({ id: "grey", colors: ["Light Grey"] }),
      product({ id: "blue", colors: ["Navy Blue"] }),
    ]);
    const out = JSON.parse(await executeTool(ctx(), "searchProducts", '{"color": "grey"}'));
    expect(out.found).toBe(1);
    expect(out.products[0].id).toBe("grey");
  });

  it("ranks name matches above description matches", async () => {
    prismaMock.product.findMany.mockResolvedValue([
      product({ id: "desc-hit", name: "Oslo Bed", description: "pairs well with a sofa" }),
      product({ id: "name-hit", name: "Corner Sofa Deluxe", description: "" }),
    ]);
    const out = JSON.parse(await executeTool(ctx(), "searchProducts", '{"query": "sofa"}'));
    expect(out.products[0].id).toBe("name-hit");
  });

  it("falls back to structured filters when foreign-language terms match nothing", async () => {
    prismaMock.product.findMany.mockResolvedValue([product({ id: "p1", price: 400 })]);
    const out = JSON.parse(
      await executeTool(ctx(), "searchProducts", '{"query": "krevat dopio", "maxPrice": 500}'),
    );
    expect(out.found).toBe(1); // terms matched nothing, but the price filter still applies
  });

  it("filters by minimum seats from dimensions", async () => {
    prismaMock.product.findMany.mockResolvedValue([
      product({ id: "big", dimensions: { seats: 6 } }),
      product({ id: "small", dimensions: { seats: 2 } }),
      product({ id: "none", dimensions: null }),
    ]);
    const out = JSON.parse(await executeTool(ctx(), "searchProducts", '{"minSeats": 4}'));
    expect(out.found).toBe(1);
    expect(out.products[0].id).toBe("big");
  });

  it("accepts numeric filters sent as strings by the model", async () => {
    prismaMock.product.findMany.mockResolvedValue([product({ id: "p1", price: 900 })]);
    const out = JSON.parse(await executeTool(ctx(), "searchProducts", '{"maxPrice": "500 EUR"}'));
    expect(out.found).toBe(0);
  });

  it("exposes results to the widget via ctx.lastProducts", async () => {
    prismaMock.product.findMany.mockResolvedValue([product()]);
    const c = ctx();
    await executeTool(c, "searchProducts", "{}");
    expect(c.lastProducts).toHaveLength(1);
    expect(c.lastProducts[0]).toMatchObject({ id: "p1", name: "Milano Corner Sofa", price: 900 });
  });
});

describe("bookAppointment", () => {
  const future = new Date(Date.now() + 48 * 3600_000).toISOString();

  it("rejects unparseable dates", async () => {
    const out = JSON.parse(
      await executeTool(ctx(), "bookAppointment", '{"type":"SHOWROOM_VISIT","startsAt":"tomorrow-ish"}'),
    );
    expect(out.ok).toBe(false);
    expect(prismaMock.appointment.create).not.toHaveBeenCalled();
  });

  it("rejects dates in the past", async () => {
    const out = JSON.parse(
      await executeTool(
        ctx(),
        "bookAppointment",
        JSON.stringify({ type: "SHOWROOM_VISIT", startsAt: "2020-01-01T10:00:00Z" }),
      ),
    );
    expect(out.ok).toBe(false);
    expect(out.error).toContain("past");
    expect(prismaMock.appointment.create).not.toHaveBeenCalled();
  });

  it("refuses to double-book an overlapping slot", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue({ id: "existing" });
    const out = JSON.parse(
      await executeTool(ctx(), "bookAppointment", JSON.stringify({ type: "SHOWROOM_VISIT", startsAt: future })),
    );
    expect(out.conflict).toBe(true);
    expect(prismaMock.appointment.create).not.toHaveBeenCalled();
  });

  it("books a 30-minute slot, advances the lead, notifies, syncs and dispatches", async () => {
    prismaMock.appointment.findFirst.mockResolvedValue(null);
    prismaMock.appointment.create.mockResolvedValue({ id: "appt_1" });

    const out = JSON.parse(
      await executeTool(
        ctx(),
        "bookAppointment",
        JSON.stringify({ type: "CONSULTATION", startsAt: future, customerName: "Ana", phone: "+35569" }),
      ),
    );

    expect(out.ok).toBe(true);
    const created = prismaMock.appointment.create.mock.calls[0][0].data;
    expect(created.type).toBe("CONSULTATION");
    expect(created.endsAt.getTime() - created.startsAt.getTime()).toBe(30 * 60_000);

    // Customer enriched with the details the AI collected
    expect(prismaMock.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: "Ana", phone: "+35569" } }),
    );
    // Lead pipeline advanced to VISIT_BOOKED
    expect(prismaMock.lead.updateMany.mock.calls[0][0].data.status).toBe("VISIT_BOOKED");
    expect(prismaMock.notification.create).toHaveBeenCalled();
    expect(syncAppointmentToCalendar).toHaveBeenCalledWith("appt_1");
    expect(dispatchWebhooks).toHaveBeenCalledWith(
      "org_1",
      "appointment.created",
      expect.objectContaining({ appointmentId: "appt_1" }),
    );
  });
});

describe("captureLead", () => {
  it("creates a lead, links only this org's products, and fires the webhook", async () => {
    prismaMock.lead.findFirst.mockResolvedValue(null);
    prismaMock.lead.create.mockResolvedValue({ id: "lead_1" });
    // Model echoed two IDs; only one belongs to this org
    prismaMock.product.findMany.mockResolvedValue([{ id: "p1", price: 700, salePrice: 600 }]);

    const out = JSON.parse(
      await executeTool(
        ctx(),
        "captureLead",
        JSON.stringify({
          name: "Ben",
          phone: "+491701",
          interestedIn: "Grey corner sofa",
          productIds: ["p1", "someone-elses-product"],
        }),
      ),
    );

    expect(out.ok).toBe(true);
    expect(prismaMock.lead.create.mock.calls[0][0].data).toMatchObject({
      organizationId: "org_1",
      status: "NEW",
      estimatedValue: 600, // sale price wins
    });
    expect(prismaMock.leadProduct.createMany.mock.calls[0][0].data).toEqual([
      { leadId: "lead_1", productId: "p1" },
    ]);
    expect(dispatchWebhooks).toHaveBeenCalledWith(
      "org_1",
      "lead.created",
      expect.objectContaining({ leadId: "lead_1" }),
    );
  });

  it("updates the existing lead of this conversation instead of duplicating", async () => {
    prismaMock.lead.findFirst.mockResolvedValue({ id: "lead_1" });
    prismaMock.lead.update.mockResolvedValue({ id: "lead_1" });

    const out = JSON.parse(
      await executeTool(ctx(), "captureLead", '{"interestedIn":"Now also wants a bed","budget":1200}'),
    );

    expect(out.ok).toBe(true);
    expect(prismaMock.lead.create).not.toHaveBeenCalled();
    expect(prismaMock.lead.update).toHaveBeenCalled();
    // No duplicate lead.created webhook for an update
    expect(dispatchWebhooks).not.toHaveBeenCalled();
  });

  it("flags leads at or above €800 as high-value", async () => {
    prismaMock.lead.findFirst.mockResolvedValue(null);
    prismaMock.lead.create.mockResolvedValue({ id: "lead_1" });

    await executeTool(ctx(), "captureLead", '{"interestedIn":"Full living room","budget":800}');
    expect(prismaMock.notification.create.mock.calls[0][0].data.type).toBe("HIGH_VALUE_LEAD");
  });
});

describe("requestHuman", () => {
  it("marks the conversation, leaves a system note, notifies and dispatches", async () => {
    const out = JSON.parse(
      await executeTool(ctx(), "requestHuman", '{"reason":"Angry about delivery"}'),
    );
    expect(out.ok).toBe(true);
    expect(prismaMock.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "NEEDS_HUMAN" } }),
    );
    expect(prismaMock.message.create.mock.calls[0][0].data.role).toBe("SYSTEM");
    expect(prismaMock.notification.create.mock.calls[0][0].data.type).toBe("HUMAN_TAKEOVER");
    expect(dispatchWebhooks).toHaveBeenCalledWith(
      "org_1",
      "conversation.needs_human",
      expect.objectContaining({ reason: "Angry about delivery" }),
    );
  });
});

describe("searchKnowledge (keyword fallback)", () => {
  it("scores heading hits above content hits", async () => {
    prismaMock.knowledgeChunk.findMany.mockResolvedValue([
      { content: "We deliver within 5 days.", heading: "Delivery", source: { title: "FAQ" } },
      { content: "Delivery is free over €500.", heading: "Pricing", source: { title: "FAQ" } },
    ]);
    const out = JSON.parse(await executeTool(ctx(), "searchKnowledge", '{"query":"delivery"}'));
    expect(out.found).toBe(2);
    expect(out.entries[0].heading).toBe("Delivery");
  });

  it("tells the model the knowledge base is empty rather than letting it guess", async () => {
    prismaMock.knowledgeChunk.findMany.mockResolvedValue([]);
    const out = JSON.parse(await executeTool(ctx(), "searchKnowledge", '{"query":"warranty"}'));
    expect(out.found).toBe(0);
    expect(out.message).toContain("knowledge base is empty");
  });

  it("handles queries with no usable terms", async () => {
    const out = JSON.parse(await executeTool(ctx(), "searchKnowledge", '{"query":"a b"}'));
    expect(out.found).toBe(0);
  });
});
