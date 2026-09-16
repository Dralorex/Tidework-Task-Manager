import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("password123", 12);
  const user = await prisma.user.upsert({
    where: { username: "rowgon_demo" },
    update: { passwordHash },
    create: {
      username: "rowgon_demo",
      passwordHash,
      email: "demo@rowgon.com",
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

  let task = await prisma.task.findFirst({
    where: { workspaceId: workspace.id, name: "Ship landing page" },
  });
  if (!task) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 2);
    task = await prisma.task.create({
      data: {
        workspaceId: workspace.id,
        folderId: folder.id,
        name: "Ship landing page",
        description: "First draft of marketing page",
        priority: "HIGH",
        dueDate,
        createdById: user.id,
      },
    });
  }

  console.log({
    userId: user.id,
    workspaceId: workspace.id,
    folderId: folder.id,
    taskId: task.id,
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
