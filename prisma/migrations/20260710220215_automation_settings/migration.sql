-- AlterTable
ALTER TABLE "AiConfig" ADD COLUMN     "followUpAfterHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "followUpsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "remindersEnabled" BOOLEAN NOT NULL DEFAULT true;
