import { redirect } from "next/navigation";
import { AppNav } from "@/app/components/app-nav";
import { InlineActionForm } from "@/app/components/forms";
import {
  createGroupChatAction,
  requestWorkspaceDmAction,
  respondDmRequestAction,
  sendMessageAction,
} from "@/app/actions/social";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
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

  return (
    <div className="tide-wave-bg min-h-screen">
      <AppNav username={user.username} active="chat" />
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
                      <form action={respondDmRequestAction.bind(null, r.id, true)}>
                        <button type="submit" className="tide-btn-primary text-xs">
                          Accept
                        </button>
                      </form>
                      <form action={respondDmRequestAction.bind(null, r.id, false)}>
                        <button type="submit" className="tide-btn-secondary text-xs">
                          Decline
                        </button>
                      </form>
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
              action={async (fd) => {
                "use server";
                return requestWorkspaceDmAction(String(fd.get("workspaceId") ?? ""), fd);
              }}
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
                action={async (fd) => {
                  "use server";
                  return createGroupChatAction(String(fd.get("workspaceId") ?? ""), fd);
                }}
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
          {active ? (
            <>
              <h1 className="font-[family-name:var(--font-display)] text-2xl text-[#0A3D45]">
                {active.name}
              </h1>
              <p className="text-xs text-[#0A3D45]/55">
                {active.members.map((m) => m.user.username).join(", ")}
              </p>
              <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
                {active.messages.map((msg) => (
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
              </div>
              <InlineActionForm
                className="mt-4 flex gap-2"
                action={sendMessageAction.bind(null, active.id)}
                submitLabel="Send"
              >
                <input
                  name="body"
                  required
                  placeholder="Write a message…"
                  className="tide-input flex-1"
                />
              </InlineActionForm>
            </>
          ) : (
            <p className="text-[#0A3D45]/60">Pick or start a chat.</p>
          )}
        </section>
      </main>
    </div>
  );
}
