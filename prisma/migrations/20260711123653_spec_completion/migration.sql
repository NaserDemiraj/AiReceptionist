-- AlterTable
ALTER TABLE "AiConfig" ADD COLUMN     "showBranding" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "widgetColor" TEXT NOT NULL DEFAULT '#5B57D4',
ADD COLUMN     "widgetPosition" TEXT NOT NULL DEFAULT 'right';

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "csatRating" INTEGER;
