/** Shared shapes/constants for the conversation transcript pane. */

export const MESSAGES_PAGE_SIZE = 60;

export interface TranscriptMessage {
  id: string;
  role: "CUSTOMER" | "AI" | "AGENT" | "SYSTEM";
  content: string;
  createdAt: Date;
  agentName: string | null;
  /** Message.metadata as stored — AI messages carry { toolsUsed, latencyMs } */
  metadata?: unknown;
}

interface ToolTraceEntry {
  name: string;
  args?: string;
}

export interface AiTrace {
  tools: ToolTraceEntry[];
  latencyMs: number | null;
}

/** Pulls the debug trace out of an AI message's metadata (tolerates the
 *  old string[] toolsUsed shape from earlier messages). */
export function extractAiTrace(metadata: unknown): AiTrace | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as { toolsUsed?: unknown; latencyMs?: unknown };
  const latencyMs = typeof m.latencyMs === "number" ? m.latencyMs : null;
  const tools: ToolTraceEntry[] = Array.isArray(m.toolsUsed)
    ? m.toolsUsed.flatMap((t): ToolTraceEntry[] => {
        if (typeof t === "string") return [{ name: t }];
        if (t && typeof t === "object" && typeof (t as { name?: unknown }).name === "string") {
          const entry = t as { name: string; args?: unknown };
          return [{ name: entry.name, args: typeof entry.args === "string" ? entry.args : undefined }];
        }
        return [];
      })
    : [];
  if (tools.length === 0 && latencyMs === null) return null;
  return { tools, latencyMs };
}
