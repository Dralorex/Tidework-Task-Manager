"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canCreateGroups, requireMembership } from "@/lib/permissions";
import { normalizeUsername } from "@/lib/utils";
import type { ActionResult } from "@/app/actions/auth";

export async function sendFriendRequestAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  if (!username || username === user.username) {
    return { ok: false, error: "Enter someone else’s username." };
  }

  const other = await prisma.user.findUnique({ where: { username } });
  if (!other) return { ok: false, error: "User not found." };

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: user.id, addresseeId: other.id },
        { requesterId: other.id, addresseeId: user.id },
      ],
    },
  });
  if (existing?.status === "ACCEPTED") {
    return { ok: false, error: "You’re already friends." };
  }
  if (existing?.status === "PENDING") {
    return { ok: false, error: "A friend request is already pending." };
  }

  let friendship;
  if (existing) {
    friendship = await prisma.friendship.update({
      where: { id: existing.id },
      data: {
        requesterId: user.id,
        addresseeId: other.id,
        status: "PENDING",
      },
    });
  } else {
    friendship = await prisma.friendship.create({
      data: {
        requesterId: user.id,
        addresseeId: other.id,
        status: "PENDING",
      },
    });
  }

  await prisma.notification.create({
    data: {
      userId: other.id,
      type: "FRIEND_REQUEST",
      title: "Friend request",
      body: `${user.username} wants to be friends on Tidework.`,
      meta: JSON.stringify({
        fromUserId: user.id,
        friendshipId: friendship.id,
      }),
    },
  });

  revalidatePath("/app/social");
  revalidatePath("/app/notifications");
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function respondFriendRequestAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const friendshipId = String(formData.get("friendshipId") ?? "");
  const accept = String(formData.get("accept") ?? "") === "true";

  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });
  if (!friendship || friendship.addresseeId !== user.id) {
    return { ok: false, error: "Request not found." };
  }

  await prisma.friendship.update({
    where: { id: friendshipId },
    data: { status: accept ? "ACCEPTED" : "DECLINED" },
  });

  await prisma.notification.updateMany({
    where: {
      userId: user.id,
      type: "FRIEND_REQUEST",
      meta: { contains: friendshipId },
    },
    data: { read: true },
  });

  revalidatePath("/app/social");
  revalidatePath("/app/chat");
  revalidatePath("/app/notifications");
  revalidatePath("/app", "layout");
  return { ok: true };
}

async function findDirectGroup(userA: string, userB: string) {
  const groups = await prisma.chatGroup.findMany({
    where: {
      isDirect: true,
      AND: [
        { members: { some: { userId: userA } } },
        { members: { some: { userId: userB } } },
      ],
    },
    include: { members: true },
  });
  return groups.find((g) => g.members.length === 2) ?? null;
}

