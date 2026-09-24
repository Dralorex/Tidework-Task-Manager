import { redirect } from "next/navigation";
import { InlineActionForm } from "@/app/components/forms";
import {
  ChatComposer,
  ChatMessageBody,
} from "@/app/components/chat-composer";
import { ChatPresenceStrip } from "@/app/components/chat-presence";
import {
  createGroupChatAction,
  requestWorkspaceDmAction,
  respondDmRequestAction,
} from "@/app/actions/social";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManagePeople } from "@/lib/permissions";
import {
  parseTaskLinkIds,
  toTaskOption,
  type TaskLinkInfo,
} from "@/lib/task-links";
import { format } from "date-fns";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;

  const memberships = await prisma.chatMember.findMany({
    where: { userId: user.id },
    include: {
      group: {
        include: {
          members: { include: { user: true } },
          messages: {
            orderBy: { createdAt: "asc" },
            take: 80,
            include: { sender: true },
          },
        },
      },
    },
  });

  const groups = memberships.map((m) => m.group);
  const activeId = sp.group ?? groups[0]?.id;
  const active = groups.find((g) => g.id === activeId) ?? null;
  const myMembership = active
    ? memberships.find((m) => m.groupId === active.id)
    : null;

  const dmRequests = await prisma.dmRequest.findMany({
    where: { toUserId: user.id, status: "PENDING" },
    include: { fromUser: true },
  });

  const adminWorkspaces = await prisma.membership.findMany({
    where: {
      userId: user.id,
      role: { in: ["OWNER", "ADMIN"] },
      workspace: { archivedAt: null },
    },
    include: { workspace: true },
  });

  const allWorkspaces = await prisma.membership.findMany({
    where: { userId: user.id, workspace: { archivedAt: null } },
    include: { workspace: true },
  });

  let canElevatedMentions = false;
  if (active?.workspaceId) {
    const ws = await prisma.membership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: active.workspaceId,
          userId: user.id,
        },
      },
    });
    canElevatedMentions = Boolean(ws && canManagePeople(ws.role));
  } else if (active && !active.isDirect) {
    canElevatedMentions = true;
  }

  const mentionOptions = active
    ? [
        ...active.members
          .filter((m) => m.userId !== user.id)
          .map((m) => ({
            kind: "user" as const,
            label: `@${m.user.username}`,
            insert: `@${m.user.username}`,
          })),
        ...(canElevatedMentions && !active.isDirect
          ? [
              {
                kind: "everyone" as const,
                label: "@everyone",
                insert: "@everyone",
              },
            ]
          : []),
        ...(canElevatedMentions && active.workspaceId
          ? (["Owner", "Admin", "Editor", "Member"] as const).map((role) => ({
              kind: "role" as const,
              label: `@${role}`,
              insert: `@${role}`,
            }))
          : []),
      ]
    : [];

  const linkableWorkspaceIds = active?.workspaceId
    ? [active.workspaceId]
    : allWorkspaces.map((m) => m.workspaceId);

  const linkableTasks =
    linkableWorkspaceIds.length > 0
      ? await prisma.task.findMany({
          where: {
            workspaceId: { in: linkableWorkspaceIds },
            folder: { archivedAt: null },
            workspace: { archivedAt: null },
          },
          include: { workspace: true },
          orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
          take: 50,
        })
      : [];

  const taskOptions = linkableTasks.map(toTaskOption);

  const referencedIds = new Set<string>();
  if (active) {
    for (const msg of active.messages) {
      for (const id of parseTaskLinkIds(msg.body)) referencedIds.add(id);
    }
  }
  for (const t of linkableTasks) referencedIds.add(t.id);

  const referencedTasks =
    referencedIds.size > 0
      ? await prisma.task.findMany({
          where: { id: { in: [...referencedIds] } },
          select: {
            id: true,
            name: true,
            folderId: true,
            workspaceId: true,
          },
        })
      : [];

  const taskMap: Record<string, TaskLinkInfo> = {};
  for (const t of referencedTasks) {
    taskMap[t.id] = {
      id: t.id,
      name: t.name,
      href: `/app/w/${t.workspaceId}?folder=${t.folderId}`,
    };
  }

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-4">
        <div className="tide-panel p-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[#0A3D45]">
            Chats
          </h2>
          <ul className="mt-3 space-y-1 text-sm">
            {groups.map((g) => (
              <li key={g.id}>
                <a
                  href={`/app/chat?group=${g.id}`}
                  className={
                    active?.id === g.id
                      ? "font-semibold text-[#0A3D45]"
                      : "text-[#0A3D45]/70"
                  }
                >
                  {g.isDirect ? "DM · " : ""}
                  {g.name}
                </a>
              </li>
            ))}
            {groups.length === 0 ? (
              <li className="text-[#0A3D45]/55">No chats yet.</li>
            ) : null}
          </ul>
        </div>

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

        <div className="tide-panel p-4">
          <h3 className="font-semibold text-[#0A3D45]">Message someone</h3>
          <p className="mt-1 text-xs text-[#0A3D45]/60">
            Friends chat freely. Same workspace (not friends): first message waits for
            accept.
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
          <div className="tide-panel p-4">
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
      </aside>

      <section className="tide-panel flex min-h-[28rem] flex-col p-5">
        {active && myMembership ? (
          <>
            <h1 className="font-[family-name:var(--font-display)] text-2xl text-[#0A3D45]">
              {active.name}
            </h1>
            <ChatPresenceStrip
              groupId={active.id}
              memberUsernames={active.members.map((m) => ({
                userId: m.userId,
                username: m.user.username,
              }))}
            />
            <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
              {active.messages.map((msg) => (
                <div key={msg.id} className="text-sm">
                  <span className="font-semibold text-[#0A3D45]">
                    @{msg.sender.username}
                  </span>{" "}
                  <span className="text-xs text-[#0A3D45]/45">
                    {format(msg.createdAt, "MMM d · HH:mm")}
                  </span>
                  <ChatMessageBody body={msg.body} taskMap={taskMap} />
                </div>
              ))}
            </div>
            <ChatComposer
              groupId={active.id}
              options={mentionOptions}
              taskOptions={taskOptions}
              notifyMode={myMembership.notifyMode}
            />
          </>
        ) : (
          <p className="text-[#0A3D45]/60">Pick or start a chat.</p>
        )}
      </section>
    </main>
  );
}
