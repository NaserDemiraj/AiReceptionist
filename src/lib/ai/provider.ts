/**
 * Provider-agnostic LLM layer.
 *
 * The rest of the app only ever talks to `ChatProvider` — swapping
 * Groq for OpenAI/Anthropic/Google later means adding an adapter here,
 * nothing else changes. Providers are selected per-organization from
 * `AiConfig` with an env fallback.
 */

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** For role="tool": which tool call this answers. */
  toolCallId?: string;
  /** For assistant messages that invoked tools. */
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  /** JSON-encoded arguments as produced by the model. */
  arguments: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema for the tool's parameters. */
  parameters: Record<string, unknown>;
}

export interface ChatOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
}

export interface ChatResult {
  content: string | null;
  toolCalls: ToolCall[];
  finishReason: "stop" | "tool_calls" | "length" | "other";
  usage?: { promptTokens: number; completionTokens: number };
}

export interface ChatProvider {
  readonly name: string;
  chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResult>;
}

/* ============================================================
 * Groq adapter (OpenAI-compatible API)
 * Also works verbatim against api.openai.com or any compatible
 * endpoint by changing baseUrl.
 * ============================================================ */

interface OpenAiCompatibleConfig {
  apiKey: string;
  baseUrl: string;
  name: string;
}

export class OpenAiCompatibleProvider implements ChatProvider {
  readonly name: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: OpenAiCompatibleConfig) {
    this.name = config.name;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
  }

  async chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResult> {
    const body = {
      model: options.model,
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxTokens ?? 1024,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
        ...(m.toolCalls?.length
          ? {
              tool_calls: m.toolCalls.map((t) => ({
                id: t.id,
                type: "function",
                function: { name: t.name, arguments: t.arguments },
              })),
            }
          : {}),
      })),
      ...(options.tools?.length
        ? {
            tools: options.tools.map((t) => ({
              type: "function",
              function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters,
              },
            })),
          }
        : {}),
    };

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      // Groq/llama sometimes emits a malformed tool call and the API rejects
      // its own generation with code "tool_use_failed" — but the payload
      // contains what the model *meant* to call. Recover it instead of failing.
      const recovered = tryRecoverFailedToolCall(text);
      if (recovered) {
        return {
          content: null,
          toolCalls: [recovered],
          finishReason: "tool_calls",
        };
      }
      throw new Error(`${this.name} API error ${res.status}: ${text.slice(0, 500)}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const rawToolCalls = choice?.message?.tool_calls ?? [];

    return {
      content: choice?.message?.content ?? null,
      toolCalls: rawToolCalls.map(
        (t: { id: string; function: { name: string; arguments: string } }) => ({
          id: t.id,
          name: t.function.name,
          arguments: t.function.arguments,
        }),
      ),
      finishReason:
        choice?.finish_reason === "tool_calls"
          ? "tool_calls"
          : choice?.finish_reason === "stop"
            ? "stop"
            : choice?.finish_reason === "length"
              ? "length"
              : "other",
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
          }
        : undefined,
    };
  }
}

/** Extract the intended tool call from a Groq "tool_use_failed" error body. */
function tryRecoverFailedToolCall(errorBody: string): ToolCall | null {
  try {
    const parsed = JSON.parse(errorBody);
    if (parsed?.error?.code !== "tool_use_failed") return null;
    const failed: string = parsed.error.failed_generation ?? "";
    // Typical shape: <function=searchProducts{"category": "sofas", "maxPrice": "900"}</function>
    const match = failed.match(/<function=(\w+)\s*[>]?\s*(\{[\s\S]*?\})/);
    if (!match) return null;
    JSON.parse(match[2]); // validate the args are real JSON
    return {
      id: "recovered_" + Math.random().toString(36).slice(2, 10),
      name: match[1],
      arguments: match[2],
    };
  } catch {
    return null;
  }
}

export function createGroqProvider(apiKey = process.env.GROQ_API_KEY): ChatProvider {
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");
  return new OpenAiCompatibleProvider({
    apiKey,
    baseUrl: "https://api.groq.com/openai/v1",
    name: "groq",
  });
}

/** Resolve the provider for an org's AiConfig (env-key fallback for now). */
export function getProvider(provider: "GROQ" | "OPENAI" | "ANTHROPIC" | "GOOGLE"): ChatProvider {
  switch (provider) {
    case "GROQ":
      return createGroqProvider();
    case "OPENAI":
      if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");
      return new OpenAiCompatibleProvider({
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: "https://api.openai.com/v1",
        name: "openai",
      });
    default:
      throw new Error(`Provider ${provider} not implemented yet`);
  }
}
