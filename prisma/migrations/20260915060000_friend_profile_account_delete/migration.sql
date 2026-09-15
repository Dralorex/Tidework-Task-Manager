-- AlterTable
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedUsername" TEXT;

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateTable
CREATE TABLE "FriendProfile" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "friendId" TEXT NOT NULL,
    "personalNickname" TEXT,
    "personalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FriendProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FriendProfile_friendId_idx" ON "FriendProfile"("friendId");

-- CreateIndex
CREATE UNIQUE INDEX "FriendProfile_ownerId_friendId_key" ON "FriendProfile"("ownerId", "friendId");

-- AddForeignKey
ALTER TABLE "FriendProfile" ADD CONSTRAINT "FriendProfile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendProfile" ADD CONSTRAINT "FriendProfile_friendId_fkey" FOREIGN KEY ("friendId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
