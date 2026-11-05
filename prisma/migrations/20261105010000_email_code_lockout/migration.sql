-- AlterTable
ALTER TABLE "EmailVerification" ADD COLUMN "resendCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmailVerification" ADD COLUMN "lockedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PendingSignup" ADD COLUMN "resendCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PendingSignup" ADD COLUMN "lockedUntil" TIMESTAMP(3);
