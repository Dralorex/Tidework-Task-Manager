-- AlterTable
DROP INDEX IF EXISTS "PasswordResetToken_token_key";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");