export async function requestWorkspaceDmAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  await requireMembership(workspaceId, user.id);

  const toUsername = normalizeUsername(String(formData.get("username") ?? ""));
  const firstMessage = String(formData.get("message") ?? "").trim();
  if (!firstMessage) return { ok: false, error: "Write a first message." };

  const other = await prisma.user.findUnique({ where: { username: toUsername } });
  if (!other) return { ok: false, error: "User not found." };
  if (other.id === user.id) return { ok: false, error: "That’s you." };

  const otherMembership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: other.id } },
  });
  if (!otherMembership) {
    return { ok: false, error: "They’re not in this workspace." };
  }

  const areFriends = await prisma.friendship.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { requesterId: user.id, addresseeId: other.id },
        { requesterId: other.id, addresseeId: user.id },
      ],
    },
  });

  if (areFriends) {
    const group = await findDirectGroup(user.id, other.id);
    let groupId: string;
    if (!group) {
      const created = await prisma.chatGroup.create({
        data: {
          name: `${user.username} & ${other.username}`,
          isDirect: true,
          createdById: user.id,
          members: {
            create: [{ userId: user.id }, { userId: other.id }],
          },
          messages: {
            create: { senderId: user.id, body: firstMessage },
          },
        },
      });
      groupId = created.id;
    } else {
      await prisma.message.create({
        data: { groupId: group.id, senderId: user.id, body: firstMessage },
      });
      groupId = group.id;
    }

    await prisma.notification.create({
      data: {
        userId: other.id,
        type: "CHAT_MESSAGE",
        title: `Message from @${user.username}`,
        body: firstMessage.slice(0, 140),
        meta: JSON.stringify({ groupId, fromUserId: user.id }),
      },
    });

    revalidatePath("/app/chat");
    revalidatePath("/app/notifications");
    revalidatePath("/app", "layout");
    return { ok: true };
  }

  const dmRequest = await prisma.dmRequest.create({
    data: {
      fromUserId: user.id,
      toUserId: other.id,
      firstMessage,
      status: "PENDING",
    },
  });

  await prisma.notification.create({
    data: {
      userId: other.id,
      type: "DM_REQUEST",
      title: "Chat request",
      body: `${user.username}: ${firstMessage}`,
      meta: JSON.stringify({
        fromUserId: user.id,
        requestId: dmRequest.id,
      }),
    },
  });

  revalidatePath("/app/chat");
  revalidatePath("/app/notifications");
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function respondDmRequestAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const requestId = String(formData.get("requestId") ?? "");
  const accept = String(formData.get("accept") ?? "") === "true";

  const request = await prisma.dmRequest.findUnique({
    where: { id: requestId },
    include: { fromUser: true },
  });
  if (!request || request.toUserId !== user.id) {
    return { ok: false, error: "Request not found." };
  }

  if (!accept) {
    await prisma.dmRequest.update({
      where: { id: requestId },
      data: { status: "DECLINED" },
    });
    await prisma.notification.updateMany({
      where: {
        userId: user.id,
        type: "DM_REQUEST",
        meta: { contains: requestId },
      },
      data: { read: true },
    });
    revalidatePath("/app/chat");
    revalidatePath("/app/notifications");
    revalidatePath("/app", "layout");
    return { ok: true };
  }

  const group = await prisma.chatGroup.create({
    data: {
      name: `${request.fromUser.username} & ${user.username}`,
      isDirect: true,
      createdById: request.fromUserId,
      members: {
        create: [{ userId: request.fromUserId }, { userId: user.id }],
      },
      messages: {
        create: {
          senderId: request.fromUserId,
          body: request.firstMessage,
        },
      },
    },
  });

  await prisma.dmRequest.update({
    where: { id: requestId },
    data: { status: "ACCEPTED", chatGroupId: group.id },
  });

  await prisma.notification.updateMany({
    where: {
      userId: user.id,
      type: "DM_REQUEST",
      meta: { contains: requestId },
    },
    data: { read: true },
  });

  revalidatePath("/app/chat");
  revalidatePath("/app/notifications");
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function createGroupChatAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const membership = await requireMembership(workspaceId, user.id);
  if (!canCreateGroups(membership.role)) {
    return { ok: false, error: "Only admins and owners can create group chats." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Group needs a name." };

  const memberUsernames = String(formData.get("members") ?? "")
    .split(",")
    .map((s) => normalizeUsername(s))
    .filter(Boolean);

  const users = await prisma.user.findMany({
    where: { username: { in: memberUsernames } },
  });

  const memberIds = new Set(users.map((u) => u.id));
  memberIds.add(user.id);

  for (const memberId of memberIds) {
    if (memberId === user.id) continue;
    const m = await prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: memberId } },
    });
    if (!m) {
      return { ok: false, error: "All members must belong to the workspace." };
    }
  }

  await prisma.chatGroup.create({
    data: {
      workspaceId,
      name,
      isDirect: false,
      createdById: user.id,
      members: {
        create: [...memberIds].map((userId) => ({ userId })),
      },
    },
  });

  revalidatePath("/app/chat");
  revalidatePath(`/app/w/${workspaceId}`);
  return { ok: true };
}

export async function sendMessageAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const groupId = String(formData.get("groupId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { ok: false, error: "Message can’t be empty." };

  const member = await prisma.chatMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
  });
  if (!member) return { ok: false, error: "You’re not in this chat." };

  const group = await prisma.chatGroup.findUnique({
    where: { id: groupId },
    include: { members: true },
  });
  if (!group) return { ok: false, error: "Chat not found." };

  await prisma.message.create({
    data: { groupId, senderId: user.id, body },
  });

  const recipients = group.members
    .map((m) => m.userId)
    .filter((id) => id !== user.id);

  if (recipients.length > 0) {
    const preview = body.slice(0, 140);
    const title = group.isDirect
      ? `Message from @${user.username}`
      : `${group.name}: @${user.username}`;
    await prisma.notification.createMany({
      data: recipients.map((userId) => ({
        userId,
        type: "CHAT_MESSAGE",
        title,
        body: preview,
        meta: JSON.stringify({ groupId, fromUserId: user.id }),
      })),
    });
  }

  revalidatePath("/app/chat");
  revalidatePath("/app/notifications");
  revalidatePath("/app", "layout");
  return { ok: true };
}
