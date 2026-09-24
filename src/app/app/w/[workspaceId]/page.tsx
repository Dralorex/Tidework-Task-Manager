import { redirect } from "next/navigation";
import Link from "next/link";
import { AppNav } from "@/app/components/app-nav";
import { InlineActionForm } from "@/app/components/forms";
import { WorkspacePulseStrip } from "@/app/components/workspace-pulse-strip";
import { WorkspaceSetupChecklist } from "@/app/components/workspace-setup-checklist";
import {
  WorkspaceTaskRow,
  type WorkspaceTaskRowData,
} from "@/app/components/workspace-task-row";
import {
  createFolderAction,
  createTaskAction,
} from "@/app/actions/tasks";
import { inviteMemberAction } from "@/app/actions/workspaces";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEditContent, canManagePeople } from "@/lib/permissions";
import { compareTasksByUrgency } from "@/lib/urgency";
import { searchRelevance } from "@/lib/utils";

function toRowData(
  task: {
    id: string;
    name: string;
    description: string;
    priority: WorkspaceTaskRowData["priority"];
    status: WorkspaceTaskRowData["status"];
    dueDate: Date | null;
    completionComment: string | null;
    assigneeId: string | null;
    folderId: string;
    assignee: { username: string } | null;
    folder: { name: string };
    tags: { tagId: string; tag: { name: string; isPublic: boolean } }[];
    checklistItems: { id: string; label: string; done: boolean }[];
    activities: { id: string; message: string; createdAt: Date; type: string }[];
  },
): WorkspaceTaskRowData {
  return {
    id: task.id,
    name: task.name,
    description: task.description,
    priority: task.priority,
    status: task.status,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    completionComment: task.completionComment,
    assigneeId: task.assigneeId,
    assigneeUsername: task.assignee?.username ?? null,
    folderId: task.folderId,
    folderName: task.folder.name,
    tags: task.tags.map((tt) => ({
      tagId: tt.tagId,
      name: tt.tag.name,
      isPublic: tt.tag.isPublic,
    })),
    checklist: task.checklistItems.map((c) => ({
      id: c.id,
      label: c.label,
      done: c.done,
    })),
    activities: task.activities.map((a) => ({
      id: a.id,
      message: a.message,
      createdAt: a.createdAt.toISOString(),
      type: a.type,
    })),
  };
}

const taskInclude = {
  assignee: true,
  folder: true,
  tags: { include: { tag: true } },
  checklistItems: { orderBy: { sortOrder: "asc" as const } },
  activities: { orderBy: { createdAt: "desc" as const }, take: 40 },
};

