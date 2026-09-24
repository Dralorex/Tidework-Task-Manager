-- Custom workspace roles + folder ACL (ported from main; SQLite)

CREATE TABLE "WorkspaceRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hideFolders" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkspaceRole_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "WorkspaceRole_workspaceId_name_key" ON "WorkspaceRole"("workspaceId", "name");
CREATE INDEX "WorkspaceRole_workspaceId_idx" ON "WorkspaceRole"("workspaceId");

CREATE TABLE "MembershipRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "membershipId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    CONSTRAINT "MembershipRole_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MembershipRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "WorkspaceRole" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MembershipRole_membershipId_roleId_key" ON "MembershipRole"("membershipId", "roleId");
CREATE INDEX "MembershipRole_roleId_idx" ON "MembershipRole"("roleId");

CREATE TABLE "FolderRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "folderId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    CONSTRAINT "FolderRole_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FolderRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "WorkspaceRole" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "FolderRole_folderId_roleId_key" ON "FolderRole"("folderId", "roleId");
CREATE INDEX "FolderRole_roleId_idx" ON "FolderRole"("roleId");

CREATE TABLE "WorkspaceRoleSeen" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceRoleSeen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkspaceRoleSeen_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "WorkspaceRole" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "WorkspaceRoleSeen_userId_roleId_key" ON "WorkspaceRoleSeen"("userId", "roleId");
CREATE INDEX "WorkspaceRoleSeen_roleId_idx" ON "WorkspaceRoleSeen"("roleId");

ALTER TABLE "Folder" ADD COLUMN "hideFromUnauthorized" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Folder" ADD COLUMN "alwaysVisible" BOOLEAN NOT NULL DEFAULT false;
