import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { AppNav } from "@/app/components/app-nav";
import { InlineActionForm } from "@/app/components/forms";
import { PriorityBadge, TaskUrgencyEdge } from "@/app/components/task-ui";
import {
  addPrivateTagAction,
  addPublicTagAction,
  claimTaskAction,
  completeTaskAction,
  createFolderAction,
  createTaskAction,
  reviewTaskAction,
} from "@/app/actions/tasks";
import { inviteMemberAction } from "@/app/actions/workspaces";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEditContent, canManagePeople } from "@/lib/permissions";
import { compareTasksByUrgency } from "@/lib/urgency";
import { searchRelevance } from "@/lib/utils";

export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ folder?: string; q?: string; tag?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { workspaceId } = await params;
  const sp = await searchParams;

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

  const currentFolderId = sp.folder ?? folders[0]?.id ?? null;
  const currentFolder = currentFolderId
    ? folders.find((f) => f.id === currentFolderId) ?? null
    : null;

  const childFolders = folders.filter((f) => f.parentId === (currentFolder?.id ?? null));

  let tasks = currentFolder
    ? await prisma.task.findMany({
        where: { folderId: currentFolder.id },
        include: {
          assignee: true,
          tags: { include: { tag: true } },
        },
      })
    : [];

  tasks = tasks
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
    tasks = tasks
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
      .sort((a, b) => b.relevance - a.relevance || compareTasksByUrgency(a.task, b.task))
      .map(({ task }) => task);
  }

  const canEdit = canEditContent(membership.role);
  const canInvite = canManagePeople(membership.role);

  const pendingInvites = canInvite
    ? await prisma.invite.findMany({
        where: { workspaceId, status: "PENDING" },
        orderBy: { createdAt: "desc" },
      })
    : [];

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

          <form className="flex flex-wrap gap-2" action={`/app/w/${workspaceId}`} method="get">
            {currentFolder ? (
              <input type="hidden" name="folder" value={currentFolder.id} />
            ) : null}
            <input
              name="q"
              defaultValue={q}
              placeholder="Search names…"
              className="tide-input min-w-[12rem]"
            />
            <input
              name="tag"
              defaultValue={tagFilter}
              placeholder="Tag filter"
              className="tide-input w-32"
            />
            <button type="submit" className="tide-btn-secondary text-sm">
              Search
            </button>
          </form>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[240px_1fr]">
          <aside className="space-y-4">
            <div className="tide-panel p-4">
              <h2 className="font-[family-name:var(--font-display)] text-lg text-[#0A3D45]">
                Folders
              </h2>
              <ul className="mt-3 space-y-1 text-sm">
                <li>
                  <Link
                    href={`/app/w/${workspaceId}`}
                    className={!currentFolder ? "font-semibold text-[#0A3D45]" : "text-[#0A3D45]/70"}
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
                  action={(fd) =>
                    createFolderAction(workspaceId, currentFolder?.id ?? null, fd)
                  }
                  submitLabel="New folder"
                >
                  <input
                    name="name"
                    required
                    placeholder="Folder name"
                    className="tide-input text-sm"
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
                  action={(fd) => inviteMemberAction(workspaceId, fd)}
                  submitLabel="Send invite"
                >
                  <input
                    name="target"
                    required
                    placeholder="Username or email"
                    className="tide-input text-sm"
                  />
                  <select name="role" className="tide-input text-sm" defaultValue="MEMBER">
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
                {currentFolder ? currentFolder.name : "Root"}
              </h2>
              <p className="text-sm text-[#0A3D45]/60">
                Subfolders and tasks. Urgency edge rises with priority and due dates.
              </p>

              {childFolders.length > 0 ? (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {childFolders.map((f) => (
                    <li key={f.id}>
                      <Link
                        href={`/app/w/${workspaceId}?folder=${f.id}`}
                        className="tide-btn-secondary text-sm"
                      >
                        {f.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}

              {canEdit && currentFolder ? (
                <InlineActionForm
                  className="mt-5 grid gap-2 sm:grid-cols-2"
                  action={(fd) => createTaskAction(workspaceId, currentFolder.id, fd)}
                  submitLabel="Add task"
                >
                  <input name="name" required placeholder="Task name" className="tide-input" />
                  <select name="priority" className="tide-input" defaultValue="MEDIUM">
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                  <input
                    name="description"
                    placeholder="Description"
                    className="tide-input sm:col-span-2"
                  />
                  <input name="dueDate" type="date" className="tide-input" />
                </InlineActionForm>
              ) : null}

              {!currentFolder && canEdit ? (
                <p className="mt-4 text-sm text-[#0A3D45]/65">
                  Create a folder (name required) to start adding tasks inside it.
                </p>
              ) : null}
            </div>

            <ul className="space-y-3">
              {tasks.map((task) => (
                <li key={task.id} className="tide-panel relative overflow-hidden p-4 pl-5">
                  <TaskUrgencyEdge priority={task.priority} dueDate={task.dueDate} />
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-[#0A3D45]">{task.name}</h3>
                        <PriorityBadge priority={task.priority} />
                        <span className="text-xs uppercase tracking-wide text-[#0A3D45]/50">
                          {task.status.replace("_", " ")}
                        </span>
                      </div>
                      {task.description ? (
                        <p className="mt-1 text-sm text-[#0A3D45]/70">{task.description}</p>
                      ) : null}
                      <p className="mt-2 text-xs text-[#0A3D45]/55">
                        {task.dueDate
                          ? `Due ${format(task.dueDate, "MMM d, yyyy")}`
                          : "No due date"}
                        {task.assignee
                          ? ` · claimed by @${task.assignee.username}`
                          : " · unclaimed"}
                      </p>
                      {task.completionComment ? (
                        <p className="mt-1 text-xs italic text-[#0A3D45]/65">
                          Review note: {task.completionComment}
                        </p>
                      ) : null}
                      {task.tags.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {task.tags.map((tt) => (
                            <span
                              key={tt.tagId}
                              className="rounded-md bg-[#1a7a82]/10 px-2 py-0.5 text-xs text-[#0A3D45]"
                            >
                              #{tt.tag.name}
                              {!tt.tag.isPublic ? " (private)" : ""}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-col items-stretch gap-2">
                      {task.status === "OPEN" ||
                      (task.status === "CLAIMED" && !task.assigneeId) ? (
                        <form
                          action={async () => { await claimTaskAction(workspaceId, task.id); }}
                        >
                          <button type="submit" className="tide-btn-primary w-full text-sm">
                            Pick up
                          </button>
                        </form>
                      ) : null}

                      {task.assigneeId === user.id &&
                      (task.status === "CLAIMED" || task.status === "OPEN") ? (
                        <InlineActionForm
                          action={(fd) => completeTaskAction(workspaceId, task.id, fd)}
                          submitLabel="Ready for review"
                        >
                          <input
                            name="comment"
                            required
                            placeholder="What did you complete?"
                            className="tide-input text-sm"
                          />
                        </InlineActionForm>
                      ) : null}

                      {task.status === "IN_REVIEW" && canEdit ? (
                        <div className="flex gap-2">
                          <form
                            action={async () => {
                              await reviewTaskAction(workspaceId, task.id, "approve");
                            }}
                          >
                            <button type="submit" className="tide-btn-primary text-sm">
                              Approve
                            </button>
                          </form>
                          <form
                            action={async () => {
                              await reviewTaskAction(workspaceId, task.id, "reopen");
                            }}
                          >
                            <button type="submit" className="tide-btn-secondary text-sm">
                              Send back
                            </button>
                          </form>
                        </div>
                      ) : null}

                      {task.assigneeId === user.id ? (
                        <InlineActionForm
                          action={(fd) => addPrivateTagAction(workspaceId, task.id, fd)}
                          submitLabel="Private tag"
                        >
                          <input
                            name="name"
                            required
                            placeholder="my-focus"
                            className="tide-input text-sm"
                          />
                        </InlineActionForm>
                      ) : null}

                      {canEdit ? (
                        <InlineActionForm
                          action={(fd) => addPublicTagAction(workspaceId, task.id, fd)}
                          submitLabel="Public tag"
                        >
                          <input
                            name="name"
                            required
                            placeholder="design"
                            className="tide-input text-sm"
                          />
                        </InlineActionForm>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
              {currentFolder && tasks.length === 0 ? (
                <li className="text-sm text-[#0A3D45]/60">No tasks here yet.</li>
              ) : null}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
