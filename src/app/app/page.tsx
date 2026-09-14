import { redirect } from "next/navigation";
import { InlineActionForm } from "@/app/components/forms";
import { WorkspaceCardMenu } from "@/app/components/workspace-card-menu";
import { createWorkspaceAction } from "@/app/actions/workspaces";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";

export default async function AppHomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { createdAt: "desc" },
  });

  const workspaceIds = memberships.map((m) => m.workspaceId);
  const allMembers =
    workspaceIds.length > 0
      ? await prisma.membership.findMany({
          where: { workspaceId: { in: workspaceIds } },
          include: { user: true },
          orderBy: { createdAt: "asc" },
        })
      : [];

  const membersByWorkspace = new Map<
    string,
    {
      userId: string;
      role: string;
      username: string;
      nickname: string | null;
    }[]
  >();
  for (const m of allMembers) {
    const list = membersByWorkspace.get(m.workspaceId) ?? [];
    list.push({
      userId: m.userId,
      role: m.role,
      username: m.user.username,
      nickname: m.user.nickname,
    });
    membersByWorkspace.set(m.workspaceId, list);
  }

  const notifications = await prisma.notification.findMany({
    where: {
      userId: user.id,
      read: false,
      type: { notIn: ["CHAT_MESSAGE", "DM_REQUEST"] },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="animate-tide-rise">
          <h1 className="font-[family-name:var(--font-display)] text-4xl text-[#0A3D45] sm:text-5xl">
            Your workspaces
          </h1>
          <p className="mt-2 max-w-lg text-[#0A3D45]/70">
            Each workspace is its own tide pool — folders, tasks, and people with roles.
          </p>
        </div>
        <div className="tide-panel w-full max-w-sm p-5 animate-tide-rise-delay">
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[#0A3D45]">
            New workspace
          </h2>
          <InlineActionForm
            className="mt-3 flex flex-col gap-3"
            action={createWorkspaceAction}
            submitLabel="Create workspace"
          >
            <input
              name="name"
              required
              placeholder="Studio sprint"
              className="tide-input"
            />
          </InlineActionForm>
        </div>
      </div>

      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {memberships.length === 0 ? (
          <p className="text-[#0A3D45]/65 sm:col-span-2">
            No workspaces yet — create one or wait for an invite.
          </p>
        ) : (
          memberships.map((m, i) => {
            const isOwner = m.role === "OWNER";
            return (
              <div
                key={m.id}
                className="tide-panel relative p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/app/w/${m.workspaceId}`} className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-[family-name:var(--font-display)] text-2xl text-[#0A3D45]">
                        {m.workspace.name}
                      </p>
                      {isOwner ? (
                        <span className="rounded-md bg-[#0A3D45]/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#0A3D45]">
                          Owner
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm capitalize text-[#0A3D45]/60">
                      {m.role.toLowerCase()}
                    </p>
                  </Link>
                  <WorkspaceCardMenu
                    workspaceId={m.workspaceId}
                    workspaceName={m.workspace.name}
                    role={m.role}
                    members={membersByWorkspace.get(m.workspaceId) ?? []}
                  />
                </div>
              </div>
            );
          })
        )}
      </section>

      {notifications.length > 0 ? (
        <section className="mt-12">
          <div className="flex items-end justify-between gap-3">
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-[#0A3D45]">
              Incoming
            </h2>
            <Link
              href="/app/notifications"
              className="text-sm font-semibold text-[#0A3D45] underline-offset-2 hover:underline"
            >
              View all
            </Link>
          </div>
          <ul className="mt-4 space-y-2">
            {notifications.map((n) => (
              <li key={n.id} className="tide-panel px-4 py-3 text-sm">
                <Link href="/app/notifications" className="block">
                  <span className="font-semibold text-[#0A3D45]">{n.title}</span>
                  <span className="text-[#0A3D45]/70"> — {n.body}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
