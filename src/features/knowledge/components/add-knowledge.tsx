"use client";

import { useActionState, useState } from "react";
import { FileText, Globe, HelpCircle, Type } from "lucide-react";
import { addFaq, addPdf, addText, addUrl, type KnowledgeFormState } from "../actions";
import { Button, Field, Input, cx } from "@/components/ui";

const TABS = [
  { key: "faq", label: "FAQ", icon: HelpCircle },
  { key: "text", label: "Paste text", icon: Type },
  { key: "url", label: "Web page", icon: Globe },
  { key: "pdf", label: "PDF", icon: FileText },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function Feedback({ state }: { state: KnowledgeFormState }) {
  if (!state) return null;
  if (state.error) {
    return (
      <p className="text-[12.5px] text-danger bg-danger-soft border border-danger/15 rounded-lg px-3 py-2">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p className="text-[12.5px] text-positive-strong bg-positive-soft border border-positive-line rounded-lg px-3 py-2">
        {state.success}
      </p>
    );
  }
  return null;
}

function Textarea(props: React.ComponentPropsWithoutRef<"textarea">) {
  return (
    <textarea
      {...props}
      className={cx(
        "w-full px-3.5 py-2.5 bg-card border border-line rounded-[10px] text-[13.5px] text-ink placeholder:text-ink-soft outline-none focus:border-accent-line focus:ring-2 focus:ring-accent-soft transition resize-y",
        props.className,
      )}
    />
  );
}

export function AddKnowledge() {
  const [tab, setTab] = useState<TabKey>("faq");
  const [faqState, faqAction, faqPending] = useActionState(addFaq, undefined);
  const [textState, textAction, textPending] = useActionState(addText, undefined);
  const [urlState, urlAction, urlPending] = useActionState(addUrl, undefined);
  const [pdfState, pdfAction, pdfPending] = useActionState(addPdf, undefined);

  return (
    <div>
      <div className="flex gap-1.5 mb-4">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cx(
                "px-3 py-1.5 rounded-lg text-[12.5px] font-medium inline-flex items-center gap-1.5 cursor-pointer",
                tab === t.key
                  ? "bg-accent-soft text-accent font-semibold"
                  : "text-ink-mid hover:bg-hover bg-card border border-line",
              )}
            >
              <Icon size={13} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "faq" && (
        <form action={faqAction} className="space-y-3.5">
          <Field label="Question customers ask">
            <Input name="question" placeholder="Do you deliver outside Tirana?" required />
          </Field>
          <Field label="The answer">
            <Textarea
              name="answer"
              rows={4}
              placeholder="Yes — we deliver anywhere in Albania within 3-7 days. Delivery is free for orders over €500…"
              required
            />
          </Field>
          <Feedback state={faqState} />
          <Button type="submit" disabled={faqPending}>
            {faqPending ? "Adding…" : "Add FAQ"}
          </Button>
        </form>
      )}

      {tab === "text" && (
        <form action={textAction} className="space-y-3.5">
          <Field label="Title">
            <Input name="title" placeholder="Delivery & assembly policy" required />
          </Field>
          <Field label="Content">
            <Textarea
              name="content"
              rows={8}
              placeholder="Paste your policies, price lists, opening hours, anything the AI should know…"
              required
            />
          </Field>
          <Feedback state={textState} />
          <Button type="submit" disabled={textPending}>
            {textPending ? "Indexing…" : "Add document"}
          </Button>
        </form>
      )}

      {tab === "url" && (
        <form action={urlAction} className="space-y-3.5">
          <Field label="Page URL">
            <Input name="url" type="url" placeholder="https://your-site.com/faq" required />
          </Field>
          <p className="text-[12px] text-ink-soft">
            We fetch the page, strip the layout, and index the readable text.
          </p>
          <Feedback state={urlState} />
          <Button type="submit" disabled={urlPending}>
            {urlPending ? "Fetching & indexing…" : "Index page"}
          </Button>
        </form>
      )}

      {tab === "pdf" && (
        <form action={pdfAction} className="space-y-3.5">
          <Field label="PDF file (max 10 MB)">
            <input
              type="file"
              name="file"
              accept="application/pdf"
              required
              className="block w-full text-[13px] text-ink-mid file:mr-3 file:h-9 file:px-4 file:rounded-[9px] file:border file:border-line file:bg-card file:text-[12.5px] file:font-semibold file:text-ink file:cursor-pointer hover:file:bg-hover"
            />
          </Field>
          <p className="text-[12px] text-ink-soft">
            Works with text PDFs (catalogs, price lists, policies). Scanned-image PDFs need OCR —
            coming later.
          </p>
          <Feedback state={pdfState} />
          <Button type="submit" disabled={pdfPending}>
            {pdfPending ? "Parsing & indexing…" : "Upload & index"}
          </Button>
        </form>
      )}
    </div>
  );
}
