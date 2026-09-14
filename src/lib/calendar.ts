import { prisma } from "@/lib/db";

/** Keep calendar in sync for claimed tasks that have a due date. */
export async function syncCalendarForTask(taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return;

  const shouldHaveEvent =
    Boolean(task.assigneeId) &&
    Boolean(task.dueDate) &&
    (task.status === "CLAIMED" || task.status === "IN_REVIEW" || task.status === "DONE");

  if (!shouldHaveEvent || !task.assigneeId || !task.dueDate) {
    await prisma.calendarEvent.deleteMany({ where: { taskId } });
    return;
  }

  await prisma.calendarEvent.upsert({
    where: {
      userId_taskId: { userId: task.assigneeId, taskId: task.id },
    },
    create: {
      userId: task.assigneeId,
      taskId: task.id,
      title: task.name,
      dueDate: task.dueDate,
    },
    update: {
      title: task.name,
      dueDate: task.dueDate,
      userId: task.assigneeId,
    },
  });

  await prisma.calendarEvent.deleteMany({
    where: {
      taskId: task.id,
      NOT: { userId: task.assigneeId },
    },
  });
}
