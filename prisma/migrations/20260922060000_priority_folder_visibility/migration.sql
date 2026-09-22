-- Expand task priority scale
ALTER TYPE "TaskPriority" ADD VALUE IF NOT EXISTS 'URGENT';
ALTER TYPE "TaskPriority" ADD VALUE IF NOT EXISTS 'ELEVATED';
ALTER TYPE "TaskPriority" ADD VALUE IF NOT EXISTS 'NORMAL';
ALTER TYPE "TaskPriority" ADD VALUE IF NOT EXISTS 'MINIMAL';

-- Workspace urgency chip display prefs
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "showUrgencyBase" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "showUrgencyDate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "showUrgencyTotal" BOOLEAN NOT NULL DEFAULT true;

-- Role: hide folders requiring this role from unauthorized members
ALTER TABLE "WorkspaceRole" ADD COLUMN IF NOT EXISTS "hideFolders" BOOLEAN NOT NULL DEFAULT false;

-- Folder visibility overrides
ALTER TABLE "Folder" ADD COLUMN IF NOT EXISTS "hideFromUnauthorized" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Folder" ADD COLUMN IF NOT EXISTS "alwaysVisible" BOOLEAN NOT NULL DEFAULT false;
