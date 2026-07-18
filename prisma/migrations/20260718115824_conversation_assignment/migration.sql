-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "assignedToId" TEXT;

-- CreateIndex
CREATE INDEX "Conversation_organizationId_assignedToId_idx" ON "Conversation"("organizationId", "assignedToId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
