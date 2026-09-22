import { redirect } from "next/navigation";
import Link from "next/link";
import { InlineActionForm } from "@/app/components/forms";
import { FolderActions } from "@/app/components/folder-actions";
import { FolderCompletionStats } from "@/app/components/folder-completion-stats";
import { WorkspaceTaskRow } from "@/app/components/workspace-task-row";
import { TaskStatusSections } from "@/app/components/task-status-sections";
import { DueDateField } from "@/app/components/due-date-field";
import {
  createFolderAction,
  createTaskAction,
} from "@/app/actions/tasks";
import { inviteMemberAction } from "@/app/actions/workspaces";
import { FriendInvitePicker } from "@/app/components/friend-invite-picker";
import { PendingInvitesDropdown } from "@/app/components/pending-invites-dropdown";
import { ChatSidebarSection } from "@/app/components/chat-sidebar-section";
import { WorkspaceMembersPanel } from "@/app/components/workspace-members-panel";
import { WorkspaceRolesPanel } from "@/app/components/workspace-roles-panel";
import { RoleActivityNotices } from "@/app/components/role-activity-notices";
import { MarkRoleActivitySeen } from "@/app/components/mark-role-activity-seen";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computeFolderTaskCounts, collectSubtreeFolderIds } from "@/lib/folder-counts";
import {
  buildFolderVisibility,
  canAccessFolder,
  getRoleActivityUnread,
  loadUserCustomRoleIds,
  type FolderAccessRow,
} from "@/lib/folder-access";
import { canEditContent, canManagePeople } from "@/lib/permissions";
import { compareTasksByUrgency } from "@/lib/urgency";
import { personLabel, searchRelevance } from "@/lib/utils";
import { TagFilterField } from "@/app/components/tag-filter-field";

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

  const [folderRecords, userRoleIds, workspaceRoles] = await Promise.all([
    prisma.folder.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
      include: { requiredRoles: { select: { roleId: true } } },
    }),
    loadUserCustomRoleIds(membership.id),
    prisma.workspaceRole.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
      include: { _count: { select: { members: true } } },
    }),
  ]);

  const folderAccessRows: FolderAccessRow[] = folderRecords.map((f) => ({
    id: f.id,
    parentId: f.parentId,
    name: f.name,
    requiredRoleIds: f.requiredRoles.map((r) => r.roleId),
  }));
  const foldersById = new Map(folderAccessRows.map((f) => [f.id, f]));
  const visibleFolders = buildFolderVisibility(folderAccessRows, userRoleIds);
  const accessibleFolderIds = new Set(
    visibleFolders.filter((f) => f.canAccess).map((f) => f.id),
  );

  const folders = folderRecords;
  const roleOptions = workspaceRoles.map((r) => ({ id: r.id, name: r.name }));

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
  const allTasksCount = [...accessibleFolderIds].reduce(
    (sum, id) => sum + (directCounts.get(id) ?? 0),
    0,
  );

  const [doneCountRows, totalCountRows] = await Promise.all([
    prisma.task.groupBy({
      by: ["folderId"],
      where: { workspaceId, status: "DONE" },
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ["folderId"],
      where: { workspaceId },
      _count: { _all: true },
    }),
  ]);
  const folderDoneCounts = computeFolderTaskCounts(
    folders,
    new Map(doneCountRows.map((r) => [r.folderId, r._count._all])),
  );
  const folderTotalCounts = computeFolderTaskCounts(
    folders,
    new Map(totalCountRows.map((r) => [r.folderId, r._count._all])),
  );

  // All Tasks = no folder query param. Show all tasks by urgency.
  const isRoot = !sp.folder;
  const currentFolderId = sp.folder ?? null;
  const currentFolder = currentFolderId
    ? folders.find((f) => f.id === currentFolderId) ?? null
    : null;

  if (currentFolderId && !currentFolder) {
    redirect(`/app/w/${workspaceId}`);
  }

  if (
    currentFolder &&
    !canAccessFolder(currentFolder.id, foldersById, userRoleIds)
  ) {
    redirect(`/app/w/${workspaceId}`);
  }

  const childFolders = visibleFolders.filter(
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

  const q = sp.q?.trim() ?? "";
  const tagFilter = sp.tag?.trim().toLowerCase() ?? "";

  const tagScopeFolderIds = collectSubtreeFolderIds(
    currentFolder?.id ?? null,
    folders,
    accessibleFolderIds,
  );

  // Folder browse stays local; tag filter includes the folder subtree so
  // tags from lower paths remain useful.
  const taskFolderIds = isRoot
    ? [...accessibleFolderIds]
    : tagFilter && currentFolder
      ? tagScopeFolderIds
      : currentFolder
        ? [currentFolder.id]
        : [];

  let tasks =
    taskFolderIds.length === 0
      ? []
      : await prisma.task.findMany({
          where: {
            workspaceId,
            folderId: { in: taskFolderIds },
          },
          include: {
            assignee: true,
            folder: true,
            lastUnclaimedBy: true,
            lastSentBackBy: true,
            tags: { include: { tag: true } },
          },
        });

  const [publicTagsInScope, privateTagsForUser] = await Promise.all([
    tagScopeFolderIds.length === 0
      ? Promise.resolve([] as { name: string }[])
      : prisma.tag.findMany({
          where: {
            workspaceId,
            isPublic: true,
            tasks: {
              some: { task: { folderId: { in: tagScopeFolderIds } } },
            },
          },
          orderBy: { name: "asc" },
          select: { name: true },
        }),
    prisma.tag.findMany({
      where: {
        workspaceId,
        isPublic: false,
        creatorId: user.id,
      },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
  ]);

  const publicTagOptions = publicTagsInScope.map((t) => t.name);
  const privateTagOptions = privateTagsForUser.map((t) => t.name);
  const searchTagOptions = Array.from(
    new Set([...publicTagOptions, ...privateTagOptions]),
  ).sort((a, b) => a.localeCompare(b));

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
  const canManageRoles = canManagePeople(membership.role);

  const roleActivity = await getRoleActivityUnread(
    user.id,
    workspaceId,
    userRoleIds,
  );

  const currentRequiredRoleIds = currentFolder
    ? (foldersById.get(currentFolder.id)?.requiredRoleIds ?? [])
    : [];
  const markSeenRoleIds = currentRequiredRoleIds.filter((id) =>
    userRoleIds.has(id),
  );

  const pendingInvites = canInvite
    ? await prisma.invite.findMany({
        where: { workspaceId, status: "PENDING" },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const workspaceMembers = await prisma.membership.findMany({
    where: { workspaceId },
    include: {
      user: true,
      customRoles: { include: { role: true } },
    },
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
    customRoleIds: m.customRoles.map((cr) => cr.roleId),
    customRoleNames: m.customRoles.map((cr) => cr.role.name),
    isSelf: m.userId === user.id,
    isFriend: friendIds.has(m.userId),
    requestPending: pendingFriendIds.has(m.userId),
  }));

  const rootFolders = visibleFolders.filter((f) => !f.parentId);

  function folderActionsProps(folderId: string, folderName: string) {
    const row = foldersById.get(folderId);
    return {
      workspaceId,
      folderId,
      folderName,
      canManageRoles,
      workspaceRoles: roleOptions,
      requiredRoleIds: row?.requiredRoleIds ?? [],
    };
  }

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
            <TagFilterField tags={searchTagOptions} defaultValue={tagFilter} />
            <button type="submit" className="tide-btn-secondary text-sm">
              Search
            </button>
          </form>
        </div>

        {roleActivity.length > 0 ? (
          <div className="mt-6">
            <RoleActivityNotices workspaceId={workspaceId} items={roleActivity} />
          </div>
        ) : null}

        {markSeenRoleIds.length > 0 ? (
          <MarkRoleActivitySeen
            workspaceId={workspaceId}
            roleIds={markSeenRoleIds}
          />
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[240px_1fr]">
          <aside className="space-y-4">
            <div className="tide-panel p-4">
              <ChatSidebarSection title="Folders">
                <ul className="space-y-1 text-sm">
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
                  {rootFolders.map((f) => (
                      <li key={f.id}>
                        <div className="group flex items-start justify-between gap-1">
                          <div className="min-w-0 flex-1">
                            {f.locked ? (
                              <span
                                className="inline-flex min-w-0 cursor-not-allowed items-center gap-1.5 text-[#0A3D45]/45"
                                title="You don’t have a required role for this folder"
                                aria-disabled="true"
                              >
                                <span className="truncate">{f.name}</span>
                                <span aria-hidden>🔒</span>
                                <span className="rounded-md bg-[#0A3D45]/8 px-1.5 text-[11px] font-semibold tabular-nums text-[#0A3D45]/55">
                                  {folderCounts.get(f.id) ?? 0}
                                </span>
                              </span>
                            ) : (
                              <Link
                                href={`/app/w/${workspaceId}?folder=${f.id}`}
                                className={`inline-flex min-w-0 items-center gap-1.5 ${
                                  currentFolder?.id === f.id
                                    ? "font-semibold text-[#0A3D45]"
                                    : "text-[#0A3D45]/70 hover:text-[#0A3D45]"
                                }`}
                              >
                                <span className="truncate">{f.name}</span>
                                {f.requiredRoleIds.length > 0 ? (
                                  <span className="text-[10px] text-[#0A3D45]/40" title="Role-restricted">
                                    ●
                                  </span>
                                ) : null}
                                <span className="rounded-md bg-[#0A3D45]/8 px-1.5 text-[11px] font-semibold tabular-nums text-[#0A3D45]/70">
                                  {folderCounts.get(f.id) ?? 0}
                                </span>
                              </Link>
                            )}
                            <FolderCompletionStats
                              done={folderDoneCounts.get(f.id) ?? 0}
                              total={folderTotalCounts.get(f.id) ?? 0}
                              unclaimed={folderCounts.get(f.id) ?? 0}
                            />
                          </div>
                          {canEdit && f.canAccess ? (
                            <FolderActions {...folderActionsProps(f.id, f.name)} />
                          ) : null}
                        </div>
                      </li>
                    ))}
                </ul>

                {canEdit ? (
                  <InlineActionForm
                    className="mt-4 flex flex-col gap-2"
                    action={createFolderAction}
                    submitLabel="New folder"
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
                ) : null}
              </ChatSidebarSection>
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
                    <FriendInvitePicker
                      friends={inviteFriends}
                      targetName="target"
                      excludeIds={workspaceMembers.map((m) => m.userId)}
                    />
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

            <WorkspaceRolesPanel
              workspaceId={workspaceId}
              roles={workspaceRoles.map((r) => ({
                id: r.id,
                name: r.name,
                memberCount: r._count.members,
              }))}
              canManage={canManageRoles}
            />

            <WorkspaceMembersPanel
              workspaceId={workspaceId}
              members={memberRows}
              viewerRole={membership.role}
              workspaceRoles={roleOptions}
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
                    {...folderActionsProps(currentFolder.id, currentFolder.name)}
                  />
                ) : null}
              </div>
              <p className="text-sm text-[#0A3D45]/60">
                {isRoot
                  ? "Every task in this workspace, sorted by urgency (priority + due date)."
                  : "Subfolders and tasks grouped by status. Urgency edge rises with priority and due dates."}
              </p>

              {childFolders.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {childFolders.map((f) => (
                    <li key={f.id}>
                      <div
                        className={`group flex items-start justify-between gap-2 rounded-lg border px-3 py-2.5 transition ${
                          f.locked
                            ? "cursor-not-allowed border-[#0A3D45]/8 bg-[#0A3D45]/[0.015] opacity-80"
                            : "border-[#0A3D45]/10 bg-[#0A3D45]/[0.02] hover:border-[#0A3D45]/20 hover:bg-[#0A3D45]/[0.05]"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          {f.locked ? (
                            <span
                              className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[#0A3D45]/45"
                              title="You don’t have a required role for this folder"
                              aria-disabled="true"
                            >
                              <span className="truncate">{f.name}</span>
                              <span aria-hidden>🔒</span>
                              <span className="rounded-md bg-[#0A3D45]/8 px-1.5 text-[11px] font-semibold tabular-nums text-[#0A3D45]/55">
                                {folderCounts.get(f.id) ?? 0}
                              </span>
                            </span>
                          ) : (
                            <Link
                              href={`/app/w/${workspaceId}?folder=${f.id}`}
                              className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[#0A3D45]"
                            >
                              <span className="truncate">{f.name}</span>
                              {f.requiredRoleIds.length > 0 ? (
                                <span
                                  className="text-[10px] text-[#0A3D45]/40"
                                  title="Role-restricted"
                                >
                                  ●
                                </span>
                              ) : null}
                              <span className="rounded-md bg-[#0A3D45]/8 px-1.5 text-[11px] font-semibold tabular-nums text-[#0A3D45]/70">
                                {folderCounts.get(f.id) ?? 0}
                              </span>
                            </Link>
                          )}
                          <FolderCompletionStats
                            done={folderDoneCounts.get(f.id) ?? 0}
                            total={folderTotalCounts.get(f.id) ?? 0}
                            unclaimed={folderCounts.get(f.id) ?? 0}
                          />
                        </div>
                        {canEdit && f.canAccess ? (
                          <FolderActions {...folderActionsProps(f.id, f.name)} />
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
                  <select
                    name="priority"
                    required
                    defaultValue=""
                    className="tide-input text-[color-mix(in_srgb,var(--tide-ink)_45%,transparent)] valid:text-[var(--tide-ink)]"
                  >
                    <option value="" disabled>
                      Priority level
                    </option>
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
                  <DueDateField name="dueDate" />
                </InlineActionForm>
              ) : null}

              {isRoot && canEdit ? (
                <p className="mt-4 text-sm text-[#0A3D45]/65">
                  Open a folder to add tasks. All Tasks lists everything by urgency.
                </p>
              ) : null}
            </div>

            {isRoot ? (
              <ul className="space-y-3">
                {tasks.map((task) => (
                  <WorkspaceTaskRow
                    key={task.id}
                    workspaceId={workspaceId}
                    userId={user.id}
                    canEdit={canEdit}
                    isRoot
                    task={task}
                    publicTagOptions={publicTagOptions}
                    privateTagOptions={privateTagOptions}
                  />
                ))}
                {tasks.length === 0 ? (
                  <li className="text-sm text-[#0A3D45]/60">
                    No tasks in this workspace yet.
                  </li>
                ) : null}
              </ul>
            ) : (
              <TaskStatusSections
                workspaceId={workspaceId}
                userId={user.id}
                canEdit={canEdit}
                tasks={tasks}
                publicTagOptions={publicTagOptions}
                privateTagOptions={privateTagOptions}
              />
            )}
          </section>
        </div>
      </main>
  );
}
