import { NextRequest, NextResponse } from "next/server";
import { runAutomations } from "@/lib/jobs";
import { errorResponse, unauthorized } from "@/lib/errors";

/**
 * POST /api/v1/jobs/run — cron entry point (Vercel Cron, GitHub Actions, etc.)
 * Protected by the JOBS_SECRET env var: Authorization: Bearer <secret>
 */
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.JOBS_SECRET;
    const header = req.headers.get("authorization") ?? "";
    if (!secret || header !== `Bearer ${secret}`) throw unauthorized("Bad jobs secret");

    const result = await runAutomations();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return errorResponse(err);
  }
}
