import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { logger } from "../logger";

/**
 * Knowledge embeddings via OpenAI text-embedding-3-small (1536 dims).
 * Env-gated: without OPENAI_API_KEY the knowledge base falls back to
 * keyword search — nothing breaks, search just gets less clever.
 */

const EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
const MODEL = "text-embedding-3-small";
const BATCH_SIZE = 100;

export function isEmbeddingsConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || texts.length === 0) return null;

  try {
    const res = await fetch(EMBEDDINGS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: texts.map((t) => t.slice(0, 8000)),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn({ status: res.status, body: body.slice(0, 200) }, "embeddings request failed");
      return null;
    }
    const data = (await res.json()) as { data?: Array<{ index: number; embedding: number[] }> };
    if (!data.data || data.data.length !== texts.length) return null;
    return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  } catch (err) {
    logger.error({ err }, "embeddings request threw");
    return null;
  }
}

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/**
 * Embeds every un-embedded chunk of a knowledge source.
 * Best-effort: sources stay searchable by keyword if this fails.
 */
export async function embedSourceChunks(sourceId: string): Promise<void> {
  if (!isEmbeddingsConfigured()) return;

  try {
    const chunks = await prisma.$queryRaw<Array<{ id: string; content: string; heading: string | null }>>`
      SELECT id, content, heading FROM "KnowledgeChunk"
      WHERE "sourceId" = ${sourceId} AND embedding IS NULL
    `;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const vectors = await embedTexts(
        batch.map((c) => (c.heading ? `${c.heading}\n${c.content}` : c.content)),
      );
      if (!vectors) return;
      for (let j = 0; j < batch.length; j++) {
        await prisma.$executeRaw`
          UPDATE "KnowledgeChunk"
          SET embedding = ${toVectorLiteral(vectors[j])}::vector
          WHERE id = ${batch[j].id}
        `;
      }
    }
    logger.info({ sourceId, chunks: chunks.length }, "knowledge source embedded");
  } catch (err) {
    logger.warn({ err, sourceId }, "embedding source chunks failed");
  }
}

export interface SemanticHit {
  content: string;
  heading: string | null;
  sourceTitle: string;
  similarity: number;
}

/**
 * Cosine-similarity search over an org's READY knowledge chunks.
 * Returns null when embeddings aren't configured or the query can't be
 * embedded — callers fall back to keyword scoring.
 */
export async function semanticSearch(
  orgId: string,
  query: string,
  limit = 4,
): Promise<SemanticHit[] | null> {
  if (!isEmbeddingsConfigured()) return null;
  const vectors = await embedTexts([query]);
  if (!vectors) return null;

  try {
    const rows = await prisma.$queryRaw<
      Array<{ content: string; heading: string | null; title: string; similarity: number }>
    >(Prisma.sql`
      SELECT c.content, c.heading, s.title,
             1 - (c.embedding <=> ${toVectorLiteral(vectors[0])}::vector) AS similarity
      FROM "KnowledgeChunk" c
      JOIN "KnowledgeSource" s ON s.id = c."sourceId"
      WHERE s."organizationId" = ${orgId}
        AND s.status = 'READY'
        AND c.embedding IS NOT NULL
      ORDER BY c.embedding <=> ${toVectorLiteral(vectors[0])}::vector
      LIMIT ${limit}
    `);
    return rows
      .filter((r) => r.similarity > 0.2) // drop obviously unrelated hits
      .map((r) => ({
        content: r.content,
        heading: r.heading,
        sourceTitle: r.title,
        similarity: r.similarity,
      }));
  } catch (err) {
    logger.warn({ err, orgId }, "semantic search failed");
    return null;
  }
}
