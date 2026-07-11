"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { globalSearch, type SearchGroup } from "../actions";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // Global ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    else {
      setQuery("");
      setGroups([]);
    }
  }, [open]);

  const runSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        setGroups(q.trim().length >= 2 ? await globalSearch(q) : []);
      });
    }, 250);
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      {/* Trigger (same look as the old static box) */}
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 h-9 px-3 bg-hover border border-line rounded-[9px] w-[250px] text-ink-soft cursor-pointer hover:border-line-strong"
      >
        <Search size={15} />
        <span className="text-[13px]">Search…</span>
        <span className="ml-auto font-mono text-[10.5px] bg-card border border-line-strong rounded-[5px] px-[5px] py-px">
          ⌘K
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] flex items-start justify-center pt-[12vh] px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-[560px] bg-card border border-line rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 px-4 border-b border-line">
              <Search size={16} className="text-ink-soft shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  runSearch(e.target.value);
                }}
                placeholder="Search customers, leads, products, quotes…"
                className="flex-1 h-[52px] bg-transparent text-[14.5px] outline-none placeholder:text-ink-soft"
              />
              {isPending && (
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse-dot shrink-0" />
              )}
            </div>

            <div className="max-h-[50vh] overflow-y-auto">
              {query.trim().length < 2 ? (
                <p className="text-[12.5px] text-ink-soft text-center py-8">
                  Type at least 2 characters…
                </p>
              ) : groups.length === 0 && !isPending ? (
                <p className="text-[12.5px] text-ink-soft text-center py-8">
                  Nothing found for &ldquo;{query}&rdquo;
                </p>
              ) : (
                groups.map((g) => (
                  <div key={g.label} className="py-1.5">
                    <div className="font-mono text-[9.5px] tracking-[0.1em] uppercase text-ink-soft px-4 py-1.5">
                      {g.label}
                    </div>
                    {g.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => go(item.href)}
                        className="w-full flex items-baseline gap-3 px-4 py-2 hover:bg-accent-soft/60 text-left cursor-pointer"
                      >
                        <span className="text-[13.5px] font-medium text-ink">{item.title}</span>
                        <span className="text-[12px] text-ink-soft truncate">{item.subtitle}</span>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
