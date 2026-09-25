import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { getDatabaseUrl } from "../src/lib/db-url";

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: getDatabaseUrl() }),
  });
  const passwordHash = await bcrypt.hash("password123", 10);
  const user = await prisma.user.upsert({
    where: { username: "demo" },
    create: { username: "demo", passwordHash, email: "demo@tidework.test" },
    update: { passwordHash },
  });
  console.log("seeded", user.username);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