export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{
    folder?: string;
    q?: string;
    tag?: string;
    setup?: string;
    inbox?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { workspaceId } = await params;
  const sp = await searchParams;
  const showSetup = sp.setup === "1";
  const inbox =
    sp.inbox === "mine" ? "mine" : sp.inbox === "review" ? "review" : null;

  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  });
  if (!membership) redirect("/app");

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
  });

  const folders = await prisma.folder.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
  });

  const currentFolderId = inbox ? null : (sp.folder ?? folders[0]?.id ?? null);
  const currentFolder = currentFolderId
    ? (folders.find((f) => f.id === currentFolderId) ?? null)
    : null;

  const childFolders = currentFolder
    ? folders.filter((f) => f.parentId === currentFolder.id)
    : [];

  const canEdit = canEditContent(membership.role);
  const canInvite = canManagePeople(membership.role);
  const showPulse = canManagePeople(membership.role);

  const pendingInvites = canInvite
    ? await prisma.invite.findMany({
        where: { workspaceId, status: "PENDING" },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const allWorkspaceTasks = await prisma.task.findMany({
    where: { workspaceId },
    select: {
      id: true,
      status: true,
      dueDate: true,
      assigneeId: true,
    },
  });

  const now = new Date();
  const counts = showPulse
    ? {
        open: allWorkspaceTasks.filter((t) => t.status === "OPEN").length,
        claimed: allWorkspaceTasks.filter((t) => t.status === "CLAIMED").length,
        inReview: allWorkspaceTasks.filter((t) => t.status === "IN_REVIEW").length,
        overdue: allWorkspaceTasks.filter(
          (t) =>
            t.dueDate &&
            t.dueDate < now &&
            t.status !== "DONE",
        ).length,
        done: allWorkspaceTasks.filter((t) => t.status === "DONE").length,
      }
    : null;

  const myClaimedCount = allWorkspaceTasks.filter(
    (t) => t.assigneeId === user.id && t.status === "CLAIMED",
  ).length;
  const needsReviewCount = allWorkspaceTasks.filter(
    (t) => t.status === "IN_REVIEW",
  ).length;

  let tasksRaw =
    inbox === "mine"
      ? await prisma.task.findMany({
          where: {
            workspaceId,
            assigneeId: user.id,
            status: { in: ["CLAIMED", "IN_REVIEW"] },
          },
          include: taskInclude,
        })
      : inbox === "review"
        ? await prisma.task.findMany({
            where: { workspaceId, status: "IN_REVIEW" },
            include: taskInclude,
          })
        : currentFolder
          ? await prisma.task.findMany({
              where: { folderId: currentFolder.id },
              include: taskInclude,
            })
          : [];

  tasksRaw = tasksRaw
    .map((t) => ({
      ...t,
      tags: t.tags.filter(
        (tt) => tt.tag.isPublic || tt.tag.creatorId === user.id,
      ),
    }))
    .sort(compareTasksByUrgency);

  const q = sp.q?.trim() ?? "";
  const tagFilter = sp.tag?.trim().toLowerCase() ?? "";
  if (q || tagFilter) {
    tasksRaw = tasksRaw
      .map((t) => ({
        task: t,
        relevance: q ? searchRelevance(q, t.name) : 1,
      }))
      .filter(({ task, relevance }) => {
        if (q && relevance <= 0) return false;
        if (tagFilter) {
          const has = task.tags.some((tt) => tt.tag.name === tagFilter);
          if (!has) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          b.relevance - a.relevance || compareTasksByUrgency(a.task, b.task),
      )
      .map(({ task }) => task);
  }

  const tasks = tasksRaw.map(toRowData);

  const taskCount = allWorkspaceTasks.length;
  const memberCount = await prisma.membership.count({ where: { workspaceId } });
  const hasInviteActivity = pendingInvites.length > 0 || memberCount > 1;
  const rootFolderCount = folders.filter((f) => !f.parentId).length;
  const firstFolderId = folders[0]?.id ?? null;

  const sectionTitle =
    inbox === "mine"
      ? "My claimed"
      : inbox === "review"
        ? "Needs review"
        : currentFolder
          ? currentFolder.name
          : "Root";

  return (
    <div className="tide-wave-bg min-h-screen">
      <AppNav username={user.username} active="home" />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/app" className="text-sm text-[#0A3D45]/60 hover:underline">
              ← Workspaces
            </Link>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl text-[#0A3D45]">
              {workspace.name}
            </h1>
            <p className="text-sm capitalize text-[#0A3D45]/60">
              You’re {membership.role.toLowerCase()}
            </p>
          </div>

          <form className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap" action={`/app/w/${workspaceId}`} method="get">
            {currentFolder ? (
              <input type="hidden" name="folder" value={currentFolder.id} />
            ) : null}
            {inbox ? <input type="hidden" name="inbox" value={inbox} /> : null}
            <input
              name="q"
              defaultValue={q}
              placeholder="Search names…"
              className="tide-input min-h-11 min-w-0 sm:min-w-[12rem]"
            />
            <input
              name="tag"
              defaultValue={tagFilter}
              placeholder="Tag filter"
              className="tide-input min-h-11 w-full sm:w-32"
            />
            <button type="submit" className="tide-btn-secondary min-h-11 text-sm">
              Search
            </button>
          </form>
        </div>

        <WorkspaceSetupChecklist
          workspaceId={workspaceId}
          forceShow={showSetup}
          hasFolder={folders.length > 0}
          hasTask={taskCount > 0}
          hasInvite={hasInviteActivity}
          canInvite={canInvite}
          canEdit={canEdit}
          firstFolderId={firstFolderId}
        />

        <WorkspacePulseStrip
          workspaceId={workspaceId}
          counts={counts}
          canReview={canEdit}
          inbox={inbox}
          myClaimedCount={myClaimedCount}
          needsReviewCount={needsReviewCount}
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-[240px_1fr]">
          <aside className={`space-y-4 ${inbox ? "hidden lg:block" : ""}`}>
            <div className="tide-panel p-4">
              <h2 className="font-[family-name:var(--font-display)] text-lg text-[#0A3D45]">
                Folders
              </h2>
              {rootFolderCount === 0 ? (
                <p className="mt-3 text-sm text-[#0A3D45]/65">
                  Folders group kinds of work. Status (open / claimed / review / done) is handled
                  automatically on tasks.
                </p>
              ) : null}
              <ul className="mt-3 space-y-1 text-sm">
                <li>
                  <Link
                    href={`/app/w/${workspaceId}`}
                    className={
                      !currentFolder && !inbox
                        ? "font-semibold text-[#0A3D45]"
                        : "text-[#0A3D45]/70"
                    }
                  >
                    Root
                  </Link>
                </li>
                {folders
                  .filter((f) => !f.parentId)
                  .map((f) => (
                    <li key={f.id}>
                      <Link
                        href={`/app/w/${workspaceId}?folder=${f.id}`}
                        className={
                          currentFolder?.id === f.id
                            ? "font-semibold text-[#0A3D45]"
                            : "text-[#0A3D45]/70 hover:text-[#0A3D45]"
                        }
                      >
                        {f.name}
                      </Link>
                    </li>
                  ))}
              </ul>

              {canEdit ? (
                <InlineActionForm
                  className="mt-4 flex flex-col gap-2"
                  action={createFolderAction}
                  submitLabel="New folder"
                  submitClassName="w-full min-h-11"
                >
                  <input type="hidden" name="workspaceId" value={workspaceId} />
                  {currentFolder ? (
                    <input type="hidden" name="parentId" value={currentFolder.id} />
                  ) : null}
                  <input
                    name="name"
                    required
                    placeholder="e.g. General"
                    className="tide-input min-h-11 text-sm"
                  />
                </InlineActionForm>
              ) : null}
            </div>

            {canInvite ? (
              <div className="tide-panel p-4">
                <h2 className="font-[family-name:var(--font-display)] text-lg text-[#0A3D45]">
                  Invite
                </h2>
                <InlineActionForm
                  className="mt-3 flex flex-col gap-2"
                  action={inviteMemberAction}
                  submitLabel="Send invite"
                  submitClassName="w-full min-h-11"
                >
                  <input type="hidden" name="workspaceId" value={workspaceId} />
                  <input
                    name="target"
                    required
                    placeholder="Username or email"
                    className="tide-input min-h-11 text-sm"
                  />
                  <select name="role" className="tide-input min-h-11 text-sm" defaultValue="MEMBER">
                    <option value="ADMIN">Admin</option>
                    <option value="EDITOR">Editor</option>
                    <option value="MEMBER">Member</option>
                  </select>
                </InlineActionForm>
                {pendingInvites.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-xs text-[#0A3D45]/65">
                    {pendingInvites.map((inv) => (
                      <li key={inv.id}>
                        Pending: {inv.targetUsername ?? inv.targetEmail} ({inv.role})
                        <br />
                        <span className="break-all">/invite/{inv.token}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </aside>

          <section className="space-y-6">
            <div className="tide-panel p-5">
              <h2 className="font-[family-name:var(--font-display)] text-2xl text-[#0A3D45]">
                {sectionTitle}
              </h2>
              <p className="text-sm text-[#0A3D45]/60">
                {inbox === "mine"
                  ? "Tasks you’ve claimed across every folder."
                  : inbox === "review"
                    ? "Waiting on Editor+ approval across the workspace."
                    : "Subfolders and tasks. Urgency edge rises with priority and due dates."}
              </p>

              {!inbox && childFolders.length > 0 ? (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {childFolders.map((f) => (
                    <li key={f.id}>
                      <Link
                        href={`/app/w/${workspaceId}?folder=${f.id}`}
                        className="tide-btn-secondary min-h-10 text-sm"
                      >
                        {f.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}

              {!inbox && canEdit && currentFolder ? (
                <>
                  <InlineActionForm
                    className="mt-5 grid gap-2 sm:grid-cols-2"
                    action={createTaskAction}
                    submitLabel="Add task"
                    submitVariant="primary"
                    submitClassName="min-h-11 sm:col-span-2 sm:justify-self-start"
                  >
                    <input type="hidden" name="workspaceId" value={workspaceId} />
                    <input type="hidden" name="folderId" value={currentFolder.id} />
                    <input
                      name="name"
                      required
                      placeholder="Task name"
                      className="tide-input min-h-11"
                    />
                    <select
                      name="priority"
                      className="tide-input min-h-11"
                      defaultValue="MEDIUM"
                    >
                      <option value="CRITICAL">Critical</option>
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                    </select>
                    <input
                      name="description"
                      placeholder="Description"
                      className="tide-input min-h-11 sm:col-span-2"
                    />
                    <input name="dueDate" type="date" className="tide-input min-h-11" />
                  </InlineActionForm>
                  <p className="mt-2 text-xs text-[#0A3D45]/55">
                    Members claim tasks. Editors+ review when someone marks them complete.
                  </p>
                </>
              ) : null}

              {!inbox && !currentFolder && canEdit ? (
                <p className="mt-4 text-sm text-[#0A3D45]/65">
                  Create a folder (topic bucket, e.g. General) to start adding claimable tasks.
                  Status stays on the task — not the folder.
                </p>
              ) : null}
            </div>

            <ul className="space-y-3">
              {tasks.map((task) => (
                <WorkspaceTaskRow
                  key={task.id}
                  task={task}
                  workspaceId={workspaceId}
                  userId={user.id}
                  canEdit={canEdit}
                  showFolder={Boolean(inbox)}
                />
              ))}
              {tasks.length === 0 ? (
                <li className="tide-panel p-4 text-sm text-[#0A3D45]/70">
                  {inbox === "mine"
                    ? "Nothing claimed right now. Open a folder and pick up a task."
                    : inbox === "review"
                      ? "No tasks waiting for review."
                      : currentFolder
                        ? "Add a task people can claim. When they’re done, it goes to review — status moves on the task automatically."
                        : "Pick a folder to see tasks, or use My claimed / Needs review above."}
                </li>
              ) : null}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
