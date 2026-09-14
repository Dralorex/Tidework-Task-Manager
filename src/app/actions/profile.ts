"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  isValidNickname,
  isValidUsername,
  normalizeNickname,
  normalizeUsername,
} from "@/lib/utils";
import type { ActionResult } from "@/app/actions/auth";

export async function updateProfileAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();

  const usernameRaw = String(formData.get("username") ?? "").trim();
  const nicknameRaw = String(formData.get("nickname") ?? "");

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

  await prisma.user.update({
    where: { id: user.id },
    data: {
      username,
      nickname: nickname.length > 0 ? nickname : null,
    },
  });

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
  return { ok: true };
}
