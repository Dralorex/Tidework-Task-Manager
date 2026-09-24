#!/usr/bin/env npx tsx
/**
 * Cron-friendly weekly digest sender.
 * Example: DATABASE_URL=file:./prisma/dev.db npx tsx scripts/send-weekly-digests.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { sendEmail } from "../src/lib/mail";
import {
  buildWeeklyDigest,
  weeklyDigestEmail,
} from "../src/lib/weekly-digest";

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url }),
  });

  const users = await prisma.user.findMany({
    where: {
      weeklyDigestEnabled: true,
      email: { not: null },
    },
  });

  let sent = 0;
  for (const user of users) {
    if (!user.email) continue;
    const payload = await buildWeeklyDigest(user.id);
    if (!payload) continue;
    const mail = weeklyDigestEmail(payload);
    const result = await sendEmail({
      to: user.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
    if (!result.ok) {
      console.error("fail", user.username, result.error);
      continue;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { weeklyDigestLastSentAt: new Date() },
    });
    sent += 1;
    console.log(result.mocked ? "mocked" : "sent", user.username);
  }

  console.log(`done: ${sent}/${users.length}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
