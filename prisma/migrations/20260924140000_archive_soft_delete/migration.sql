-- Soft-delete / archive for workspaces and folders
ALTER TABLE "Workspace" ADD COLUMN "archivedAt" DATETIME;
ALTER TABLE "Workspace" ADD COLUMN "archivedById" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "archiveVisibility" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "archiveVisibilityRoles" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "archiveVisibilityUserIds" TEXT;
CREATE INDEX "Workspace_archivedAt_idx" ON "Workspace"("archivedAt");

ALTER TABLE "Folder" ADD COLUMN "archivedAt" DATETIME;
ALTER TABLE "Folder" ADD COLUMN "archivedById" TEXT;
ALTER TABLE "Folder" ADD COLUMN "archiveVisibility" TEXT;
ALTER TABLE "Folder" ADD COLUMN "archiveVisibilityRoles" TEXT;
ALTER TABLE "Folder" ADD COLUMN "archiveVisibilityUserIds" TEXT;
CREATE INDEX "Folder_archivedAt_idx" ON "Folder"("archivedAt");
