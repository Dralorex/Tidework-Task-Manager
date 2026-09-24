-- CreateTable
CREATE TABLE "MessageMention" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "userId" TEXT,
    "roleName" TEXT,
    CONSTRAINT "MessageMention_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MessageMention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
CREATE TABLE "new_ChatMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notifyMode" TEXT NOT NULL DEFAULT 'ALL',
    "lastSeenAt" DATETIME,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ChatGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ChatMember" ("id", "groupId", "userId", "joinedAt") SELECT "id", "groupId", "userId", "joinedAt" FROM "ChatMember";
DROP TABLE "ChatMember";
ALTER TABLE "new_ChatMember" RENAME TO "ChatMember";
CREATE UNIQUE INDEX "ChatMember_groupId_userId_key" ON "ChatMember"("groupId", "userId");
CREATE INDEX "ChatMember_userId_idx" ON "ChatMember"("userId");

-- CreateIndex
CREATE INDEX "MessageMention_messageId_idx" ON "MessageMention"("messageId");
CREATE INDEX "MessageMention_userId_idx" ON "MessageMention"("userId");
