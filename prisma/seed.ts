import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";
import { getDatabaseUrl } from "../src/lib/db-url";

async function main() {
  const connectionString = getDatabaseUrl();
  const prisma = new PrismaClient({
    adapter: new PrismaNeon({ connectionString }),
  });

  const passwordHash = await bcrypt.hash("password123", 12);
  const user = await prisma.user.upsert({
    where: { username: "tide_demo" },
    update: { passwordHash },
    create: {
      username: "tide_demo",
      passwordHash,
      email: "demo@tidework.test",
    },
  });

  let workspace = await prisma.workspace.findFirst({
    where: { name: "Studio Sprint", ownerId: user.id },
  });
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: "Studio Sprint",
        ownerId: user.id,
        memberships: { create: { userId: user.id, role: "OWNER" } },
      },
    });
  }

  let folder = await prisma.folder.findFirst({
    where: { workspaceId: workspace.id, name: "Launch" },
  });
  if (!folder) {
    folder = await prisma.folder.create({
      data: { workspaceId: workspace.id, name: "Launch" },
    });
  }

  const existingTask = await prisma.task.findFirst({
    where: { workspaceId: workspace.id, folderId: folder.id, name: "Ship landing page" },
  });
  if (!existingTask) {
    await prisma.task.create({
      data: {
        workspaceId: workspace.id,
        folderId: folder.id,
        name: "Ship landing page",
        description: "Polish hero, signup, and workspace shell.",
        priority: "HIGH",
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
        createdById: user.id,
      },
    });
  }

  console.log("Seeded demo user tide_demo / password123");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
