-- Weekly digest preferences on User
ALTER TABLE "User" ADD COLUMN "weeklyDigestEnabled" BOOLEAN NOT NULL DEFAULT 1;
ALTER TABLE "User" ADD COLUMN "weeklyDigestLastSentAt" DATETIME;
