"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManagePeople, requireMembership } from "@/lib/permissions";
import { isValidEmail, normalizeUsername, personLabel } from "@/lib/utils";
import type { Role } from "@/generated/prisma/client";
import type { ActionResult } from "@/app/actions/auth";

export async function createWorkspaceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Give your workspace a name." };

  const workspace = await prisma.workspace.create({
    data: {
      name,
      ownerId: user.id,
      memberships: {
        create: { userId: user.id, role: "OWNER" },
      },
    },
  });

  redirect(`/app/w/${workspace.id}`);
}

export async function inviteMemberAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const membership = await requireMembership(workspaceId, user.id);
  if (!canManagePeople(membership.role)) {
    return { ok: false, error: "Only owners and admins can invite people." };
  }

  const target = String(formData.get("target") ?? "").trim();
  const role = String(formData.get("role") ?? "MEMBER") as Role;
  if (!["ADMIN", "EDITOR", "MEMBER"].includes(role)) {
    return { ok: false, error: "Pick a valid role." };
  }
  if (!target) return { ok: false, error: "Enter a username or email." };

  const isEmail = target.includes("@");
  if (isEmail && !isValidEmail(target)) {
    return { ok: false, error: "That email doesn’t look valid." };
  }

  const targetUsername = isEmail ? null : normalizeUsername(target);
  const targetEmail = isEmail ? target.toLowerCase() : null;
  const token = nanoid(32);

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
  });

  const invite = await prisma.invite.create({
    data: {
      workspaceId,
      invitedById: user.id,
      targetUsername,
      targetEmail,
      role,
      token,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
    },
  });

  const invitee = await prisma.user.findFirst({
    where: targetUsername
      ? { username: targetUsername }
      : { email: targetEmail ?? undefined },
  });

  if (invitee) {
    await prisma.notification.create({
      data: {
        userId: invitee.id,
        type: "WORKSPACE_INVITE",
        title: "Workspace invite",
        body: `${personLabel(user)} invited you to “${workspace.name}” as ${role.toLowerCase()}.`,
        meta: JSON.stringify({
          inviteId: invite.id,
          token: invite.token,
          workspaceId,
        }),
      },
    });
  }

  revalidatePath(`/app/w/${workspaceId}`);
  revalidatePath("/app/notifications");
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function acceptInviteAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const token = String(formData.get("token") ?? "");
  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite || invite.status !== "PENDING" || invite.expiresAt < new Date()) {
    return { ok: false, error: "Invite is invalid or expired." };
  }

  const matchesUsername =
    invite.targetUsername && invite.targetUsername === user.username;
  const matchesEmail =
    invite.targetEmail && user.email && invite.targetEmail === user.email;
  if (!matchesUsername && !matchesEmail) {
    return { ok: false, error: "This invite isn’t for your account." };
  }

  await prisma.$transaction([
    prisma.membership.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: invite.workspaceId,
          userId: user.id,
        },
      },
      create: {
        workspaceId: invite.workspaceId,
        userId: user.id,
        role: invite.role,
      },
      update: { role: invite.role },
    }),
    prisma.invite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED" },
    }),
    prisma.notification.updateMany({
      where: {
        userId: user.id,
        type: "WORKSPACE_INVITE",
        read: false,
        meta: { contains: invite.token },
      },
      data: { read: true },
    }),
  ]);

  revalidatePath("/app", "layout");
  revalidatePath("/app/notifications");
  redirect(`/app/w/${invite.workspaceId}`);
}

export async function declineInviteAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const token = String(formData.get("token") ?? "");
  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite || invite.status !== "PENDING" || invite.expiresAt < new Date()) {
    return { ok: false, error: "Invite is invalid or expired." };
  }

  const matchesUsername =
    invite.targetUsername && invite.targetUsername === user.username;
  const matchesEmail =
    invite.targetEmail && user.email && invite.targetEmail === user.email;
  if (!matchesUsername && !matchesEmail) {
    return { ok: false, error: "This invite isn’t for your account." };
  }

  await prisma.$transaction([
    prisma.invite.update({
      where: { id: invite.id },
      data: { status: "DECLINED" },
    }),
    prisma.notification.updateMany({
      where: {
        userId: user.id,
        type: "WORKSPACE_INVITE",
        meta: { contains: invite.token },
      },
      data: { read: true },
    }),
  ]);

  revalidatePath("/app", "layout");
  revalidatePath("/app/notifications");
  return { ok: true };
}
