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
import type { TaskPriority } from "@/generated/prisma/client";
import type { ActionResult } from "@/app/actions/auth";
import { personLabel } from "@/lib/utils";

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

  revalidatePath(`/app/w/${workspaceId}`);
  return { ok: true };
}

export async function renameFolderAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const folderId = String(formData.get("folderId") ?? "");

  const membership = await requireMembership(workspaceId, user.id);
  if (!canEditContent(membership.role)) {
    return { ok: false, error: "Members can’t rename folders." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Folder needs a name." };

  const folder = await prisma.folder.findFirst({
    where: { id: folderId, workspaceId },
  });
  if (!folder) return { ok: false, error: "Folder not found." };

  await prisma.folder.update({
    where: { id: folderId },
    data: { name },
  });

  revalidatePath(`/app/w/${workspaceId}`);
  return { ok: true };
}

export async function deleteFolderAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const folderId = String(formData.get("folderId") ?? "");

  const membership = await requireMembership(workspaceId, user.id);
  if (!canEditContent(membership.role)) {
    return { ok: false, error: "Members can’t delete folders." };
  }

  const folder = await prisma.folder.findFirst({
    where: { id: folderId, workspaceId },
  });
  if (!folder) return { ok: false, error: "Folder not found." };

  const parentId = folder.parentId;
  await prisma.folder.delete({ where: { id: folderId } });

  revalidatePath(`/app/w/${workspaceId}`);
  return {
    ok: true,
    resetUrl: parentId
      ? `/app/w/${workspaceId}?folder=${parentId}`
      : `/app/w/${workspaceId}`,
  };
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

  if (!name) return { ok: false, error: "Task needs a name." };
  if (!["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(priority)) {
    return { ok: false, error: "Pick a valid priority." };
  }

  const folder = await prisma.folder.findFirst({
    where: { id: folderId, workspaceId },
  });
  if (!folder) return { ok: false, error: "Folder not found." };

  await prisma.task.create({
    data: {
      workspaceId,
      folderId,
      name,
      description,
      priority,
      dueDate: dueRaw ? new Date(dueRaw) : null,
      createdById: user.id,
    },
  });

  revalidatePath(`/app/w/${workspaceId}`);
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
    return { ok: false, error: "Someone else already claimed this task." };
  }

  await prisma.task.update({
    where: { id: taskId },
    data: {
      assigneeId: user.id,
      status: "CLAIMED",
      claimedAt: new Date(),
      lastUnclaimReason: null,
      lastUnclaimWorkNote: null,
      lastUnclaimedById: null,
    },
  });

  // Restore this user's remembered private tags for this task.
  const remembered = await prisma.rememberedPrivateTag.findMany({
    where: { userId: user.id, taskId },
  });
  if (remembered.length > 0) {
    await prisma.taskTag.createMany({
      data: remembered.map((r) => ({ taskId: r.taskId, tagId: r.tagId })),
      skipDuplicates: true,
    });
    await prisma.rememberedPrivateTag.deleteMany({
      where: { userId: user.id, taskId },
    });
  }

  await syncCalendarForTask(taskId);
  revalidatePath(`/app/w/${workspaceId}`);
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function unclaimTaskAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const workNote = String(formData.get("workNote") ?? "").trim();
  await requireMembership(workspaceId, user.id);

  if (!reason) {
    return { ok: false, error: "Say why you’re unclaiming this task." };
  }

  const task = await prisma.task.findFirst({
    where: { id: taskId, workspaceId },
    include: {
      tags: { include: { tag: true } },
    },
  });
  if (!task) return { ok: false, error: "Task not found." };
  if (task.assigneeId !== user.id) {
    return { ok: false, error: "Only the assignee can unclaim this task." };
  }
  if (task.status === "IN_REVIEW" || task.status === "DONE") {
    return {
      ok: false,
      error: "Finish or wait for review before unclaiming.",
    };
  }

  const privateLinks = task.tags.filter(
    (tt) => !tt.tag.isPublic && tt.tag.creatorId === user.id,
  );

  if (privateLinks.length > 0) {
    await prisma.rememberedPrivateTag.createMany({
      data: privateLinks.map((tt) => ({
        userId: user.id,
        taskId,
        tagId: tt.tagId,
      })),
      skipDuplicates: true,
    });
    await prisma.taskTag.deleteMany({
      where: {
        taskId,
        tagId: { in: privateLinks.map((tt) => tt.tagId) },
      },
    });
  }

  await prisma.task.update({
    where: { id: taskId },
    data: {
      assigneeId: null,
      status: "OPEN",
      claimedAt: null,
      lastUnclaimReason: reason,
      lastUnclaimWorkNote: workNote || null,
      lastUnclaimedById: user.id,
    },
  });

  await syncCalendarForTask(taskId);
  revalidatePath(`/app/w/${workspaceId}`);
  revalidatePath("/app", "layout");
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

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: "IN_REVIEW",
      completionComment: comment,
    },
  });

  const ownersAndAdmins = await prisma.membership.findMany({
    where: { workspaceId, role: { in: ["OWNER", "ADMIN"] } },
  });

  await prisma.notification.createMany({
    data: ownersAndAdmins.map((m) => ({
      userId: m.userId,
      type: "TASK_REVIEW",
      title: "Ready for review",
      body: `${personLabel(user)} finished “${task.name}”: ${comment}`,
      meta: JSON.stringify({
        workspaceId,
        taskId,
        folderId: task.folderId,
      }),
    })),
  });

  await syncCalendarForTask(taskId);
  revalidatePath(`/app/w/${workspaceId}`);
  revalidatePath("/app/notifications");
  revalidatePath("/app", "layout");
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

  const membership = await requireMembership(workspaceId, user.id);
  if (!canEditContent(membership.role)) {
    return { ok: false, error: "Only editors and above can review tasks." };
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

  if (task.assigneeId) {
    await prisma.notification.create({
      data: {
        userId: task.assigneeId,
        type: decision === "approve" ? "TASK_APPROVED" : "TASK_REOPENED",
        title: decision === "approve" ? "Task approved" : "Needs more work",
        body:
          decision === "approve"
            ? `“${task.name}” was approved.`
            : `“${task.name}” was sent back for more work.`,
        meta: JSON.stringify({
          workspaceId,
          taskId,
          folderId: task.folderId,
        }),
      },
    });
  }

  await syncCalendarForTask(taskId);
  revalidatePath(`/app/w/${workspaceId}`);
  revalidatePath("/app/notifications");
  revalidatePath("/app", "layout");
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

  revalidatePath(`/app/w/${workspaceId}`);
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

  revalidatePath(`/app/w/${workspaceId}`);
  return { ok: true };
}
