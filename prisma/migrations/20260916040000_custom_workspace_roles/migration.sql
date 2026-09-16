-- Custom workspace roles, folder requirements, and per-user role activity cursors

CREATE TABLE "WorkspaceRole" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MembershipRole" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "MembershipRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FolderRole" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "FolderRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceRoleSeen" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceRoleSeen_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceRole_workspaceId_name_key" ON "WorkspaceRole"("workspaceId", "name");
CREATE INDEX "WorkspaceRole_workspaceId_idx" ON "WorkspaceRole"("workspaceId");

CREATE UNIQUE INDEX "MembershipRole_membershipId_roleId_key" ON "MembershipRole"("membershipId", "roleId");
CREATE INDEX "MembershipRole_roleId_idx" ON "MembershipRole"("roleId");

CREATE UNIQUE INDEX "FolderRole_folderId_roleId_key" ON "FolderRole"("folderId", "roleId");
CREATE INDEX "FolderRole_roleId_idx" ON "FolderRole"("roleId");

CREATE UNIQUE INDEX "WorkspaceRoleSeen_userId_roleId_key" ON "WorkspaceRoleSeen"("userId", "roleId");
CREATE INDEX "WorkspaceRoleSeen_roleId_idx" ON "WorkspaceRoleSeen"("roleId");

ALTER TABLE "WorkspaceRole" ADD CONSTRAINT "WorkspaceRole_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipRole" ADD CONSTRAINT "MembershipRole_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipRole" ADD CONSTRAINT "MembershipRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "WorkspaceRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FolderRole" ADD CONSTRAINT "FolderRole_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FolderRole" ADD CONSTRAINT "FolderRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "WorkspaceRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceRoleSeen" ADD CONSTRAINT "WorkspaceRoleSeen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceRoleSeen" ADD CONSTRAINT "WorkspaceRoleSeen_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "WorkspaceRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
