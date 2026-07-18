-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Filter conversations by tag
CREATE INDEX "Conversation_tags_idx" ON "Conversation" USING GIN ("tags");
