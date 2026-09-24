/**
 * Reads a personal event date for Playwright assertions.
 * Usage: DATABASE_URL=file:./prisma/dev.db npx tsx e2e/fixtures/read-event-date.ts <recordId>
 */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { format } from "date-fns";
import path from "node:path";
import { PrismaClient } from "../../src/generated/prisma/client";

async function main() {
  const recordId = process.argv[2];
  if (!recordId) throw new Error("recordId required");

  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const resolved = url.startsWith("file:")
    ? `file:${path.resolve(process.cwd(), url.slice("file:".length))}`
    : url;
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: resolved }),
  });

  const row = await prisma.personalCalendarEvent.findUnique({
    where: { id: recordId },
  });
  await prisma.$disconnect();

  process.stdout.write(
    JSON.stringify({
      day: row ? format(row.date, "yyyy-MM-dd") : null,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
