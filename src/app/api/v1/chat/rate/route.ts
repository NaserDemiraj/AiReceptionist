import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { errorResponse, AppError } from "@/lib/errors";
import { getPublicCorsHeaders } from "@/lib/cors";

const CORS_HEADERS = getPublicCorsHeaders();
// Public widget endpoint: customer feedback ratings, rate-limited per visitor

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const rateSchema = z.object({
  widgetKey: z.string().min(10),
  visitorId: z.string().min(6).max(64),
  conversationId: z.string().min(1),
  rating: z.union([z.literal(1), z.literal(-1)]),
});

/** POST /api/v1/chat/rate — customer thumbs up/down on a conversation. */
export async function POST(req: NextRequest) {
  try {
    const body = rateSchema.parse(await req.json());

    if (!rateLimit(`rate:${body.widgetKey}:${body.visitorId}`, 10, 60_000).allowed) {
      throw new AppError("Too many requests.", 429, "rate_limited");
    }

    const org = await prisma.organization.findUnique({
      where: { widgetKey: body.widgetKey },
      select: { id: true },
    });
    if (!org) throw new AppError("Unknown widget key", 401, "unauthorized");

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: body.conversationId,
        organizationId: org.id,
        customer: { is: { visitorId: body.visitorId } },
      },
      select: { id: true },
    });
    if (!conversation) throw new AppError("Conversation not found", 404, "not_found");

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { csatRating: body.rating },
    });

    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  } catch (err) {
    const res = errorResponse(err);
    for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
    return res;
  }
}
