-- AlterTable
ALTER TABLE "Task" ADD COLUMN "completedAt" TIMESTAMP(3);

-- Best-effort backfill from the latest "approved" activity.
UPDATE "Task" AS t
SET "completedAt" = a."createdAt"
FROM (
  SELECT DISTINCT ON ("taskId") "taskId", "createdAt"
  FROM "TaskActivity"
  WHERE "type" = 'approved'
  ORDER BY "taskId", "createdAt" DESC
) AS a
WHERE t."id" = a."taskId"
  AND t."status" = 'DONE'
  AND t."completedAt" IS NULL;

-- Fallback for DONE tasks with no approved activity.
UPDATE "Task"
SET "completedAt" = "updatedAt"
WHERE "status" = 'DONE'
  AND "completedAt" IS NULL;
