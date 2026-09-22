-- Optional nickname captured at signup (applied when PendingSignup becomes a User)
ALTER TABLE "PendingSignup" ADD COLUMN IF NOT EXISTS "nickname" TEXT;
