-- Groq retired llama-3.3-70b-versatile; every reply from tenants still on it failed.
-- New default for new organizations, and move existing ones off retired models.
ALTER TABLE "AiConfig" ALTER COLUMN "model" SET DEFAULT 'openai/gpt-oss-120b';

UPDATE "AiConfig"
SET "model" = 'openai/gpt-oss-120b'
WHERE "model" IN (
  'llama-3.3-70b-versatile',
  'llama-3.1-70b-versatile',
  'llama3-70b-8192',
  'llama3-8b-8192',
  'mixtral-8x7b-32768',
  'gemma2-9b-it'
);
