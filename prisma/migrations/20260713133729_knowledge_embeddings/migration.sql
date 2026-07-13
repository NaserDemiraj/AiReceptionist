-- Enable pgvector (available on Supabase; harmless if already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "KnowledgeChunk" ADD COLUMN     "embedding" vector(1536);

-- Approximate-nearest-neighbour index for cosine similarity search
CREATE INDEX "KnowledgeChunk_embedding_idx" ON "KnowledgeChunk"
  USING hnsw ("embedding" vector_cosine_ops);
