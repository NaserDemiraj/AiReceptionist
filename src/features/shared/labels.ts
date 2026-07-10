import type {
  AppointmentStatus,
  Channel,
  ConversationStatus,
  LeadStatus,
  Sentiment,
} from "@prisma/client";

type Tone = "accent" | "positive" | "warn" | "danger" | "neutral";

export const CHANNEL_LABELS: Record<Channel, string> = {
  WEB: "Web",
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  TELEGRAM: "Telegram",
  SMS: "SMS",
  PHONE: "Phone",
};

export const CONVERSATION_STATUS_META: Record<ConversationStatus, { label: string; tone: Tone }> = {
  AI_ACTIVE: { label: "AI handling", tone: "accent" },
  NEEDS_HUMAN: { label: "Needs human", tone: "warn" },
  HUMAN_ACTIVE: { label: "With agent", tone: "positive" },
  RESOLVED: { label: "Resolved", tone: "neutral" },
};

export const LEAD_STATUS_META: Record<LeadStatus, { label: string; tone: Tone }> = {
  NEW: { label: "New", tone: "accent" },
  CONTACTED: { label: "Contacted", tone: "neutral" },
  QUALIFIED: { label: "Qualified", tone: "warn" },
  VISIT_BOOKED: { label: "Visit booked", tone: "positive" },
  WON: { label: "Won", tone: "positive" },
  LOST: { label: "Lost", tone: "danger" },
};

export const APPOINTMENT_STATUS_META: Record<AppointmentStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "warn" },
  CONFIRMED: { label: "Confirmed", tone: "positive" },
  COMPLETED: { label: "Completed", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
  NO_SHOW: { label: "No-show", tone: "danger" },
};

export const SENTIMENT_META: Record<Sentiment, { label: string; tone: Tone }> = {
  POSITIVE: { label: "Positive", tone: "positive" },
  NEUTRAL: { label: "Neutral", tone: "neutral" },
  NEGATIVE: { label: "Negative", tone: "danger" },
};

export function formatMoney(value: unknown, currency = "EUR"): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}
