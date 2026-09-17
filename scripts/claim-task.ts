import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.user.findUniqueOrThrow({ where: { username: "rowgon_demo" } });
  const task = await prisma.task.findFirstOrThrow({
    where: { name: "Ship landing page" },
  });
  await prisma.task.update({
    where: { id: task.id },
    data: {
      assigneeId: user.id,
      status: "CLAIMED",
      claimedAt: new Date(),
    },
  });
  if (task.dueDate) {
    await prisma.calendarEvent.upsert({
      where: { userId_taskId: { userId: user.id, taskId: task.id } },
      create: {
        userId: user.id,
        taskId: task.id,
        title: task.name,
        dueDate: task.dueDate,
      },
      update: {
        title: task.name,
        dueDate: task.dueDate,
      },
    });
  }
  console.log({ workspaceId: task.workspaceId, taskId: task.id, folderId: task.folderId });
}
main().then(() => prisma.$disconnect());
