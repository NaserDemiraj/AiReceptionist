import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { errorResponse, unauthorized } from "@/lib/errors";
import { resolveModel } from "@/lib/ai/models";
import { createGroqProvider } from "@/lib/ai/provider";

/**
 * Health check for the configured LLM provider.
 * GET /api/v1/ai/ping — requires a logged-in session.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw unauthorized();

    const provider = createGroqProvider();
    const started = Date.now();
    const result = await provider.chat(
      [{ role: "user", content: "Reply with exactly: pong" }],
      // Room for gpt-oss's reasoning tokens before the one-word answer.
      { model: resolveModel(null), maxTokens: 256 },
    );

    return NextResponse.json({
      ok: true,
      provider: provider.name,
      latencyMs: Date.now() - started,
      reply: result.content,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
