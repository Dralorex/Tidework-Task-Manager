import Link from "next/link";
import { format } from "date-fns";
import { InlineActionForm } from "@/app/components/forms";
import { ChatRowMenu } from "@/app/components/chat-row-menu";
import { MarkChatSeen } from "@/app/components/mark-chat-seen";
import { StartDmForm } from "@/app/components/start-dm-form";
import { CreateFriendGroupForm } from "@/app/components/create-friend-group-form";
import { CreateWorkspaceGroupForm } from "@/app/components/create-workspace-group-form";
import { respondDmRequestAction, sendMessageAction } from "@/app/actions/social";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { personLabel, type UserLabel } from "@/lib/utils";

type Tab = "hub" | "dms" | "groups" | "workspace-groups";

function dmDisplayName(
  members: { user: UserLabel & { id: string } }[],
  userId: string,
) {
  const other = members.find((m) => m.user.id !== userId)?.user;
  return other ? personLabel(other) : "Direct message";
}

function snippet(body: string | undefined) {
  if (!body) return "No messages yet";
  const trimmed = body.trim();
  return trimmed.length > 72 ? `${trimmed.slice(0, 72)}…` : trimmed;
}

function isChatTab(value: string | undefined): value is Exclude<Tab, "hub"> {
  return value === "dms" || value === "groups" || value === "workspace-groups";
}

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; tab?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const userId = user.id;

  const tabParam = isChatTab(sp.tab) ? sp.tab : null;
  const groupId = sp.group ?? null;

  let tab: Tab = "hub";

  const memberships = await prisma.chatMember.findMany({
    where: { userId },
    include: {
      group: {
        include: {
          members: { include: { user: true } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { sender: true },
          },
        },
      },
    },
  });

  const groups = memberships.map((m) => m.group);

  function latestMessageAt(g: (typeof groups)[number]) {
    return g.messages[0]?.createdAt?.getTime() ?? 0;
  }

  function dmOtherIsDeleted(g: (typeof groups)[number]) {
    const other = g.members.find((m) => m.user.id !== userId)?.user;
    return Boolean(other?.deletedAt);
  }

  const dms = groups
    .filter((g) => g.isDirect)
    .sort((a, b) => {
      const aDel = dmOtherIsDeleted(a) ? 1 : 0;
      const bDel = dmOtherIsDeleted(b) ? 1 : 0;
      if (aDel !== bDel) return aDel - bDel;
      return latestMessageAt(b) - latestMessageAt(a);
    });

  const friendGroups = groups
    .filter((g) => !g.isDirect && !g.workspaceId)
    .sort((a, b) => latestMessageAt(b) - latestMessageAt(a));

  const workspaceGroups = groups
    .filter((g) => !g.isDirect && Boolean(g.workspaceId))
    .sort((a, b) => latestMessageAt(b) - latestMessageAt(a));

  if (groupId && !tabParam) {
    const g = groups.find((x) => x.id === groupId);
    if (g?.isDirect) tab = "dms";
    else if (g?.workspaceId) tab = "workspace-groups";
    else tab = "groups";
  } else if (tabParam) {
    tab = tabParam;
  }

  const active =
    groupId && tab !== "hub"
      ? (groups.find((g) => g.id === groupId) ?? null)
      : null;

  const threadMessages = active
    ? await prisma.message.findMany({
        where: { groupId: active.id },
        orderBy: { createdAt: "asc" },
        take: 120,
        include: { sender: true },
      })
    : [];

  const unreadByGroup = await prisma.notification.findMany({
    where: {
      userId: user.id,
      type: "CHAT_MESSAGE",
      read: false,
    },
    select: { meta: true },
  });
  const unreadCounts = new Map<string, number>();
  for (const n of unreadByGroup) {
    if (!n.meta) continue;
    try {
      const meta = JSON.parse(n.meta) as { groupId?: string };
      if (meta.groupId) {
        unreadCounts.set(meta.groupId, (unreadCounts.get(meta.groupId) ?? 0) + 1);
      }
    } catch {
      /* ignore */
    }
  }

  const dmRequests = await prisma.dmRequest.findMany({
    where: { toUserId: user.id, status: "PENDING" },
    include: { fromUser: true },
  });

  const adminWorkspaces = await prisma.membership.findMany({
    where: { userId: user.id, role: { in: ["OWNER", "ADMIN"] } },
    include: { workspace: true },
  });

  const allWorkspaces = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { workspace: true },
  });

  const adminWorkspaceIds = new Set(adminWorkspaces.map((m) => m.workspaceId));

  const adminWorkspaceMemberships =
    adminWorkspaces.length > 0
      ? await prisma.membership.findMany({
          where: {
            workspaceId: { in: adminWorkspaces.map((m) => m.workspaceId) },
          },
          include: { user: true },
        })
      : [];

  const membersByWorkspace: Record<
    string,
    { id: string; username: string; label: string }[]
  > = {};
  for (const row of adminWorkspaceMemberships) {
    if (row.userId === userId) continue;
    const list = membersByWorkspace[row.workspaceId] ?? [];
    list.push({
      id: row.userId,
      username: row.user.username,
      label: personLabel(row.user),
    });
    membersByWorkspace[row.workspaceId] = list;
  }
  for (const wsId of Object.keys(membersByWorkspace)) {
    membersByWorkspace[wsId].sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
    );
  }

  const acceptedFriendships = await prisma.friendship.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: user.id }, { addresseeId: user.id }],
    },
    include: { requester: true, addressee: true },
  });

  const friendOptions = acceptedFriendships.map((row) => {
    const friend = row.requesterId === user.id ? row.addressee : row.requester;
    return {
      id: friend.id,
      username: friend.username,
      label: personLabel(friend),
    };
  });

  const friendsWithDmIds = dms
    .map((g) => g.members.find((m) => m.user.id !== userId)?.user.id)
    .filter((id): id is string => Boolean(id));

  let friendGroupsUnread = 0;
  let workspaceGroupsUnread = 0;
  let dmsUnread = 0;
  for (const g of groups) {
    const n = unreadCounts.get(g.id) ?? 0;
    if (g.isDirect) dmsUnread += n;
    else if (g.workspaceId) workspaceGroupsUnread += n;
    else friendGroupsUnread += n;
  }
  dmsUnread += dmRequests.length;

  function canDeleteGroup(g: (typeof groups)[number]) {
    if (g.isDirect) return false;
    if (g.createdById === userId) return true;
    return Boolean(g.workspaceId && adminWorkspaceIds.has(g.workspaceId));
  }

  function listHref(kind: Exclude<Tab, "hub">) {
    return `/app/chat?tab=${kind}`;
  }

  function threadHref(kind: Exclude<Tab, "hub">, id: string) {
    return `/app/chat?tab=${kind}&group=${id}`;
  }

  function listKindForGroup(g: (typeof groups)[number]): Exclude<Tab, "hub"> {
    if (g.isDirect) return "dms";
    if (g.workspaceId) return "workspace-groups";
    return "groups";
  }

  const listItems =
    tab === "dms"
      ? dms
      : tab === "groups"
        ? friendGroups
        : tab === "workspace-groups"
          ? workspaceGroups
          : [];
  const listTitle =
    tab === "dms"
      ? "DMs"
      : tab === "groups"
        ? "Groups"
        : tab === "workspace-groups"
          ? "Workspace groups"
          : "";
  const listEmpty =
    tab === "dms"
      ? "No direct messages yet. Message someone from the sidebar."
      : tab === "groups"
        ? "No friend groups yet. Create one from the sidebar."
        : "No workspace groups yet.";

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-4">
        {dmRequests.length > 0 ? (
          <div className="tide-panel p-4">
            <h3 className="font-semibold text-[#0A3D45]">DM requests</h3>
            <ul className="mt-2 space-y-3 text-sm">
              {dmRequests.map((r) => (
                <li key={r.id}>
                  <p>
                    <span className="font-medium">{personLabel(r.fromUser)}</span>:{" "}
                    {r.firstMessage}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <InlineActionForm
                      action={respondDmRequestAction}
                      submitLabel="Accept"
                    >
                      <input type="hidden" name="requestId" value={r.id} />
                      <input type="hidden" name="accept" value="true" />
                    </InlineActionForm>
                    <InlineActionForm
                      action={respondDmRequestAction}
                      submitLabel="Decline"
                    >
                      <input type="hidden" name="requestId" value={r.id} />
                      <input type="hidden" name="accept" value="false" />
                    </InlineActionForm>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="tide-panel p-4">
          <StartDmForm
            friends={friendOptions}
            friendsWithDmIds={friendsWithDmIds}
            workspaces={allWorkspaces.map((m) => ({
              id: m.workspaceId,
              name: m.workspace.name,
            }))}
          />

          <CreateFriendGroupForm friends={friendOptions} />

          <CreateWorkspaceGroupForm
            workspaces={adminWorkspaces.map((m) => ({
              id: m.workspaceId,
              name: m.workspace.name,
            }))}
            membersByWorkspace={membersByWorkspace}
          />
        </div>
      </aside>

      <section
        className={`tide-panel flex flex-col p-5 ${
          active
            ? "h-[min(36rem,calc(100dvh-6rem))] min-h-[28rem]"
            : "min-h-[28rem]"
        }`}
      >
        {tab === "hub" && !active ? (
          <>
            <h1 className="font-[family-name:var(--font-display)] text-2xl text-[#0A3D45]">
              Chat
            </h1>
            <p className="mt-1 text-sm text-[#0A3D45]/60">
              Choose Groups, Workspace groups, or DMs to browse conversations.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <Link
                href={listHref("groups")}
                className="group flex items-center justify-between rounded-lg border border-[#0A3D45]/12 bg-[#0A3D45]/[0.03] px-4 py-5 transition hover:border-[#0A3D45]/25 hover:bg-[#0A3D45]/[0.06]"
              >
                <div>
                  <p className="flex items-center gap-2 font-[family-name:var(--font-display)] text-xl text-[#0A3D45]">
                    Groups
                    {friendGroupsUnread > 0 ? (
                      <span className="rounded-full bg-[#E85D4C] px-1.5 text-[11px] font-semibold leading-5 text-white">
                        {friendGroupsUnread > 99 ? "99+" : friendGroupsUnread}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-sm text-[#0A3D45]/55">
                    {friendGroups.length} conversation
                    {friendGroups.length === 1 ? "" : "s"} with friends
                  </p>
                </div>
                <span className="text-[#0A3D45]/40 transition group-hover:text-[#0A3D45]">
                  →
                </span>
              </Link>
              <Link
                href={listHref("workspace-groups")}
                className="group flex items-center justify-between rounded-lg border border-[#0A3D45]/12 bg-[#0A3D45]/[0.03] px-4 py-5 transition hover:border-[#0A3D45]/25 hover:bg-[#0A3D45]/[0.06]"
              >
                <div>
                  <p className="flex items-center gap-2 font-[family-name:var(--font-display)] text-xl text-[#0A3D45]">
                    Workspace groups
                    {workspaceGroupsUnread > 0 ? (
                      <span className="rounded-full bg-[#E85D4C] px-1.5 text-[11px] font-semibold leading-5 text-white">
                        {workspaceGroupsUnread > 99
                          ? "99+"
                          : workspaceGroupsUnread}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-sm text-[#0A3D45]/55">
                    {workspaceGroups.length} conversation
                    {workspaceGroups.length === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="text-[#0A3D45]/40 transition group-hover:text-[#0A3D45]">
                  →
                </span>
              </Link>
              <Link
                href={listHref("dms")}
                className="group flex items-center justify-between rounded-lg border border-[#0A3D45]/12 bg-[#0A3D45]/[0.03] px-4 py-5 transition hover:border-[#0A3D45]/25 hover:bg-[#0A3D45]/[0.06]"
              >
                <div>
                  <p className="flex items-center gap-2 font-[family-name:var(--font-display)] text-xl text-[#0A3D45]">
                    DMs
                    {dmsUnread > 0 ? (
                      <span className="rounded-full bg-[#E85D4C] px-1.5 text-[11px] font-semibold leading-5 text-white">
                        {dmsUnread > 99 ? "99+" : dmsUnread}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-sm text-[#0A3D45]/55">
                    {dms.length} conversation{dms.length === 1 ? "" : "s"}
                    {dmRequests.length > 0
                      ? ` · ${dmRequests.length} pending`
                      : ""}
                  </p>
                </div>
                <span className="text-[#0A3D45]/40 transition group-hover:text-[#0A3D45]">
                  →
                </span>
              </Link>
            </div>
          </>
        ) : null}

        {(tab === "dms" || tab === "groups" || tab === "workspace-groups") &&
        !active ? (
          <>
            <div className="flex items-center gap-3">
              <Link
                href="/app/chat"
                className="text-sm text-[#0A3D45]/60 hover:underline"
              >
                ← Back
              </Link>
            </div>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl text-[#0A3D45]">
              {listTitle}
            </h1>
            <ul className="mt-4 space-y-2">
              {listItems.map((g) => {
                const title =
                  tab === "dms" ? dmDisplayName(g.members, userId) : g.name;
                const last = g.messages[0];
                const unread = unreadCounts.get(g.id) ?? 0;
                return (
                  <li key={g.id}>
                    <div className="group relative flex items-stretch rounded-lg border border-[#0A3D45]/10 bg-[#0A3D45]/[0.02] transition hover:border-[#0A3D45]/20 hover:bg-[#0A3D45]/[0.05]">
                      <Link
                        href={threadHref(tab, g.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-semibold text-[#0A3D45]">
                              {title}
                            </span>
                            {unread > 0 ? (
                              <span className="rounded-full bg-[#E85D4C] px-1.5 text-[11px] font-semibold leading-5 text-white">
                                {unread > 99 ? "99+" : unread}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 truncate text-sm text-[#0A3D45]/55">
                            {last
                              ? `${last.sender.id === userId ? "You" : personLabel(last.sender)}: ${snippet(last.body)}`
                              : snippet(undefined)}
                          </p>
                        </div>
                      </Link>
                      <div className="flex items-center pr-2">
                        <ChatRowMenu
                          groupId={g.id}
                          isDirect={g.isDirect}
                          canDelete={canDeleteGroup(g)}
                          listTab={tab}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
              {listItems.length === 0 ? (
                <li className="text-sm text-[#0A3D45]/55">{listEmpty}</li>
              ) : null}
            </ul>
          </>
        ) : null}

        {active ? (
          <>
            <MarkChatSeen groupId={active.id} />
            <div className="flex shrink-0 items-start justify-between gap-3">
              <div>
                <Link
                  href={listHref(listKindForGroup(active))}
                  className="text-sm text-[#0A3D45]/60 hover:underline"
                >
                  ← Back
                </Link>
                <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[#0A3D45]">
                  {active.isDirect
                    ? dmDisplayName(active.members, userId)
                    : active.name}
                </h1>
                <p className="text-xs text-[#0A3D45]/55">
                  {active.members.map((m) => personLabel(m.user)).join(", ")}
                </p>
              </div>
              <ChatRowMenu
                groupId={active.id}
                isDirect={active.isDirect}
                canDelete={canDeleteGroup(active)}
                canEditMembers={!active.isDirect && canDeleteGroup(active)}
                listTab={listKindForGroup(active)}
                currentMembers={active.members.map((m) => ({
                  userId: m.user.id,
                  label: personLabel(m.user),
                }))}
                addCandidates={
                  active.isDirect
                    ? []
                    : active.workspaceId
                      ? (membersByWorkspace[active.workspaceId] ?? []).filter(
                          (c) =>
                            !active.members.some((m) => m.user.id === c.id),
                        )
                      : friendOptions.filter(
                          (c) =>
                            !active.members.some((m) => m.user.id === c.id),
                        )
                }
                addSearchPlaceholder={
                  active.workspaceId ? "Search members" : "Search friends"
                }
                addItemNoun={active.workspaceId ? "member" : "friend"}
              />
            </div>
            <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto">
              {threadMessages.map((msg) => (
                <div key={msg.id} className="text-sm">
                  <span className="font-semibold text-[#0A3D45]">
                    {personLabel(msg.sender)}
                  </span>{" "}
                  <span className="text-xs text-[#0A3D45]/45">
                    {format(msg.createdAt, "MMM d · HH:mm")}
                  </span>
                  <p className="text-[#0A3D45]/80">{msg.body}</p>
                </div>
              ))}
              {threadMessages.length === 0 ? (
                <p className="text-sm text-[#0A3D45]/55">No messages yet.</p>
              ) : null}
            </div>
            <div className="mt-3 shrink-0 border-t border-[#0A3D45]/10 bg-[var(--tide-panel-bg,inherit)] pt-3">
              <InlineActionForm
                className="flex gap-2"
                action={sendMessageAction}
                submitLabel="Send"
              >
                <input type="hidden" name="groupId" value={active.id} />
                <input
                  name="body"
                  required
                  placeholder="Write a message…"
                  className="tide-input flex-1"
                />
              </InlineActionForm>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
