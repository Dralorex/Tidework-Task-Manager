-- AlterTable
ALTER TABLE "User" ADD COLUMN "platformRole" TEXT NOT NULL DEFAULT 'member';
ALTER TABLE "User" ADD COLUMN "avatarKey" TEXT;
ALTER TABLE "User" ADD COLUMN "avatarShape" TEXT NOT NULL DEFAULT 'circle';
ALTER TABLE "User" ADD COLUMN "avatarStatus" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "User" ADD COLUMN "avatarReviewedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "avatarReviewNote" TEXT;

-- CreateIndex
CREATE INDEX "User_platformRole_idx" ON "User"("platformRole");
CREATE INDEX "User_avatarStatus_idx" ON "User"("avatarStatus");

-- CreateTable
CREATE TABLE "AvatarModerationEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT,
    "verdict" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvatarModerationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AvatarModerationEvent_userId_createdAt_idx" ON "AvatarModerationEvent"("userId", "createdAt");
CREATE INDEX "AvatarModerationEvent_verdict_createdAt_idx" ON "AvatarModerationEvent"("verdict", "createdAt");

-- AddForeignKey
ALTER TABLE "AvatarModerationEvent" ADD CONSTRAINT "AvatarModerationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
