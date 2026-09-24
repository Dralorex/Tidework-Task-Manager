/**
 * Seeds a personal calendar event for Playwright and prints JSON to stdout.
 * Usage: DATABASE_URL=file:./prisma/dev.db npx tsx e2e/fixtures/seed-calendar.ts
 */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import { addDays, format, startOfMonth } from "date-fns";
import { nanoid } from "nanoid";
import path from "node:path";
import { PrismaClient } from "../../src/generated/prisma/client";

const SESSION_COOKIE = "tidework_session";

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const resolved = url.startsWith("file:")
    ? `file:${path.resolve(process.cwd(), url.slice("file:".length))}`
    : url;
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: resolved }),
  });

  const passwordHash = await bcrypt.hash("password123", 10);
  const username = `e2e_${nanoid(6)}`;
  const user = await prisma.user.create({
    data: {
      username,
      passwordHash,
      email: `${username}@tidework.test`,
    },
  });

  const monthStart = startOfMonth(new Date());
  const fromDay = format(addDays(monthStart, 3), "yyyy-MM-dd");
  const toDay = format(addDays(monthStart, 8), "yyyy-MM-dd");
  const fromDate = new Date(`${fromDay}T12:00:00`);

  const event = await prisma.personalCalendarEvent.create({
    data: {
      userId: user.id,
      title: "E2E drag me",
      description: "playwright",
      date: fromDate,
    },
  });

  const token = nanoid(48);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  await prisma.session.create({
    data: { token, userId: user.id, expiresAt },
  });

  await prisma.$disconnect();

  process.stdout.write(
    JSON.stringify({
      username,
      cookieName: SESSION_COOKIE,
      cookieValue: token,
      eventId: `personal:${event.id}`,
      recordId: event.id,
      fromDay,
      toDay,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
