import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { errorResponse, unauthorized } from "@/lib/errors";
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
      { model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile", maxTokens: 10 },
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
