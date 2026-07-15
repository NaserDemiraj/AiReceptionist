import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { errorResponse, AppError } from "@/lib/errors";
import { processCustomerMessage } from "@/lib/ai/engine";
import { getPublicCorsHeaders } from "@/lib/cors";

const CORS_HEADERS = getPublicCorsHeaders();
// Public widget endpoint: rate-limited by IP + widgetKey, no sensitive data exposed

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const postSchema = z.object({
  widgetKey: z.string().min(10),
  visitorId: z.string().min(6).max(64),
  conversationId: z.string().optional(),
  message: z.string().min(1).max(2000),
});

/**
 * POST /api/v1/chat — the public endpoint the chat widget calls.
 * Auth = the org's widgetKey. One visitor = one Customer row (by visitorId).
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
    const body = postSchema.parse(await req.json());

    if (!rateLimit(`chat:${body.widgetKey}:${body.visitorId}`, 20, 60_000).allowed) {
      throw new AppError("Too many messages — please slow down.", 429, "rate_limited");
    }
    if (!rateLimit(`chat-ip:${ip}`, 60, 60_000).allowed) {
      throw new AppError("Too many requests.", 429, "rate_limited");
    }

    const org = await prisma.organization.findUnique({
      where: { widgetKey: body.widgetKey },
      select: { id: true },
    });
    if (!org) throw new AppError("Unknown widget key", 401, "unauthorized");

    // Resolve or create the visitor's customer record
    let customer = await prisma.customer.findFirst({
      where: { organizationId: org.id, visitorId: body.visitorId },
    });
    if (!customer) {
      customer = await prisma.customer.create({
        data: { organizationId: org.id, visitorId: body.visitorId },
      });
    }

    // Resolve or create the conversation (must belong to this org + customer)
    let conversationId = body.conversationId;
    if (conversationId) {
      const owned = await prisma.conversation.findFirst({
        where: { id: conversationId, organizationId: org.id, customerId: customer.id },
        select: { id: true },
      });
      if (!owned) conversationId = undefined;
    }
    if (!conversationId) {
      const conversation = await prisma.conversation.create({
        data: {
          organizationId: org.id,
          customerId: customer.id,
          channel: "WEB",
          status: "AI_ACTIVE",
        },
      });
      conversationId = conversation.id;
    }

    const result = await processCustomerMessage(conversationId, body.message);

    return NextResponse.json(
      {
        conversationId,
        reply: result.reply,
        products: result.products,
        status: result.status,
      },
      { headers: CORS_HEADERS },
    );
  } catch (err) {
    const res = errorResponse(err);
    for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
    return res;
  }
}

/**
 * GET /api/v1/chat?widgetKey=&visitorId=&conversationId=&after=
 * Widget polling: returns messages (optionally only those after a message id)
 * so agent replies reach the customer without websockets.
 */
export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const widgetKey = url.searchParams.get("widgetKey") ?? "";
    const visitorId = url.searchParams.get("visitorId") ?? "";
    const conversationId = url.searchParams.get("conversationId") ?? "";
    const after = url.searchParams.get("after");

    if (!rateLimit(`chat-poll:${widgetKey}:${visitorId}`, 60, 60_000).allowed) {
      throw new AppError("Too many requests.", 429, "rate_limited");
    }

    const org = await prisma.organization.findUnique({
      where: { widgetKey },
      select: { id: true },
    });
    if (!org) throw new AppError("Unknown widget key", 401, "unauthorized");

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId: org.id,
        customer: { is: { visitorId } },
      },
      select: { id: true, status: true },
    });
    if (!conversation) throw new AppError("Conversation not found", 404, "not_found");

    const afterMessage = after
      ? await prisma.message.findFirst({
          where: { id: after, conversationId: conversation.id },
          select: { createdAt: true },
        })
      : null;

    const messages = await prisma.message.findMany({
      where: {
        conversationId: conversation.id,
        role: { in: ["CUSTOMER", "AI", "AGENT"] },
        ...(afterMessage ? { createdAt: { gt: afterMessage.createdAt } } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: { id: true, role: true, content: true, createdAt: true, metadata: true },
    });

    return NextResponse.json(
      { status: conversation.status, messages },
      { headers: CORS_HEADERS },
    );
  } catch (err) {
    const res = errorResponse(err);
    for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
    return res;
  }
}
