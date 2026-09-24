"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { publishChatPresence } from "@/lib/chat-presence-bus";
import { prisma } from "@/lib/db";
import { canCreateGroups, canManagePeople, requireMembership } from "@/lib/permissions";
import { OPEN_THREAD_MS, parseMentions } from "@/lib/mentions";
import { normalizeUsername } from "@/lib/utils";
import type { Role } from "@/generated/prisma/client";
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

  const friendship = existing
    ? await prisma.friendship.update({
        where: { id: existing.id },
        data: {
          requesterId: user.id,
          addresseeId: other.id,
          status: "PENDING",
        },
      })
    : await prisma.friendship.create({
        data: {
          requesterId: user.id,
          addresseeId: other.id,
          status: "PENDING",
        },
      });

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
    if (!group) {
      await prisma.chatGroup.create({
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
    } else {
      await prisma.message.create({
        data: { groupId: group.id, senderId: user.id, body: firstMessage },
      });
    }
    revalidatePath("/app/chat");
    return { ok: true };
  }

  await prisma.dmRequest.create({
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
      meta: JSON.stringify({ fromUserId: user.id }),
    },
  });

  revalidatePath("/app/chat");
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
    revalidatePath("/app/chat");
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

  revalidatePath("/app/chat");
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
    include: {
      group: {
        include: {
          members: { include: { user: true } },
        },
      },
    },
  });
  if (!member) return { ok: false, error: "You’re not in this chat." };

  await prisma.chatMember.update({
    where: { id: member.id },
    data: { typingAt: null, lastSeenAt: new Date() },
  });

  const group = member.group;
  const chatMembers = group.members;
  const memberByUsername = new Map(
    chatMembers.map((m) => [m.user.username.toLowerCase(), m]),
  );

  const parsed = parseMentions(body);
  const wantsEveryone = parsed.some((p) => p.kind === "everyone");
  const roleMentions = parsed.filter(
    (p): p is { kind: "role"; roleName: Role } => p.kind === "role",
  );
  const userMentions = parsed.filter(
    (p): p is { kind: "user"; username: string } => p.kind === "user",
  );

  let senderWorkspaceRole: Role | null = null;
  if (group.workspaceId) {
    const wsMembership = await prisma.membership.findUnique({
      where: {
        workspaceId_userId: { workspaceId: group.workspaceId, userId: user.id },
      },
    });
    senderWorkspaceRole = wsMembership?.role ?? null;
  }

  const canUseElevatedMentions = group.workspaceId
    ? Boolean(senderWorkspaceRole && canManagePeople(senderWorkspaceRole))
    : true; // friend groups: any member may @everyone

  if ((wantsEveryone || roleMentions.length > 0) && !canUseElevatedMentions) {
    return {
      ok: false,
      error: "Only Admin+ can use @everyone or @role in workspace chats.",
    };
  }

  if (roleMentions.length > 0 && !group.workspaceId) {
    return { ok: false, error: "@role only works in workspace group chats." };
  }

  if (wantsEveryone && group.isDirect) {
    return { ok: false, error: "@everyone isn’t used in 1:1 DMs." };
  }

  const mentionedUserIds = new Set<string>();

  for (const mention of userMentions) {
    const target = memberByUsername.get(mention.username);
    if (target && target.userId !== user.id) {
      mentionedUserIds.add(target.userId);
    }
  }

  if (wantsEveryone) {
    for (const m of chatMembers) {
      if (m.userId !== user.id) mentionedUserIds.add(m.userId);
    }
  }

  if (roleMentions.length > 0 && group.workspaceId) {
    const roleNames = roleMentions.map((r) => r.roleName);
    const roleMembers = await prisma.membership.findMany({
      where: {
        workspaceId: group.workspaceId,
        role: { in: roleNames },
        userId: { in: chatMembers.map((m) => m.userId) },
      },
    });
    for (const rm of roleMembers) {
      if (rm.userId !== user.id) mentionedUserIds.add(rm.userId);
    }
  }

  const message = await prisma.message.create({
    data: {
      groupId,
      senderId: user.id,
      body,
      mentions: {
        create: [
          ...userMentions
            .map((m) => {
              const target = memberByUsername.get(m.username);
              if (!target) return null;
              return {
                kind: "user",
                userId: target.userId,
              };
            })
            .filter((m): m is { kind: string; userId: string } => Boolean(m)),
          ...(wantsEveryone ? [{ kind: "everyone" as const }] : []),
          ...roleMentions.map((r) => ({
            kind: "role" as const,
            roleName: r.roleName,
          })),
        ],
      },
    },
  });

  const now = Date.now();
  const preview = body.length > 120 ? `${body.slice(0, 117)}…` : body;

  for (const m of chatMembers) {
    if (m.userId === user.id) continue;

    const mentioned = mentionedUserIds.has(m.userId);
    const mode = m.notifyMode;
    if (mode === "MUTE") continue;
    if (mode === "MENTIONS" && !mentioned) continue;
    // ALL: notify for every message; MENTIONS: only when mentioned

    if (
      m.lastSeenAt &&
      now - m.lastSeenAt.getTime() < OPEN_THREAD_MS
    ) {
      continue; // actively in the chat
    }

    await prisma.notification.create({
      data: {
        userId: m.userId,
        type: mentioned ? "CHAT_MENTION" : "CHAT_MESSAGE",
        title: mentioned ? "Mentioned in chat" : "New chat message",
        body: `${user.username} in ${group.name}: ${preview}`,
        meta: JSON.stringify({
          groupId,
          messageId: message.id,
          mentioned,
        }),
      },
    });
  }

  revalidatePath("/app/chat");
  revalidatePath("/app", "layout");
  revalidatePath("/app/notifications");
  publishChatPresence(groupId);
  return { ok: true };
}

