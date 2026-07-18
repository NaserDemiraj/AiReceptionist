/** Shared shapes/constants for the conversation transcript pane. */

export const MESSAGES_PAGE_SIZE = 60;

export interface TranscriptMessage {
  id: string;
  role: "CUSTOMER" | "AI" | "AGENT" | "SYSTEM";
  content: string;
  createdAt: Date;
  agentName: string | null;
}
