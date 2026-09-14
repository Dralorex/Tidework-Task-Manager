-- Calendar events + birthday sharing

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "birthday" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "shareBirthdayFriends" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "shareBirthdayWorkspaces" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "askBeforeShareBirthday" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "showBirthdaysOnCalendar" BOOLEAN NOT NULL DEFAULT true;

DO $$ BEGIN
  CREATE TYPE "BirthdayShareStatus" AS ENUM ('PENDING', 'ACTIVE', 'DECLINED', 'HIDDEN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "PersonalCalendarEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "date" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PersonalCalendarEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkspaceCalendarEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "date" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceCalendarEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CalendarWorkspaceFilter" (
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "CalendarWorkspaceFilter_pkey" PRIMARY KEY ("userId","workspaceId")
);

CREATE TABLE IF NOT EXISTS "BirthdayShare" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "status" "BirthdayShareStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BirthdayShare_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkspaceBirthdayRequest" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "status" "BirthdayShareStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceBirthdayRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PersonalCalendarEvent_userId_date_idx" ON "PersonalCalendarEvent"("userId", "date");
CREATE INDEX IF NOT EXISTS "WorkspaceCalendarEvent_workspaceId_date_idx" ON "WorkspaceCalendarEvent"("workspaceId", "date");
CREATE UNIQUE INDEX IF NOT EXISTS "BirthdayShare_ownerId_viewerId_key" ON "BirthdayShare"("ownerId", "viewerId");
CREATE INDEX IF NOT EXISTS "BirthdayShare_viewerId_idx" ON "BirthdayShare"("viewerId");
CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceBirthdayRequest_workspaceId_subjectId_key" ON "WorkspaceBirthdayRequest"("workspaceId", "subjectId");
CREATE INDEX IF NOT EXISTS "WorkspaceBirthdayRequest_workspaceId_idx" ON "WorkspaceBirthdayRequest"("workspaceId");

DO $$ BEGIN
 ALTER TABLE "PersonalCalendarEvent" ADD CONSTRAINT "PersonalCalendarEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "WorkspaceCalendarEvent" ADD CONSTRAINT "WorkspaceCalendarEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "WorkspaceCalendarEvent" ADD CONSTRAINT "WorkspaceCalendarEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "CalendarWorkspaceFilter" ADD CONSTRAINT "CalendarWorkspaceFilter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "CalendarWorkspaceFilter" ADD CONSTRAINT "CalendarWorkspaceFilter_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "BirthdayShare" ADD CONSTRAINT "BirthdayShare_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "BirthdayShare" ADD CONSTRAINT "BirthdayShare_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "WorkspaceBirthdayRequest" ADD CONSTRAINT "WorkspaceBirthdayRequest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
 ALTER TABLE "WorkspaceBirthdayRequest" ADD CONSTRAINT "WorkspaceBirthdayRequest_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