export async function setChatNotifyModeAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const groupId = String(formData.get("groupId") ?? "");
  const mode = String(formData.get("mode") ?? "") as "ALL" | "MENTIONS" | "MUTE";
  if (!["ALL", "MENTIONS", "MUTE"].includes(mode)) {
    return { ok: false, error: "Pick a valid notification mode." };
  }

  const member = await prisma.chatMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
  });
  if (!member) return { ok: false, error: "You’re not in this chat." };

  await prisma.chatMember.update({
    where: { id: member.id },
    data: { notifyMode: mode },
  });

  revalidatePath("/app/chat");
  return { ok: true };
}

export async function touchChatSeenAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const groupId = String(formData.get("groupId") ?? "");
  const member = await prisma.chatMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
  });
  if (!member) return { ok: false, error: "You’re not in this chat." };

  await prisma.chatMember.update({
    where: { id: member.id },
    data: { lastSeenAt: new Date() },
  });

  // Mark chat notifications for this group as read
  await prisma.notification.updateMany({
    where: {
      userId: user.id,
      read: false,
      type: { in: ["CHAT_MESSAGE", "CHAT_MENTION"] },
      meta: { contains: groupId },
    },
    data: { read: true },
  });

  publishChatPresence(groupId);
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function setTypingAction(groupId: string): Promise<ActionResult> {
  const user = await requireUser();
  const member = await prisma.chatMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
  });
  if (!member) return { ok: false, error: "You’re not in this chat." };

  const now = new Date();
  await prisma.chatMember.update({
    where: { id: member.id },
    data: { typingAt: now, lastSeenAt: now },
  });
  publishChatPresence(groupId);
  return { ok: true };
}

export async function clearTypingAction(groupId: string): Promise<ActionResult> {
  const user = await requireUser();
  const member = await prisma.chatMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
  });
  if (!member) return { ok: false, error: "You’re not in this chat." };

  await prisma.chatMember.update({
    where: { id: member.id },
    data: { typingAt: null },
  });
  publishChatPresence(groupId);
  return { ok: true };
}

export async function fetchChatPresence(groupId: string) {
  const user = await requireUser();
  const member = await prisma.chatMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
  });
  if (!member) return { ok: false as const, error: "You’re not in this chat." };

  const members = await prisma.chatMember.findMany({
    where: { groupId },
    include: { user: { select: { id: true, username: true } } },
  });

  const { derivePresence } = await import("@/lib/chat-presence");
  const presence = derivePresence(
    members.map((m) => ({
      userId: m.userId,
      username: m.user.username,
      lastSeenAt: m.lastSeenAt,
      typingAt: m.typingAt,
    })),
    user.id,
  );

  return { ok: true as const, presence, selfId: user.id };
}
