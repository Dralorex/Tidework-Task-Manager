import Link from "next/link";
import { format } from "date-fns";
import { InlineActionForm } from "@/app/components/forms";
import { ChatRowMenu } from "@/app/components/chat-row-menu";
import { MarkChatSeen } from "@/app/components/mark-chat-seen";
import {
  createGroupChatAction,
  requestWorkspaceDmAction,
  respondDmRequestAction,
  sendMessageAction,
} from "@/app/actions/social";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Tab = "hub" | "dms" | "groups";

function dmDisplayName(
  members: { user: { id: string; username: string } }[],
  userId: string,
) {
  const other = members.find((m) => m.user.id !== userId)?.user;
  return other ? `@${other.username}` : "Direct message";
}

function snippet(body: string | undefined) {
  if (!body) return "No messages yet";
  const trimmed = body.trim();
  return trimmed.length > 72 ? `${trimmed.slice(0, 72)}…` : trimmed;
}

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; tab?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const userId = user.id;

  const tabParam = sp.tab === "dms" || sp.tab === "groups" ? sp.tab : null;
  const groupId = sp.group ?? null;

  let tab: Tab = "hub";
  if (groupId || tabParam) {
    tab = tabParam ?? "hub";
  }

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
  const dms = groups
    .filter((g) => g.isDirect)
    .sort((a, b) => {
      const aAt = a.messages[0]?.createdAt?.getTime() ?? 0;
      const bAt = b.messages[0]?.createdAt?.getTime() ?? 0;
      return bAt - aAt;
    });
  const groupChats = groups
    .filter((g) => !g.isDirect)
    .sort((a, b) => {
      const aAt = a.messages[0]?.createdAt?.getTime() ?? 0;
      const bAt = b.messages[0]?.createdAt?.getTime() ?? 0;
      return bAt - aAt;
    });

  // Infer tab from opened group when not specified
  if (groupId && !tabParam) {
    const g = groups.find((x) => x.id === groupId);
    tab = g?.isDirect ? "dms" : "groups";
  } else if (tabParam) {
    tab = tabParam;
  }

  const active =
    groupId && (tab === "dms" || tab === "groups")
      ? groups.find((g) => g.id === groupId) ?? null
      : null;

  // Full message history for the open thread
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

  function canDeleteGroup(g: (typeof groups)[number]) {
    if (g.isDirect) return false;
    if (g.createdById === userId) return true;
    return Boolean(g.workspaceId && adminWorkspaceIds.has(g.workspaceId));
  }

  function listHref(kind: "dms" | "groups") {
    return `/app/chat?tab=${kind}`;
  }

  function threadHref(kind: "dms" | "groups", id: string) {
    return `/app/chat?tab=${kind}&group=${id}`;
  }

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
                    <span className="font-medium">@{r.fromUser.username}</span>:{" "}
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

        <div className="tide-panel space-y-6 p-4">
          <div>
            <h3 className="font-semibold text-[#0A3D45]">Message someone</h3>
            <p className="mt-1 text-xs text-[#0A3D45]/60">
              Friends chat freely. Same workspace (not friends): first message waits
              for accept.
            </p>
            <InlineActionForm
              className="mt-3 flex flex-col gap-2"
              action={requestWorkspaceDmAction}
              submitLabel="Send"
            >
              <select name="workspaceId" className="tide-input text-sm" required>
                {allWorkspaces.map((m) => (
                  <option key={m.workspaceId} value={m.workspaceId}>
                    {m.workspace.name}
                  </option>
                ))}
              </select>
              <input
                name="username"
                required
                placeholder="Username"
                className="tide-input text-sm"
              />
              <input
                name="message"
                required
                placeholder="First message"
                className="tide-input text-sm"
              />
            </InlineActionForm>
          </div>

          {adminWorkspaces.length > 0 ? (
            <div className="border-t border-[#0A3D45]/10 pt-5">
              <h3 className="font-semibold text-[#0A3D45]">New group (Admin+)</h3>
              <InlineActionForm
                className="mt-3 flex flex-col gap-2"
                action={createGroupChatAction}
                submitLabel="Create group"
              >
                <select name="workspaceId" className="tide-input text-sm" required>
                  {adminWorkspaces.map((m) => (
                    <option key={m.workspaceId} value={m.workspaceId}>
                      {m.workspace.name}
                    </option>
                  ))}
                </select>
                <input
                  name="name"
                  required
                  placeholder="Group name"
                  className="tide-input text-sm"
                />
                <input
                  name="members"
                  placeholder="usernames, comma-separated"
                  className="tide-input text-sm"
                />
              </InlineActionForm>
            </div>
          ) : null}
        </div>
      </aside>

      <section className="tide-panel flex min-h-[28rem] flex-col p-5">
        {tab === "hub" && !active ? (
          <>
            <h1 className="font-[family-name:var(--font-display)] text-2xl text-[#0A3D45]">
              Chat
            </h1>
            <p className="mt-1 text-sm text-[#0A3D45]/60">
              Choose Groups or DMs to browse conversations.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <Link
                href={listHref("groups")}
                className="group flex items-center justify-between rounded-lg border border-[#0A3D45]/12 bg-[#0A3D45]/[0.03] px-4 py-5 transition hover:border-[#0A3D45]/25 hover:bg-[#0A3D45]/[0.06]"
              >
                <div>
                  <p className="font-[family-name:var(--font-display)] text-xl text-[#0A3D45]">
                    Groups
                  </p>
                  <p className="mt-1 text-sm text-[#0A3D45]/55">
                    {groupChats.length} conversation
                    {groupChats.length === 1 ? "" : "s"}
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
                  <p className="font-[family-name:var(--font-display)] text-xl text-[#0A3D45]">
                    DMs
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

        {(tab === "dms" || tab === "groups") && !active ? (
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
              {tab === "dms" ? "DMs" : "Groups"}
            </h1>
            <ul className="mt-4 space-y-2">
              {(tab === "dms" ? dms : groupChats).map((g) => {
                const title =
                  tab === "dms"
                    ? dmDisplayName(g.members, user.id)
                    : g.name;
                const last = g.messages[0];
                const unread = unreadCounts.get(g.id) ?? 0;
                return (
                  <li key={g.id}>
                    <div className="group relative flex items-stretch overflow-hidden rounded-lg border border-[#0A3D45]/10 bg-[#0A3D45]/[0.02] transition hover:border-[#0A3D45]/20 hover:bg-[#0A3D45]/[0.05]">
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
                              ? `${last.sender.id === user.id ? "You" : `@${last.sender.username}`}: ${snippet(last.body)}`
                              : snippet(undefined)}
                          </p>
                        </div>
                      </Link>
                      <div className="flex items-center pr-2">
                        <ChatRowMenu
                          groupId={g.id}
                          isDirect={g.isDirect}
                          canDelete={canDeleteGroup(g)}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
              {(tab === "dms" ? dms : groupChats).length === 0 ? (
                <li className="text-sm text-[#0A3D45]/55">
                  {tab === "dms"
                    ? "No direct messages yet. Message someone from the sidebar."
                    : "No groups yet."}
                </li>
              ) : null}
            </ul>
          </>
        ) : null}

        {active ? (
          <>
            <MarkChatSeen groupId={active.id} />
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link
                  href={listHref(active.isDirect ? "dms" : "groups")}
                  className="text-sm text-[#0A3D45]/60 hover:underline"
                >
                  ← Back
                </Link>
                <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[#0A3D45]">
                  {active.isDirect
                    ? dmDisplayName(active.members, user.id)
                    : active.name}
                </h1>
                <p className="text-xs text-[#0A3D45]/55">
                  {active.members.map((m) => m.user.username).join(", ")}
                </p>
              </div>
              <ChatRowMenu
                groupId={active.id}
                isDirect={active.isDirect}
                canDelete={canDeleteGroup(active)}
              />
            </div>
            <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
              {threadMessages.map((msg) => (
                <div key={msg.id} className="text-sm">
                  <span className="font-semibold text-[#0A3D45]">
                    @{msg.sender.username}
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
            <InlineActionForm
              className="mt-4 flex gap-2"
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
          </>
        ) : null}
      </section>
    </main>
  );
}
