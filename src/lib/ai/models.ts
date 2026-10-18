/**
 * Which LLM model a request actually uses.
 *
 * Each organization stores a model in `AiConfig.model`. Providers retire models
 * (Groq dropped llama-3.3-70b-versatile in 2026, which broke every reply), so a
 * stored name can go stale. Resolution order:
 *   1. `GROQ_MODEL` env override — fixes every tenant at once without a migration
 *   2. the organization's stored model, unless it's known to be retired
 *   3. DEFAULT_GROQ_MODEL
 */

export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

/** Models Groq no longer serves. Stored configs pointing at these are upgraded at call time. */
export const RETIRED_GROQ_MODELS: ReadonlySet<string> = new Set([
  "llama-3.3-70b-versatile",
  "llama-3.1-70b-versatile",
  "llama3-70b-8192",
  "llama3-8b-8192",
  "mixtral-8x7b-32768",
  "gemma2-9b-it",
]);

export function resolveModel(
  stored: string | null | undefined,
  provider: string = "GROQ",
  env: Record<string, string | undefined> = process.env,
): string {
  if (provider !== "GROQ") return stored?.trim() || DEFAULT_GROQ_MODEL;
  const override = env.GROQ_MODEL?.trim();
  if (override) return override;
  const model = stored?.trim();
  if (!model || RETIRED_GROQ_MODELS.has(model)) return DEFAULT_GROQ_MODEL;
  return model;
}

/**
 * gpt-oss models reason before answering. Keep that short: a receptionist reply
 * doesn't need deep reasoning, and reasoning tokens count against max_tokens.
 */
export function reasoningParams(model: string): { reasoning_effort?: "low" } {
  return model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {};
}
