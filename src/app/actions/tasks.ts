"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { syncCalendarForTask } from "@/lib/calendar";
import { prisma } from "@/lib/db";
import {
  canCreatePublicTags,
  canEditContent,
  requireMembership,
} from "@/lib/permissions";
import { recordTaskActivity } from "@/lib/task-activity";
import type { TaskPriority } from "@/generated/prisma/client";
import type { ActionResult } from "@/app/actions/auth";

function revalidateWorkspace(workspaceId: string) {
  revalidatePath(`/app/w/${workspaceId}`);
}

export async function createFolderAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const parentRaw = String(formData.get("parentId") ?? "").trim();
  const parentId = parentRaw || null;

  const membership = await requireMembership(workspaceId, user.id);
  if (!canEditContent(membership.role)) {
    return { ok: false, error: "Members can’t create folders." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Folder needs a name." };

  await prisma.folder.create({
    data: { workspaceId, parentId, name },
  });

  revalidateWorkspace(workspaceId);
  return { ok: true };
}

export async function createTaskAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const folderId = String(formData.get("folderId") ?? "");

  const membership = await requireMembership(workspaceId, user.id);
  if (!canEditContent(membership.role)) {
    return { ok: false, error: "Members can’t create tasks." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priority = String(formData.get("priority") ?? "MEDIUM") as TaskPriority;
  const dueRaw = String(formData.get("dueDate") ?? "").trim();
  const assignTo = String(formData.get("assignTo") ?? "").trim();

  if (!name) return { ok: false, error: "Task needs a name." };
  if (!["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(priority)) {
    return { ok: false, error: "Pick a valid priority." };
  }

  const folder = await prisma.folder.findFirst({
    where: { id: folderId, workspaceId },
  });
  if (!folder) return { ok: false, error: "Folder not found." };

  let assignedUserId: string | null = null;
  let assignedUsername: string | null = null;
  if (assignTo) {
    const targetMembership = await prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: assignTo } },
      include: { user: true },
    });
    if (!targetMembership) {
      return { ok: false, error: "Assignee must be a workspace member." };
    }
    assignedUserId = targetMembership.userId;
    assignedUsername = targetMembership.user.username;
  }

  const task = await prisma.task.create({
    data: {
      workspaceId,
      folderId,
      name,
      description,
      priority,
      dueDate: dueRaw ? new Date(dueRaw) : null,
      createdById: user.id,
      assigneeId: assignedUserId,
      status: "OPEN",
    },
  });

  await recordTaskActivity({
    taskId: task.id,
    actorId: user.id,
    type: "created",
    message: assignedUsername
      ? `${user.username} created this task · Assigned to ${assignedUsername}`
      : `${user.username} created this task`,
  });

  if (assignedUserId && assignedUsername) {
    await prisma.notification.create({
      data: {
        userId: assignedUserId,
        type: "TASK_ASSIGNED",
        title: "Task assigned to you",
        body: `${user.username} assigned you “${name}”.`,
        meta: JSON.stringify({ workspaceId, taskId: task.id, folderId }),
      },
    });
  }

  revalidateWorkspace(workspaceId);
  revalidatePath("/app/notifications");
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function assignTaskAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const assignTo = String(formData.get("assignTo") ?? "").trim();

  const membership = await requireMembership(workspaceId, user.id);
  if (!canEditContent(membership.role)) {
    return { ok: false, error: "Only editors and above can auto-assign." };
  }

  const task = await prisma.task.findFirst({
    where: { id: taskId, workspaceId },
  });
  if (!task) return { ok: false, error: "Task not found." };
  if (task.status !== "OPEN") {
    return { ok: false, error: "Only open tasks can be auto-assigned." };
  }

  if (!assignTo) {
    await prisma.task.update({
      where: { id: taskId },
      data: { assigneeId: null },
    });
    await recordTaskActivity({
      taskId,
      actorId: user.id,
      type: "assignment_cleared",
      message: `${user.username} cleared the assignment`,
    });
    revalidateWorkspace(workspaceId);
    return { ok: true };
  }

  const targetMembership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: assignTo } },
    include: { user: true },
  });
  if (!targetMembership) {
    return { ok: false, error: "Assignee must be a workspace member." };
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { assigneeId: targetMembership.userId, status: "OPEN" },
  });

  await recordTaskActivity({
    taskId,
    actorId: user.id,
    type: "assigned",
    message: `${user.username} assigned this to ${targetMembership.user.username}`,
  });

  await prisma.notification.create({
    data: {
      userId: targetMembership.userId,
      type: "TASK_ASSIGNED",
      title: "Task assigned to you",
      body: `${user.username} assigned you “${task.name}”.`,
      meta: JSON.stringify({
        workspaceId,
        taskId,
        folderId: task.folderId,
      }),
    },
  });

  revalidateWorkspace(workspaceId);
  revalidatePath("/app/notifications");
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function claimTaskAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  await requireMembership(workspaceId, user.id);

  const task = await prisma.task.findFirst({
    where: { id: taskId, workspaceId },
  });
  if (!task) return { ok: false, error: "Task not found." };
  if (task.assigneeId && task.assigneeId !== user.id) {
    return {
      ok: false,
      error: "This task is assigned to someone else — you can’t claim it.",
    };
  }
  if (task.status !== "OPEN" && !(task.status === "CLAIMED" && !task.assigneeId)) {
    return { ok: false, error: "This task isn’t open to claim." };
  }

  await prisma.task.update({
    where: { id: taskId },
    data: {
      assigneeId: user.id,
      status: "CLAIMED",
      claimedAt: new Date(),
    },
  });

  await recordTaskActivity({
    taskId,
    actorId: user.id,
    type: "claimed",
    message: `${user.username} claimed this task`,
  });

  await syncCalendarForTask(taskId);
  revalidateWorkspace(workspaceId);
  return { ok: true };
}

