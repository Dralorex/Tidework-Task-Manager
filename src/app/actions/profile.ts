"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  isValidEmail,
  isValidNickname,
  isValidUsername,
  normalizeNickname,
  normalizeUsername,
} from "@/lib/utils";
import type { ActionResult } from "@/app/actions/auth";
import { welcomeAccountEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/mail";

export async function updateProfileAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();

  const usernameRaw = String(formData.get("username") ?? "").trim();
  const nicknameRaw = String(formData.get("nickname") ?? "");
  const emailRaw = String(formData.get("email") ?? "").trim();

  if (!isValidUsername(usernameRaw)) {
    return {
      ok: false,
      error: "Username must be 3–30 characters: letters, numbers, underscores.",
    };
  }

  const username = normalizeUsername(usernameRaw);
  const nickname = normalizeNickname(nicknameRaw);

  if (nicknameRaw.trim() && !isValidNickname(nickname)) {
    return {
      ok: false,
      error:
        "Nickname can use letters, numbers, and spaces (up to 40 characters).",
    };
  }

  if (username !== user.username) {
    const taken = await prisma.user.findUnique({ where: { username } });
    if (taken) return { ok: false, error: "That username is already taken." };
  }

  let email: string | null | undefined = undefined;
  if (!user.email) {
    if (emailRaw) {
      if (!isValidEmail(emailRaw)) {
        return { ok: false, error: "That email doesn’t look valid." };
      }
      const emailNorm = emailRaw.toLowerCase();
      const emailTaken = await prisma.user.findUnique({
        where: { email: emailNorm },
      });
      if (emailTaken) {
        return { ok: false, error: "That email is already in use." };
      }
      email = emailNorm;
    }
  } else if (emailRaw && emailRaw.toLowerCase() !== user.email.toLowerCase()) {
    return {
      ok: false,
      error: "Email is already set on this account and can’t be changed here.",
    };
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      username,
      nickname: nickname.length > 0 ? nickname : null,
      ...(email !== undefined ? { email } : {}),
    },
  });

  // Keep DM titles in sync when the login username changes.
  if (username !== user.username) {
    const dmMemberships = await prisma.chatMember.findMany({
      where: {
        userId: user.id,
        group: { isDirect: true },
      },
      include: {
        group: { include: { members: { include: { user: true } } } },
      },
    });

    for (const membership of dmMemberships) {
      const other = membership.group.members.find((m) => m.userId !== user.id)
        ?.user;
      if (!other) continue;
      const name = `${username} & ${other.username}`;
      await prisma.chatGroup.update({
        where: { id: membership.groupId },
        data: { name },
      });
    }
  }

  revalidatePath("/app", "layout");
  revalidatePath("/app/profile");
  revalidatePath("/app/chat");
  revalidatePath("/app/social");
  revalidatePath("/app/notifications");

  if (email) {
    const content = welcomeAccountEmail({
      username: updated.username,
      nickname: updated.nickname,
    });
    await sendEmail({
      to: email,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
  }

  return { ok: true };
}
