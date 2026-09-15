import { redirect } from "next/navigation";
import Link from "next/link";
import { InlineActionForm } from "@/app/components/forms";
import { FolderActions } from "@/app/components/folder-actions";
import { WorkspaceTaskRow } from "@/app/components/workspace-task-row";
import {
  createFolderAction,
  createTaskAction,
} from "@/app/actions/tasks";
import { inviteMemberAction } from "@/app/actions/workspaces";
import { FriendInvitePicker } from "@/app/components/friend-invite-picker";
import { PendingInvitesDropdown } from "@/app/components/pending-invites-dropdown";
import { ChatSidebarSection } from "@/app/components/chat-sidebar-section";
import { WorkspaceMembersPanel } from "@/app/components/workspace-members-panel";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computeFolderTaskCounts } from "@/lib/folder-counts";
import { canEditContent, canManagePeople } from "@/lib/permissions";
import { compareTasksByUrgency } from "@/lib/urgency";
import { personLabel, searchRelevance } from "@/lib/utils";

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

  const taskCountRows = await prisma.task.groupBy({
    by: ["folderId"],
    where: {
      workspaceId,
      status: "OPEN",
      assigneeId: null,
    },
    _count: { _all: true },
  });
  const directCounts = new Map(
    taskCountRows.map((r) => [r.folderId, r._count._all]),
  );
  const folderCounts = computeFolderTaskCounts(folders, directCounts);
  const allTasksCount = [...directCounts.values()].reduce((a, b) => a + b, 0);

  // All Tasks = no folder query param. Show all tasks by urgency.
  const isRoot = !sp.folder;
  const currentFolderId = sp.folder ?? null;
  const currentFolder = currentFolderId
    ? folders.find((f) => f.id === currentFolderId) ?? null
    : null;

  if (currentFolderId && !currentFolder) {
    redirect(`/app/w/${workspaceId}`);
  }

  const childFolders = folders.filter(
    (f) => f.parentId === (currentFolder?.id ?? null),
  );

  const parentFolder = currentFolder?.parentId
    ? folders.find((f) => f.id === currentFolder.parentId) ?? null
    : null;

  const backHref = currentFolder
    ? parentFolder
      ? `/app/w/${workspaceId}?folder=${parentFolder.id}`
      : `/app/w/${workspaceId}`
    : null;
  const backLabel = currentFolder
    ? parentFolder
      ? parentFolder.name
      : "All Tasks"
    : null;

  let tasks = isRoot
    ? await prisma.task.findMany({
        where: { workspaceId },
        include: {
          assignee: true,
          folder: true,
          lastUnclaimedBy: true,
          tags: { include: { tag: true } },
        },
      })
    : currentFolder
      ? await prisma.task.findMany({
          where: { folderId: currentFolder.id },
          include: {
            assignee: true,
            folder: true,
            lastUnclaimedBy: true,
            tags: { include: { tag: true } },
          },
        })
      : [];

  tasks = tasks
    .map((t) => ({
      ...t,
      tags: t.tags.filter(
        (tt) =>
          tt.tag.isPublic ||
          (tt.tag.creatorId === user.id && t.assigneeId === user.id),
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

  const workspaceMembers = await prisma.membership.findMany({
    where: { workspaceId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  const [acceptedFriendships, pendingFriendships] = await Promise.all([
    prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: user.id }, { addresseeId: user.id }],
      },
      include: { requester: true, addressee: true },
    }),
    prisma.friendship.findMany({
      where: {
        status: "PENDING",
        OR: [{ requesterId: user.id }, { addresseeId: user.id }],
      },
    }),
  ]);

  const friendIds = new Set(
    acceptedFriendships.map((row) =>
      row.requesterId === user.id ? row.addresseeId : row.requesterId,
    ),
  );
  const pendingFriendIds = new Set(
    pendingFriendships.flatMap((row) => [row.requesterId, row.addresseeId]),
  );

  const inviteFriends = canInvite
    ? acceptedFriendships.map((row) => {
        const friend =
          row.requesterId === user.id ? row.addressee : row.requester;
        return {
          id: friend.id,
          username: friend.username,
          label: personLabel(friend),
        };
      })
    : [];

  const memberRows = workspaceMembers.map((m) => ({
    userId: m.userId,
    username: m.user.username,
    label: personLabel(m.user),
    role: m.role,
    isSelf: m.userId === user.id,
    isFriend: friendIds.has(m.userId),
    requestPending: pendingFriendIds.has(m.userId),
  }));

  return (
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
                    className={`inline-flex items-center gap-1.5 ${
                      !currentFolder
                        ? "font-semibold text-[#0A3D45]"
                        : "text-[#0A3D45]/70"
                    }`}
                  >
                    All Tasks
                    <span className="rounded-md bg-[#0A3D45]/8 px-1.5 text-[11px] font-semibold tabular-nums text-[#0A3D45]/70">
                      {allTasksCount}
                    </span>
                  </Link>
                </li>
                {folders
                  .filter((f) => !f.parentId)
                  .map((f) => (
                    <li key={f.id}>
                      <div className="group flex items-center justify-between gap-1">
                        <Link
                          href={`/app/w/${workspaceId}?folder=${f.id}`}
                          className={`inline-flex min-w-0 items-center gap-1.5 ${
                            currentFolder?.id === f.id
                              ? "font-semibold text-[#0A3D45]"
                              : "text-[#0A3D45]/70 hover:text-[#0A3D45]"
                          }`}
                        >
                          <span className="truncate">{f.name}</span>
                          <span className="rounded-md bg-[#0A3D45]/8 px-1.5 text-[11px] font-semibold tabular-nums text-[#0A3D45]/70">
                            {folderCounts.get(f.id) ?? 0}
                          </span>
                        </Link>
                        {canEdit ? (
                          <FolderActions
                            workspaceId={workspaceId}
                            folderId={f.id}
                            folderName={f.name}
                          />
                        ) : null}
                      </div>
                    </li>
                  ))}
              </ul>

              {canEdit ? (
                <div className="mt-4">
                  <ChatSidebarSection
                    title="New folder"
                    description={
                      currentFolder
                        ? `Create a subfolder inside “${currentFolder.name}”.`
                        : "Create a folder at the workspace root."
                    }
                  >
                    <InlineActionForm
                      className="flex flex-col gap-2"
                      action={createFolderAction}
                      submitLabel="Create folder"
                    >
                      <input type="hidden" name="workspaceId" value={workspaceId} />
                      {currentFolder ? (
                        <input
                          type="hidden"
                          name="parentId"
                          value={currentFolder.id}
                        />
                      ) : null}
                      <input
                        name="name"
                        required
                        placeholder="Folder name"
                        className="tide-input text-sm"
                      />
                    </InlineActionForm>
                  </ChatSidebarSection>
                </div>
              ) : null}
            </div>

            {canInvite ? (
              <div className="tide-panel p-4">
                <ChatSidebarSection
                  title="Invite"
                  description="Invite a friend by username, or type an email. They’ll get a link to join this workspace."
                >
                  <InlineActionForm
                    className="flex flex-col gap-2"
                    action={inviteMemberAction}
                    submitLabel="Send invite"
                  >
                    <input type="hidden" name="workspaceId" value={workspaceId} />
                    <FriendInvitePicker friends={inviteFriends} targetName="target" />
                    <select name="role" className="tide-input text-sm" defaultValue="MEMBER">
                      <option value="ADMIN">Admin</option>
                      <option value="EDITOR">Editor</option>
                      <option value="MEMBER">Member</option>
                    </select>
                  </InlineActionForm>
                  <PendingInvitesDropdown
                    invites={pendingInvites.map((inv) => ({
                      id: inv.id,
                      label: inv.targetUsername ?? inv.targetEmail ?? "invite",
                      role: inv.role,
                      token: inv.token,
                    }))}
                  />
                </ChatSidebarSection>
              </div>
            ) : null}

            <WorkspaceMembersPanel
              workspaceId={workspaceId}
              members={memberRows}
              viewerRole={membership.role}
            />
          </aside>

          <section className="space-y-6">
            <div className="tide-panel p-5">
              {backHref && backLabel ? (
                <Link
                  href={backHref}
                  className="text-sm text-[#0A3D45]/60 hover:underline"
                >
                  ← {backLabel}
                </Link>
              ) : null}
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-[family-name:var(--font-display)] text-2xl text-[#0A3D45]">
                  {currentFolder ? currentFolder.name : "All Tasks"}
                </h2>
                {canEdit && currentFolder ? (
                  <FolderActions
                    workspaceId={workspaceId}
                    folderId={currentFolder.id}
                    folderName={currentFolder.name}
                  />
                ) : null}
              </div>
              <p className="text-sm text-[#0A3D45]/60">
                {isRoot
                  ? "Every task in this workspace, sorted by urgency (priority + due date)."
                  : "Subfolders and tasks. Urgency edge rises with priority and due dates."}
              </p>

              {childFolders.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {childFolders.map((f) => (
                    <li key={f.id}>
                      <div className="group flex items-center justify-between gap-2 rounded-lg border border-[#0A3D45]/10 bg-[#0A3D45]/[0.02] px-3 py-2.5 transition hover:border-[#0A3D45]/20 hover:bg-[#0A3D45]/[0.05]">
                        <Link
                          href={`/app/w/${workspaceId}?folder=${f.id}`}
                          className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold text-[#0A3D45]"
                        >
                          <span className="truncate">{f.name}</span>
                          <span className="rounded-md bg-[#0A3D45]/8 px-1.5 text-[11px] font-semibold tabular-nums text-[#0A3D45]/70">
                            {folderCounts.get(f.id) ?? 0}
                          </span>
                        </Link>
                        {canEdit ? (
                          <FolderActions
                            workspaceId={workspaceId}
                            folderId={f.id}
                            folderName={f.name}
                          />
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}

              {canEdit && currentFolder ? (
                <InlineActionForm
                  className="mt-5 grid gap-2 sm:grid-cols-2"
                  action={createTaskAction}
                  submitLabel="Add task"
                >
                  <input type="hidden" name="workspaceId" value={workspaceId} />
                  <input type="hidden" name="folderId" value={currentFolder.id} />
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

              {isRoot && canEdit ? (
                <p className="mt-4 text-sm text-[#0A3D45]/65">
                  Open a folder to add tasks. All Tasks lists everything by urgency.
                </p>
              ) : null}
            </div>

            <ul className="space-y-3">
              {tasks.map((task) => (
                <WorkspaceTaskRow
                  key={task.id}
                  workspaceId={workspaceId}
                  userId={user.id}
                  canEdit={canEdit}
                  isRoot={isRoot}
                  task={task}
                />
              ))}
              {tasks.length === 0 ? (
                <li className="text-sm text-[#0A3D45]/60">
                  {isRoot ? "No tasks in this workspace yet." : "No tasks here yet."}
                </li>
              ) : null}
            </ul>
          </section>
        </div>
      </main>
  );
}
