import { NextRequest, NextResponse } from "next/server";
import { runAutomations } from "@/lib/jobs";
import { errorResponse, unauthorized } from "@/lib/errors";

/**
 * /api/v1/jobs/run — cron entry point.
 * POST: any scheduler with `Authorization: Bearer $JOBS_SECRET`.
 * GET: Vercel Cron (sends `Authorization: Bearer $CRON_SECRET` automatically).
 */
async function handle(req: NextRequest) {
  try {
    const header = req.headers.get("authorization") ?? "";
    const accepted = [process.env.JOBS_SECRET, process.env.CRON_SECRET]
      .filter(Boolean)
      .map((s) => `Bearer ${s}`);
    if (accepted.length === 0 || !accepted.includes(header)) {
      throw unauthorized("Bad jobs secret");
    }

    const result = await runAutomations();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}
