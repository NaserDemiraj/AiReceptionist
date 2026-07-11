import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, AppError } from "@/lib/errors";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/** GET /api/v1/widget/config?key= — public widget appearance settings. */
export async function GET(req: NextRequest) {
  try {
    const key = req.nextUrl.searchParams.get("key") ?? "";
    const org = await prisma.organization.findUnique({
      where: { widgetKey: key },
      include: { aiConfig: true },
    });
    if (!org) throw new AppError("Unknown widget key", 404, "not_found");

    return NextResponse.json(
      {
        color: org.aiConfig?.widgetColor ?? "#5B57D4",
        position: org.aiConfig?.widgetPosition ?? "right",
      },
      { headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=300" } },
    );
  } catch (err) {
    const res = errorResponse(err);
    for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
    return res;
  }
}
