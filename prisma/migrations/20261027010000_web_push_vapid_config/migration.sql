-- CreateTable
CREATE TABLE "WebPushVapidConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "publicKey" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT 'mailto:noreply@rowgon.com',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "WebPushVapidConfig_pkey" PRIMARY KEY ("id")
);
