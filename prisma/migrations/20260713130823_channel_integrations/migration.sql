-- CreateEnum
CREATE TYPE "ChannelIntegrationStatus" AS ENUM ('CONNECTED', 'ERROR', 'DISCONNECTED');

-- CreateTable
CREATE TABLE "ChannelIntegration" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "status" "ChannelIntegrationStatus" NOT NULL DEFAULT 'CONNECTED',
    "externalId" TEXT,
    "credentials" JSONB NOT NULL,
    "lastError" TEXT,
    "lastInboundAt" TIMESTAMP(3),
    "lastOutboundAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChannelIntegration_organizationId_idx" ON "ChannelIntegration"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelIntegration_organizationId_channel_key" ON "ChannelIntegration"("organizationId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelIntegration_channel_externalId_key" ON "ChannelIntegration"("channel", "externalId");

-- AddForeignKey
ALTER TABLE "ChannelIntegration" ADD CONSTRAINT "ChannelIntegration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