export async function unclaimTaskAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  await requireMembership(workspaceId, user.id);

  const task = await prisma.task.findFirst({
    where: { id: taskId, workspaceId },
  });
  if (!task) return { ok: false, error: "Task not found." };
  if (task.assigneeId !== user.id) {
    return { ok: false, error: "Only the assignee can unclaim." };
  }
  if (task.status !== "CLAIMED") {
    return { ok: false, error: "Only claimed tasks can be unclaimed." };
  }

  await prisma.task.update({
    where: { id: taskId },
    data: {
      assigneeId: null,
      status: "OPEN",
      claimedAt: null,
    },
  });

  await recordTaskActivity({
    taskId,
    actorId: user.id,
    type: "unclaimed",
    message: `${user.username} unclaimed this task`,
  });

  await syncCalendarForTask(taskId);
  revalidateWorkspace(workspaceId);
  return { ok: true };
}

export async function completeTaskAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  await requireMembership(workspaceId, user.id);

  const comment = String(formData.get("comment") ?? "").trim();
  if (!comment) {
    return { ok: false, error: "Add a short note on what you completed." };
  }

  const task = await prisma.task.findFirst({
    where: { id: taskId, workspaceId },
  });
  if (!task) return { ok: false, error: "Task not found." };
  if (task.assigneeId !== user.id) {
    return { ok: false, error: "Only the assignee can mark this ready for review." };
  }
  if (task.status !== "CLAIMED" && task.status !== "OPEN") {
    return { ok: false, error: "This task isn’t ready to submit." };
  }

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: "IN_REVIEW",
      completionComment: comment,
    },
  });

  await recordTaskActivity({
    taskId,
    actorId: user.id,
    type: "submitted_review",
    message: `${user.username} submitted for review: ${comment}`,
  });

  const ownersAndAdmins = await prisma.membership.findMany({
    where: { workspaceId, role: { in: ["OWNER", "ADMIN"] } },
  });

  await prisma.notification.createMany({
    data: ownersAndAdmins.map((m) => ({
      userId: m.userId,
      type: "TASK_REVIEW",
      title: "Ready for review",
      body: `${user.username} finished “${task.name}”: ${comment}`,
      meta: JSON.stringify({ workspaceId, taskId, folderId: task.folderId }),
    })),
  });

  await syncCalendarForTask(taskId);
  revalidateWorkspace(workspaceId);
  return { ok: true };
}

export async function reviewTaskAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const decision = String(formData.get("decision") ?? "") as "approve" | "reopen";
  const reason = String(formData.get("reason") ?? "").trim();
  const approveComment = String(formData.get("approveComment") ?? "").trim();

  const membership = await requireMembership(workspaceId, user.id);
  if (!canEditContent(membership.role)) {
    return { ok: false, error: "Only editors and above can review tasks." };
  }

  if (decision !== "approve" && decision !== "reopen") {
    return { ok: false, error: "Pick approve or send back." };
  }
  if (decision === "reopen" && !reason) {
    return { ok: false, error: "Add a short reason when sending back." };
  }

  const task = await prisma.task.findFirst({
    where: { id: taskId, workspaceId },
  });
  if (!task || task.status !== "IN_REVIEW") {
    return { ok: false, error: "Nothing to review." };
  }

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: decision === "approve" ? "DONE" : "CLAIMED",
      completionComment: decision === "approve" ? task.completionComment : null,
    },
  });

  if (decision === "approve") {
    await recordTaskActivity({
      taskId,
      actorId: user.id,
      type: "approved",
      message: approveComment
        ? `${user.username} approved: ${approveComment}`
        : `${user.username} approved this task`,
    });
  } else {
    await recordTaskActivity({
      taskId,
      actorId: user.id,
      type: "sent_back",
      message: `${user.username} sent back: ${reason}`,
    });
  }

  if (task.assigneeId) {
    await prisma.notification.create({
      data: {
        userId: task.assigneeId,
        type: decision === "approve" ? "TASK_APPROVED" : "TASK_REOPENED",
        title: decision === "approve" ? "Task approved" : "Needs more work",
        body:
          decision === "approve"
            ? approveComment
              ? `“${task.name}” was approved: ${approveComment}`
              : `“${task.name}” was approved.`
            : `“${task.name}” was sent back: ${reason}`,
        meta: JSON.stringify({ workspaceId, taskId, folderId: task.folderId }),
      },
    });
  }

  await syncCalendarForTask(taskId);
  revalidateWorkspace(workspaceId);
  return { ok: true };
}

