-- Typing indicator timestamp on chat membership
ALTER TABLE "ChatMember" ADD COLUMN "typingAt" DATETIME;
