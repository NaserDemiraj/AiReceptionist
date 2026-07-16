"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Send, ThumbsDown, ThumbsUp } from "lucide-react";

interface ServerMessage {
  id: string;
  role: "CUSTOMER" | "AI" | "AGENT";
  content: string;
  createdAt: string;
  metadata?: { products?: ProductCard[] } | null;
}

interface ProductCard {
  id: string;
  name: string;
  price: number;
  salePrice: number | null;
  currency: string;
  stock: number;
  colors: string[];
  deliveryDays: number | null;
}

function money(n: number, currency: string) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

function getVisitorId(): string {
  const KEY = "air_visitor_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = "v_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function WidgetChat({
  widgetKey,
  orgName,
  assistantName,
  greeting,
  accentColor = "#5B57D4",
  showBranding = true,
}: {
  widgetKey: string;
  orgName: string;
  assistantName: string;
  greeting: string;
  accentColor?: string;
  showBranding?: boolean;
}) {
  const [messages, setMessages] = useState<ServerMessage[]>([]);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string>("AI_ACTIVE");
  // Lazy init: resumes the visitor's saved conversation. Renders identically
  // to the server's null until messages load, so hydration stays clean.
  const [conversationId, setConversationId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem(`air_conv_${widgetKey}`),
  );
  const [rated, setRated] = useState<1 | -1 | null>(null);
  const visitorIdRef = useRef<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    visitorIdRef.current = getVisitorId();
  }, [widgetKey]);

  const refresh = useCallback(async () => {
    if (!conversationId || !visitorIdRef.current) return;
    try {
      const res = await fetch(
        `/api/v1/chat?widgetKey=${encodeURIComponent(widgetKey)}&visitorId=${encodeURIComponent(
          visitorIdRef.current,
        )}&conversationId=${encodeURIComponent(conversationId)}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages);
      setStatus(data.status);
    } catch {
      /* offline — try again next poll */
    }
  }, [conversationId, widgetKey]);

  // Load history + poll for agent replies
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingText, sending]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setPendingText(text);
    setSending(true);
    try {
      const res = await fetch("/api/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widgetKey,
          visitorId: visitorIdRef.current,
          conversationId: conversationId ?? undefined,
          message: text,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.conversationId && data.conversationId !== conversationId) {
          setConversationId(data.conversationId);
          localStorage.setItem(`air_conv_${widgetKey}`, data.conversationId);
        }
        setStatus(data.status);
        // Pull the authoritative message list (includes our message + reply)
        const listRes = await fetch(
          `/api/v1/chat?widgetKey=${encodeURIComponent(widgetKey)}&visitorId=${encodeURIComponent(
            visitorIdRef.current,
          )}&conversationId=${encodeURIComponent(data.conversationId)}`,
        );
        if (listRes.ok) {
          const list = await listRes.json();
          setMessages(list.messages);
          setStatus(list.status);
        }
      }
    } catch {
      /* keep pendingText visible so the user can retry */
    } finally {
      setPendingText(null);
      setSending(false);
    }
  }

  async function rate(rating: 1 | -1) {
    if (!conversationId) return;
    setRated(rating);
    try {
      await fetch("/api/v1/chat/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widgetKey,
          visitorId: visitorIdRef.current,
          conversationId,
          rating,
        }),
      });
    } catch {
      /* best effort */
    }
  }

  const humanMode = status === "NEEDS_HUMAN" || status === "HUMAN_ACTIVE";

  return (
    <div className="h-screen flex flex-col bg-canvas">
      {/* Header */}
      <div
        className="h-[58px] shrink-0 flex items-center gap-3 px-4"
        style={{ background: accentColor }}
      >
        <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
          <Bot size={18} color="#fff" strokeWidth={2.2} />
        </div>
        <div className="flex-1 leading-tight">
          <div className="text-[14px] font-semibold text-white">{assistantName}</div>
          <div className="text-[11px] text-white/70 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] inline-block" />
            {orgName} · replies instantly
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-3">
        {/* Greeting (local, always first) */}
        <div className="flex gap-2">
          <div className="w-6 h-6 rounded-full bg-accent-soft text-accent flex items-center justify-center shrink-0 mt-0.5">
            <Bot size={12} />
          </div>
          <div className="bg-card border border-line rounded-2xl rounded-tl-md px-3.5 py-2.5 text-[13.5px] leading-relaxed max-w-[85%]">
            {greeting}
          </div>
        </div>

        {messages.map((m) => {
          const isCustomer = m.role === "CUSTOMER";
          const products = m.metadata?.products ?? [];
          return (
            <div key={m.id}>
              <div className={`flex gap-2 ${isCustomer ? "justify-end" : ""}`}>
                {!isCustomer && (
                  <div className="w-6 h-6 rounded-full bg-accent-soft text-accent flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={12} />
                  </div>
                )}
                <div
                  className={`px-3.5 py-2.5 rounded-2xl text-[13.5px] leading-relaxed max-w-[85%] whitespace-pre-wrap ${
                    isCustomer
                      ? "text-white rounded-tr-md"
                      : "bg-card border border-line rounded-tl-md"
                  }`}
                  style={isCustomer ? { background: accentColor } : undefined}
                >
                  {m.role === "AGENT" && (
                    <div className="text-[10.5px] font-semibold text-accent mb-1">
                      Team member
                    </div>
                  )}
                  {m.content}
                </div>
              </div>
              {products.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pl-8 pr-1 pt-2 pb-1">
                  {products.map((p) => (
                    <div
                      key={p.id}
                      className="min-w-[150px] max-w-[150px] bg-card border border-line rounded-xl p-2.5"
                    >
                      <div className="h-[64px] rounded-lg bg-hover mb-2 flex items-center justify-center text-ink-soft text-[10px]">
                        {p.colors[0] ?? "—"}
                      </div>
                      <div className="text-[12px] font-semibold leading-tight">{p.name}</div>
                      <div className="mt-1 text-[12px]">
                        {p.salePrice ? (
                          <>
                            <span className="font-semibold text-positive-strong">
                              {money(p.salePrice, p.currency)}
                            </span>{" "}
                            <span className="text-[10.5px] text-ink-soft line-through">
                              {money(p.price, p.currency)}
                            </span>
                          </>
                        ) : (
                          <span className="font-semibold">{money(p.price, p.currency)}</span>
                        )}
                      </div>
                      {p.deliveryDays != null && (
                        <div className="text-[10.5px] text-ink-soft mt-0.5">
                          Delivery {p.deliveryDays}d · {p.stock} in stock
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Optimistic outgoing message */}
        {pendingText && (
          <div className="flex justify-end">
            <div
              className="px-3.5 py-2.5 rounded-2xl rounded-tr-md text-[13.5px] text-white max-w-[85%] opacity-80"
              style={{ background: accentColor }}
            >
              {pendingText}
            </div>
          </div>
        )}
        {/* Typing indicator */}
        {sending && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-accent-soft text-accent flex items-center justify-center shrink-0">
              <Bot size={12} />
            </div>
            <div className="bg-card border border-line rounded-2xl rounded-tl-md px-4 py-3 flex gap-1 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-ink-soft animate-pulse-dot" />
              <span className="w-1.5 h-1.5 rounded-full bg-ink-soft animate-pulse-dot [animation-delay:200ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-ink-soft animate-pulse-dot [animation-delay:400ms]" />
            </div>
          </div>
        )}

        {humanMode && (
          <div className="text-center">
            <span className="inline-block text-[11px] text-warn bg-warn-soft rounded-full px-3 py-1">
              A team member has been notified and will reply here.
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-line bg-card p-3">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Type your message…"
            className="flex-1 h-[42px] px-3.5 bg-canvas border border-line rounded-xl text-[13.5px] outline-none focus:border-accent-line"
          />
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            className="w-[42px] h-[42px] disabled:opacity-40 text-white rounded-xl flex items-center justify-center cursor-pointer hover:opacity-90"
            style={{ background: accentColor }}
          >
            <Send size={16} />
          </button>
        </div>
        <div className="flex items-center justify-between mt-2 px-0.5">
          {conversationId && messages.length > 0 ? (
            <div className="flex items-center gap-1.5 text-[10.5px] text-ink-soft">
              {rated === null ? (
                <>
                  <span>Was this helpful?</span>
                  <button
                    onClick={() => rate(1)}
                    title="Yes"
                    className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-positive-soft hover:text-positive-strong cursor-pointer"
                  >
                    <ThumbsUp size={12} />
                  </button>
                  <button
                    onClick={() => rate(-1)}
                    title="No"
                    className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-danger-soft hover:text-danger cursor-pointer"
                  >
                    <ThumbsDown size={12} />
                  </button>
                </>
              ) : (
                <span>Thanks for the feedback!</span>
              )}
            </div>
          ) : (
            <span />
          )}
          {showBranding && (
            <span className="text-[10px] text-ink-soft">Powered by AI Receptionist</span>
          )}
        </div>
      </div>
    </div>
  );
}
