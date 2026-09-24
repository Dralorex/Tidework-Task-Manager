import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArchiveFolderControls,
  ArchiveWorkspacePanel,
} from "@/app/components/archive-controls";
import {
  FolderAccessPanel,
  WorkspaceRolesPanel,
} from "@/app/components/folder-acl-panels";
import { FolderTemplatesPanel } from "@/app/components/folder-templates-panel";
import { InlineActionForm } from "@/app/components/forms";
import { WorkspacePulseStrip } from "@/app/components/workspace-pulse-strip";
import { WorkspaceSetupChecklist } from "@/app/components/workspace-setup-checklist";
import { RecurrenceFields } from "@/app/components/recurrence-fields";
import {
  WorkspaceTaskRow,
  type WorkspaceTaskRowData,
} from "@/app/components/workspace-task-row";
import {
  createFolderAction,
  createTaskAction,
} from "@/app/actions/tasks";
import { inviteMemberAction } from "@/app/actions/workspaces";
import { canViewArchived, isArchived } from "@/lib/archive";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  buildFolderVisibility,
  canAccessFolder,
  loadFolderAccessRows,
  loadUserCustomRoleIds,
} from "@/lib/folder-access";
import { canEditContent, canManagePeople } from "@/lib/permissions";
import { syncDueRecurrences } from "@/lib/recurrence";
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
    recurrenceCadence: string | null;
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
    recurrenceCadence: task.recurrenceCadence ?? null,
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

  await syncDueRecurrences(workspaceId);

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
  });

  if (!canViewArchived(user.id, membership.role, workspace)) {
    redirect("/app");
  }

  const workspaceArchived = isArchived(workspace);

  const [folderAccessRows, userRoleIds, workspaceRoles] = await Promise.all([
    loadFolderAccessRows(workspaceId),
    loadUserCustomRoleIds(membership.id),
    prisma.workspaceRole.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, hideFolders: true },
    }),
  ]);
  const foldersById = new Map(folderAccessRows.map((f) => [f.id, f]));
  const visibleAcl = buildFolderVisibility(folderAccessRows, userRoleIds, {
    membershipRole: membership.role,
  });
  const visibleAclIds = new Set(visibleAcl.map((f) => f.id));
  const accessibleFolderIds = new Set(
    visibleAcl.filter((f) => f.canAccess).map((f) => f.id),
  );
  const folderAclMeta = new Map(
    visibleAcl.map((f) => [f.id, f] as const),
  );

  const foldersAll = await prisma.folder.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
  });

  const folders = foldersAll.filter(
    (f) =>
      visibleAclIds.has(f.id) &&
      canViewArchived(user.id, membership.role, f),
  );
  const activeFolders = folders.filter((f) => !isArchived(f));
  const archivedFolders = folders.filter((f) => isArchived(f));

  const currentFolderId = inbox
    ? null
    : (sp.folder ?? activeFolders[0]?.id ?? archivedFolders[0]?.id ?? null);
  const currentFolder = currentFolderId
    ? (folders.find((f) => f.id === currentFolderId) ?? null)
    : null;
  /** Only nest templates under a folder when the URL explicitly selected one */
  const explicitFolderId = inbox ? null : (sp.folder ?? null);
  const templateParentFolder =
    explicitFolderId
      ? (folders.find((f) => f.id === explicitFolderId && !isArchived(f)) ?? null)
      : null;

  if (currentFolder && !canViewArchived(user.id, membership.role, currentFolder)) {
    redirect(`/app/w/${workspaceId}`);
  }
  if (
    currentFolder &&
    !canAccessFolder(currentFolder.id, foldersById, userRoleIds, {
      membershipRole: membership.role,
    })
  ) {
    redirect(`/app/w/${workspaceId}`);
  }

  const childFolders = currentFolder
    ? folders.filter(
        (f) => f.parentId === currentFolder.id && !isArchived(f),
      )
    : [];

  const canEdit =
    canEditContent(membership.role) &&
    !workspaceArchived &&
    !(currentFolder && isArchived(currentFolder)) &&
    (!currentFolder || accessibleFolderIds.has(currentFolder.id));
  const canInvite = canManagePeople(membership.role) && !workspaceArchived;
  const canArchive = canManagePeople(membership.role);
  const showPulse = canManagePeople(membership.role);
  const canManageRoles = canManagePeople(membership.role);

  const pendingInvites = canInvite
    ? await prisma.invite.findMany({
        where: { workspaceId, status: "PENDING" },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const savedTemplates = await prisma.folderTemplate.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, treeJson: true },
  });

  const allWorkspaceTasks = await prisma.task.findMany({
    where: {
      workspaceId,
      ...(canManagePeople(membership.role)
        ? {}
        : { folderId: { in: [...accessibleFolderIds] } }),
    },
    select: {
      id: true,
      status: true,
      dueDate: true,
      assigneeId: true,
      folderId: true,
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

  const workspaceMembers = await prisma.membership.findMany({
    where: { workspaceId },
    include: {
      user: { select: { id: true, username: true } },
      customRoles: { select: { roleId: true } },
    },
    orderBy: { user: { username: "asc" } },
  });

  const assignableMembers = (
    currentFolder
      ? workspaceMembers.filter((m) =>
          canAccessFolder(currentFolder.id, foldersById, new Set(m.customRoles.map((r) => r.roleId)), {
            membershipRole: m.role,
          }),
        )
      : workspaceMembers
  ).map((m) => ({
    id: m.user.id,
    username: m.user.username,
  }));

  const myClaimedCount = allWorkspaceTasks.filter(
    (t) =>
      t.assigneeId === user.id &&
      (t.status === "CLAIMED" || t.status === "OPEN"),
  ).length;
  const needsReviewCount = allWorkspaceTasks.filter(
    (t) => t.status === "IN_REVIEW",
  ).length;

  const inboxFolderFilter = canManagePeople(membership.role)
    ? {}
    : { folderId: { in: [...accessibleFolderIds] } };

  let tasksRaw =
    inbox === "mine"
      ? await prisma.task.findMany({
          where: {
            workspaceId,
            assigneeId: user.id,
            status: { in: ["OPEN", "CLAIMED", "IN_REVIEW"] },
            ...inboxFolderFilter,
          },
          include: taskInclude,
        })
      : inbox === "review"
        ? await prisma.task.findMany({
            where: {
              workspaceId,
              status: "IN_REVIEW",
              ...inboxFolderFilter,
            },
            include: taskInclude,
          })
        : currentFolder && accessibleFolderIds.has(currentFolder.id)
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
  const rootFolderCount = activeFolders.filter((f) => !f.parentId).length;
  const firstFolderId =
    activeFolders.find((f) => accessibleFolderIds.has(f.id))?.id ?? null;
  const folderArchived = Boolean(currentFolder && isArchived(currentFolder));

  const sectionTitle =
    inbox === "mine"
      ? "My claimed"
      : inbox === "review"
        ? "Needs review"
        : currentFolder
          ? currentFolder.name
          : "Root";

  const archiveMembers = workspaceMembers.map((m) => ({
    id: m.user.id,
    username: m.user.username,
  }));

  return (
    <><main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/app" className="text-sm text-[#0A3D45]/60 hover:underline">
              ← Workspaces
            </Link>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl text-[#0A3D45]">
              {workspace.name}
              {workspaceArchived ? (
                <span className="ml-3 align-middle text-sm font-sans font-semibold uppercase tracking-wide text-[#E85D4C]">
                  Archived
                </span>
              ) : null}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-sm capitalize text-[#0A3D45]/60">
                You’re {membership.role.toLowerCase()}
              </p>
              {canArchive && !workspaceArchived ? (
                <ArchiveWorkspacePanel
                  workspaceId={workspaceId}
                  isArchived={false}
                  members={archiveMembers}
                />
              ) : null}
            </div>
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

        {workspaceArchived ? (
          <div className="mt-4">
            {canArchive ? (
              <ArchiveWorkspacePanel
                workspaceId={workspaceId}
                isArchived
                members={archiveMembers}
              />
            ) : (
              <div className="rounded-xl border border-[#E85D4C]/25 bg-[#E85D4C]/8 px-3 py-2.5 text-sm text-[#0A3D45]/80">
                This workspace is archived. History stays visible; new work is paused.
              </div>
            )}
          </div>
        ) : null}

        <WorkspaceSetupChecklist
          workspaceId={workspaceId}
          forceShow={showSetup}
          hasFolder={activeFolders.length > 0}
          hasTask={taskCount > 0}
          hasInvite={hasInviteActivity}
          canInvite={canInvite}
          canEdit={canEdit && !workspaceArchived}
          firstFolderId={firstFolderId}
        />

        <WorkspacePulseStrip
          workspaceId={workspaceId}
          counts={counts}
          canReview={canEditContent(membership.role) && !workspaceArchived}
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
                {activeFolders
                  .filter((f) => !f.parentId)
                  .map((f) => {
                    const meta = folderAclMeta.get(f.id);
                    const locked = Boolean(meta?.locked);
                    return (
                    <li key={f.id}>
                      {locked ? (
                        <span className="text-[#0A3D45]/45">
                          {f.name}{" "}
                          <span className="text-[10px] uppercase tracking-wide">
                            locked
                          </span>
                        </span>
                      ) : (
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
                      )}
                    </li>
                    );
                  })}
              </ul>

              {archivedFolders.filter((f) => !f.parentId).length > 0 ? (
                <div className="mt-4 border-t border-[#0A3D45]/10 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#0A3D45]/45">
                    Archived
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {archivedFolders
                      .filter((f) => !f.parentId)
                      .map((f) => (
                        <li key={f.id}>
                          <Link
                            href={`/app/w/${workspaceId}?folder=${f.id}`}
                            className={
                              currentFolder?.id === f.id
                                ? "font-semibold text-[#0A3D45]"
                                : "text-[#0A3D45]/55 hover:text-[#0A3D45]"
                            }
                          >
                            {f.name}
                          </Link>
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}

              {canEdit && !workspaceArchived ? (
                <InlineActionForm
                  className="mt-4 flex flex-col gap-2"
                  action={createFolderAction}
                  submitLabel="New folder"
                  submitClassName="w-full min-h-11"
                >
                  <input type="hidden" name="workspaceId" value={workspaceId} />
                  {currentFolder && !isArchived(currentFolder) ? (
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

              {canManageRoles && currentFolder && !isArchived(currentFolder) ? (
                <div className="mt-3">
                  <FolderAccessPanel
                    workspaceId={workspaceId}
                    folderId={currentFolder.id}
                    roles={workspaceRoles}
                    requiredRoleIds={
                      folderAclMeta.get(currentFolder.id)?.requiredRoleIds ?? []
                    }
                    hideFromUnauthorized={
                      folderAclMeta.get(currentFolder.id)?.hideFromUnauthorized ??
                      false
                    }
                    alwaysVisible={
                      folderAclMeta.get(currentFolder.id)?.alwaysVisible ?? false
                    }
                  />
                </div>
              ) : null}

              {!workspaceArchived ? (
                <FolderTemplatesPanel
                  workspaceId={workspaceId}
                  parentId={templateParentFolder?.id ?? null}
                  currentFolderId={
                    currentFolder && !isArchived(currentFolder)
                      ? currentFolder.id
                      : null
                  }
                  currentFolderName={
                    currentFolder && !isArchived(currentFolder)
                      ? currentFolder.name
                      : null
                  }
                  canEdit={canEditContent(membership.role)}
                  canSave={canArchive}
                  savedTemplates={savedTemplates}
                />
              ) : null}
            </div>

            {canManageRoles ? (
              <div className="tide-panel p-4">
                <h2 className="font-[family-name:var(--font-display)] text-lg text-[#0A3D45]">
                  Access
                </h2>
                <WorkspaceRolesPanel
                  workspaceId={workspaceId}
                  roles={workspaceRoles}
                  members={workspaceMembers.map((m) => ({
                    id: m.user.id,
                    username: m.user.username,
                    roleIds: m.customRoles.map((r) => r.roleId),
                  }))}
                />
              </div>
            ) : null}

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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-[family-name:var(--font-display)] text-2xl text-[#0A3D45]">
                  {sectionTitle}
                  {folderArchived ? (
                    <span className="ml-2 align-middle text-sm font-sans font-semibold uppercase tracking-wide text-[#E85D4C]">
                      Archived
                    </span>
                  ) : null}
                </h2>
                {!inbox && canArchive && currentFolder && !workspaceArchived && !folderArchived ? (
                  <ArchiveFolderControls
                    workspaceId={workspaceId}
                    folderId={currentFolder.id}
                    folderName={currentFolder.name}
                    isArchived={false}
                    members={archiveMembers}
                  />
                ) : null}
              </div>
              <p className="text-sm text-[#0A3D45]/60">
                {inbox === "mine"
                  ? "Tasks you’ve claimed across every folder."
                  : inbox === "review"
                    ? "Waiting on Editor+ approval across the workspace."
                    : folderArchived
                      ? "Archived folder — history preserved; new tasks paused."
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

              {!inbox && canArchive && currentFolder && !workspaceArchived && folderArchived ? (
                <ArchiveFolderControls
                  workspaceId={workspaceId}
                  folderId={currentFolder.id}
                  folderName={currentFolder.name}
                  isArchived
                  members={archiveMembers}
                />
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
                    <select name="assignTo" className="tide-input min-h-11" defaultValue="">
                      <option value="">Claim pool (anyone)</option>
                      {assignableMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          Assign @{m.username}
                        </option>
                      ))}
                    </select>
                    <RecurrenceFields />
                  </InlineActionForm>
                  <p className="mt-2 text-xs text-[#0A3D45]/55">
                    Members claim tasks. Editors+ can auto-assign; others can’t claim over an
                    assignment. Unclaim returns the task to the pool.
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
                  assignableMembers={assignableMembers}
                />
              ))}
              {tasks.length === 0 ? (
                <li className="tide-panel p-4 text-sm text-[#0A3D45]/70">
                  {inbox === "mine"
                    ? "Nothing claimed right now. Open a folder and pick up a task."
                    : inbox === "review"
                      ? "No tasks waiting for review."
                      : currentFolder
                        ? folderArchived
                          ? "No tasks in this archived folder."
                          : "Add a task people can claim. When they’re done, it goes to review — status moves on the task automatically."
                        : "Pick a folder to see tasks, or use My claimed / Needs review above."}
                </li>
              ) : null}
            </ul>
          </section>
        </div>
      </main>
    </>
  );
}
