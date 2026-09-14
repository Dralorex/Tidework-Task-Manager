-- AlterTable
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "lastUnclaimReason" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "lastUnclaimWorkNote" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "lastUnclaimedById" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "RememberedPrivateTag" (
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "RememberedPrivateTag_pkey" PRIMARY KEY ("userId","taskId","tagId")
);

CREATE INDEX IF NOT EXISTS "RememberedPrivateTag_taskId_idx" ON "RememberedPrivateTag"("taskId");

DO $$ BEGIN
  ALTER TABLE "Task" ADD CONSTRAINT "Task_lastUnclaimedById_fkey"
    FOREIGN KEY ("lastUnclaimedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RememberedPrivateTag" ADD CONSTRAINT "RememberedPrivateTag_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RememberedPrivateTag" ADD CONSTRAINT "RememberedPrivateTag_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RememberedPrivateTag" ADD CONSTRAINT "RememberedPrivateTag_tagId_fkey"
    FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
