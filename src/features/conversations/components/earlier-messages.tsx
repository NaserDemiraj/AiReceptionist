"use client";

import { useState, useTransition } from "react";
import { loadEarlierMessages } from "../actions";
import type { TranscriptMessage } from "../transcript";
import { MessageBubble } from "./message-bubble";

/**
 * Sits above the latest page of the transcript and pulls older pages on
 * demand. Client state survives the page's periodic router.refresh(), so
 * loaded history isn't lost when new messages arrive.
 */
export function EarlierMessages({
  conversationId,
  oldestShownId,
  showTrace = false,
}: {
  conversationId: string;
  oldestShownId: string;
  showTrace?: boolean;
}) {
  const [older, setOlder] = useState<TranscriptMessage[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [pending, startTransition] = useTransition();

  const loadMore = () =>
    startTransition(async () => {
      const cursor = older[0]?.id ?? oldestShownId;
      const result = await loadEarlierMessages(conversationId, cursor);
      setOlder((prev) => [...result.messages, ...prev]);
      setHasMore(result.hasMore);
    });

  return (
    <>
      {hasMore && (
        <div className="text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={pending}
            className="text-[12px] font-medium text-accent bg-accent-soft hover:bg-accent-soft/70 rounded-full px-4 py-1.5 disabled:opacity-60 cursor-pointer"
          >
            {pending ? "Loading…" : "Load earlier messages"}
          </button>
        </div>
      )}
      {older.map((m) => (
        <MessageBubble key={m.id} message={m} showTrace={showTrace} />
      ))}
    </>
  );
}
