"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManagePeople, requireMembership } from "@/lib/permissions";
import { isValidEmail, normalizeUsername } from "@/lib/utils";
import type { Role } from "@/generated/prisma/client";
import type { ActionResult } from "@/app/actions/auth";

export async function createWorkspaceAction(
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
  workspaceId: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
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

  await prisma.invite.create({
    data: {
      workspaceId,
      invitedById: user.id,
      targetUsername: isEmail ? null : normalizeUsername(target),
      targetEmail: isEmail ? target.toLowerCase() : null,
      role,
      token: nanoid(32),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
    },
  });

  revalidatePath(`/app/w/${workspaceId}`);
  return { ok: true };
}

export async function acceptInviteAction(token: string): Promise<ActionResult> {
  const user = await requireUser();
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
  ]);

  redirect(`/app/w/${invite.workspaceId}`);
}