export async function addChecklistItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  await requireMembership(workspaceId, user.id);

  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { ok: false, error: "Checklist item needs a label." };

  const task = await prisma.task.findFirst({
    where: { id: taskId, workspaceId },
  });
  if (!task) return { ok: false, error: "Task not found." };
  if (task.assigneeId !== user.id || task.status !== "CLAIMED") {
    return { ok: false, error: "Only the claimant can add checklist items while claimed." };
  }

  const count = await prisma.taskChecklistItem.count({ where: { taskId } });
  await prisma.taskChecklistItem.create({
    data: { taskId, label, sortOrder: count },
  });

  await recordTaskActivity({
    taskId,
    actorId: user.id,
    type: "checklist_added",
    message: `${user.username} added checklist item “${label}”`,
  });

  revalidateWorkspace(workspaceId);
  return { ok: true };
}

export async function toggleChecklistItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return toggleChecklistItemCore(formData);
}

export async function toggleChecklistItemForm(formData: FormData): Promise<void> {
  await toggleChecklistItemCore(formData);
}

async function toggleChecklistItemCore(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  await requireMembership(workspaceId, user.id);

  const task = await prisma.task.findFirst({
    where: { id: taskId, workspaceId },
  });
  if (!task) return { ok: false, error: "Task not found." };
  if (task.assigneeId !== user.id || task.status !== "CLAIMED") {
    return { ok: false, error: "Only the claimant can check items off while claimed." };
  }

  const item = await prisma.taskChecklistItem.findFirst({
    where: { id: itemId, taskId },
  });
  if (!item) return { ok: false, error: "Checklist item not found." };

  await prisma.taskChecklistItem.update({
    where: { id: itemId },
    data: { done: !item.done },
  });

  // Local checkmarks only — no admin notifications
  revalidateWorkspace(workspaceId);
  return { ok: true };
}

export async function addPrivateTagAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  await requireMembership(workspaceId, user.id);

  const task = await prisma.task.findFirst({
    where: { id: taskId, workspaceId },
  });
  if (!task || task.assigneeId !== user.id) {
    return { ok: false, error: "Claim the task first to add your private tags." };
  }

  const name = String(formData.get("name") ?? "").trim().toLowerCase();
  if (!name) return { ok: false, error: "Tag needs a name." };

  let tag = await prisma.tag.findFirst({
    where: {
      workspaceId,
      name,
      isPublic: false,
      creatorId: user.id,
    },
  });

  if (!tag) {
    tag = await prisma.tag.create({
      data: {
        workspaceId,
        name,
        isPublic: false,
        creatorId: user.id,
      },
    });
  }

  await prisma.taskTag.upsert({
    where: { taskId_tagId: { taskId, tagId: tag.id } },
    create: { taskId, tagId: tag.id },
    update: {},
  });

  revalidateWorkspace(workspaceId);
  return { ok: true };
}

export async function addPublicTagAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const membership = await requireMembership(workspaceId, user.id);
  if (!canCreatePublicTags(membership.role)) {
    return { ok: false, error: "Only editors and above manage public tags." };
  }

  const name = String(formData.get("name") ?? "").trim().toLowerCase();
  if (!name) return { ok: false, error: "Tag needs a name." };

  let tag = await prisma.tag.findFirst({
    where: { workspaceId, name, isPublic: true },
  });
  if (!tag) {
    tag = await prisma.tag.create({
      data: { workspaceId, name, isPublic: true, creatorId: user.id },
    });
  }

  await prisma.taskTag.upsert({
    where: { taskId_tagId: { taskId, tagId: tag.id } },
    create: { taskId, tagId: tag.id },
    update: {},
  });

  revalidateWorkspace(workspaceId);
  return { ok: true };
}
