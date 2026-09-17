import "dotenv/config";
import { nanoid } from "nanoid";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.user.findUniqueOrThrow({ where: { username: "rowgon_demo" } });
  const token = nanoid(48);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  await prisma.session.create({ data: { token, userId: user.id, expiresAt } });
  console.log(token);
}

main().then(() => prisma.$disconnect());
