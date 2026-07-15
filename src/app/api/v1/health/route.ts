import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs"; // Allows database check on serverless

/**
 * GET /api/v1/health — public health check endpoint.
 * Used by load balancers, uptime monitors, and deployment automation.
 * No auth required. Returns 200 if app + database are responsive.
 */
export async function GET() {
  try {
    // Quick database connectivity check (no expensive queries)
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        status: "ok",
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || "unknown",
      },
      { status: 200 }
    );
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        status: "error",
        error,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}

// Disable caching so health checks are always fresh
export const revalidate = 0;
