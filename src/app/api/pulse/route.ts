import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Lightweight fingerprint so clients can refresh when inbox/chat/tasks/roles change. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const [latestNotif, unreadTotal, chatUnread, latestMessage, memberships] =
    await Promise.all([
      prisma.notification.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, createdAt: true },
      }),
      prisma.notification.count({
        where: {
          userId: user.id,
          read: false,
          type: { notIn: ["CHAT_MESSAGE", "DM_REQUEST"] },
        },
      }),
      prisma.notification.count({
        where: {
          userId: user.id,
          read: false,
          type: { in: ["CHAT_MESSAGE", "DM_REQUEST"] },
        },
      }),
      prisma.message.findFirst({
        where: { group: { members: { some: { userId: user.id } } } },
        orderBy: { createdAt: "desc" },
        select: { id: true, createdAt: true },
      }),
      prisma.membership.findMany({
        where: { userId: user.id },
        select: { workspaceId: true, role: true, updatedAt: true },
      }),
    ]);

  const workspaceIds = memberships.map((m) => m.workspaceId);
  const membershipStamp = memberships
    .map(
      (m) =>
        `${m.workspaceId}:${m.role}:${m.updatedAt?.toISOString() ?? ""}`,
    )
    .sort()
    .join(",");

  const latestTask =
    workspaceIds.length > 0
      ? await prisma.task.findFirst({
          where: { workspaceId: { in: workspaceIds } },
          orderBy: { updatedAt: "desc" },
          select: { id: true, updatedAt: true },
        })
      : null;

  const latestFolder =
    workspaceIds.length > 0
      ? await prisma.folder.findFirst({
          where: { workspaceId: { in: workspaceIds } },
          orderBy: { updatedAt: "desc" },
          select: { id: true, updatedAt: true },
        })
      : null;

  const stamp = [
    latestNotif?.id ?? "",
    latestNotif?.createdAt?.toISOString() ?? "",
    String(unreadTotal),
    String(chatUnread),
    latestMessage?.id ?? "",
    latestMessage?.createdAt?.toISOString() ?? "",
    latestTask?.id ?? "",
    latestTask?.updatedAt?.toISOString() ?? "",
    latestFolder?.id ?? "",
    latestFolder?.updatedAt?.toISOString() ?? "",
    membershipStamp,
  ].join("|");

  return NextResponse.json({
    ok: true,
    stamp,
    unreadTotal,
    chatUnread,
  });
}
