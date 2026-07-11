"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { notFound } from "@/lib/errors";
import { htmlToText, splitIntoChunks } from "./chunking";

export type KnowledgeFormState = { error?: string; success?: string } | undefined;

const MAX_CONTENT_CHARS = 200_000;
const MAX_PDF_BYTES = 10 * 1024 * 1024;

/* ---------- FAQ ---------- */

const faqSchema = z.object({
  question: z.string().min(5, "Question is too short").max(300),
  answer: z.string().min(5, "Answer is too short").max(4000),
});

export async function addFaq(
  _prev: KnowledgeFormState,
  formData: FormData,
): Promise<KnowledgeFormState> {
  const { org } = await requireOrg();
  const parsed = faqSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.knowledgeSource.create({
    data: {
      organizationId: org.id,
      type: "FAQ",
      status: "READY",
      title: parsed.data.question,
      lastIndexedAt: new Date(),
      chunks: {
        create: {
          heading: parsed.data.question,
          content: `Q: ${parsed.data.question}\nA: ${parsed.data.answer}`,
          position: 0,
        },
      },
    },
  });

  revalidatePath("/knowledge");
  return { success: "FAQ added — the AI can use it immediately." };
}

/* ---------- Pasted text / policies ---------- */

const textSchema = z.object({
  title: z.string().min(3, "Give this document a title").max(200),
  content: z.string().min(20, "Content is too short").max(MAX_CONTENT_CHARS),
});

export async function addText(
  _prev: KnowledgeFormState,
  formData: FormData,
): Promise<KnowledgeFormState> {
  const { org } = await requireOrg();
  const parsed = textSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const chunks = splitIntoChunks(parsed.data.content);
  await prisma.knowledgeSource.create({
    data: {
      organizationId: org.id,
      type: "MANUAL",
      status: "READY",
      title: parsed.data.title,
      lastIndexedAt: new Date(),
      chunks: {
        create: chunks.map((content, i) => ({
          content,
          position: i,
          heading: i === 0 ? parsed.data.title : null,
        })),
      },
    },
  });

  revalidatePath("/knowledge");
  return { success: `Document indexed into ${chunks.length} section${chunks.length === 1 ? "" : "s"}.` };
}

/* ---------- URL ---------- */

const urlSchema = z.object({
  url: z.string().url("Enter a full URL, e.g. https://example.com/faq"),
});

export async function addUrl(
  _prev: KnowledgeFormState,
  formData: FormData,
): Promise<KnowledgeFormState> {
  const { org } = await requireOrg();
  const parsed = urlSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const url = parsed.data.url;

  const source = await prisma.knowledgeSource.create({
    data: {
      organizationId: org.id,
      type: "URL",
      status: "INDEXING",
      title: url.replace(/^https?:\/\//, "").slice(0, 120),
      sourceUrl: url,
    },
  });

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "AIReceptionistBot/1.0 (+knowledge-indexer)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const text = htmlToText(html).slice(0, MAX_CONTENT_CHARS);
    if (text.length < 50) throw new Error("Page contained no readable text");

    const titleMatch = html.match(/<title[^>]*>([^<]{3,150})<\/title>/i);
    const chunks = splitIntoChunks(text);

    await prisma.$transaction([
      prisma.knowledgeChunk.createMany({
        data: chunks.map((content, i) => ({ sourceId: source.id, content, position: i })),
      }),
      prisma.knowledgeSource.update({
        where: { id: source.id },
        data: {
          status: "READY",
          lastIndexedAt: new Date(),
          ...(titleMatch ? { title: titleMatch[1].trim() } : {}),
        },
      }),
    ]);

    revalidatePath("/knowledge");
    return { success: `Page indexed into ${chunks.length} section${chunks.length === 1 ? "" : "s"}.` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch";
    await prisma.knowledgeSource.update({
      where: { id: source.id },
      data: { status: "ERROR", error: message },
    });
    logger.warn({ err, url }, "URL ingestion failed");
    revalidatePath("/knowledge");
    return { error: `Could not index that page: ${message}` };
  }
}

/* ---------- PDF ---------- */

export async function addPdf(
  _prev: KnowledgeFormState,
  formData: FormData,
): Promise<KnowledgeFormState> {
  const { org } = await requireOrg();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a PDF file first." };
  }
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return { error: "Only PDF files are supported here — use 'Paste text' for other content." };
  }
  if (file.size > MAX_PDF_BYTES) {
    return { error: "PDF is too large (max 10 MB)." };
  }

  const source = await prisma.knowledgeSource.create({
    data: {
      organizationId: org.id,
      type: "DOCUMENT",
      status: "INDEXING",
      title: file.name,
      fileName: file.name,
    },
  });

  try {
    const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await pdfParse(buffer);
    const text = (parsed.text ?? "").slice(0, MAX_CONTENT_CHARS);
    if (text.trim().length < 50) {
      throw new Error("No readable text found (is it a scanned image PDF?)");
    }

    const chunks = splitIntoChunks(text);
    await prisma.$transaction([
      prisma.knowledgeChunk.createMany({
        data: chunks.map((content, i) => ({ sourceId: source.id, content, position: i })),
      }),
      prisma.knowledgeSource.update({
        where: { id: source.id },
        data: { status: "READY", lastIndexedAt: new Date() },
      }),
    ]);

    revalidatePath("/knowledge");
    return { success: `PDF indexed into ${chunks.length} section${chunks.length === 1 ? "" : "s"}.` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse PDF";
    await prisma.knowledgeSource.update({
      where: { id: source.id },
      data: { status: "ERROR", error: message },
    });
    logger.warn({ err, file: file.name }, "PDF ingestion failed");
    revalidatePath("/knowledge");
    return { error: `Could not index the PDF: ${message}` };
  }
}

/* ---------- Delete ---------- */

export async function deleteSource(formData: FormData): Promise<void> {
  const { org } = await requireOrg();
  const id = z.string().min(1).parse(formData.get("sourceId"));

  const source = await prisma.knowledgeSource.findFirst({
    where: { id, organizationId: org.id },
    select: { id: true },
  });
  if (!source) throw notFound("Source not found");

  await prisma.knowledgeSource.delete({ where: { id: source.id } });
  revalidatePath("/knowledge");
}
