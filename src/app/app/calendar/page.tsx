import { redirect } from "next/navigation";
import {
  CalendarBoard,
  type CalendarBoardEvent,
} from "@/app/components/calendar-board";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEditContent } from "@/lib/permissions";
import { personLabel } from "@/lib/utils";

function birthdayDate(birthday: Date) {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), birthday.getUTCMonth(), birthday.getUTCDate(), 12),
  );
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    scope?: string;
    workspaceId?: string;
    view?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const requestedScope = sp.scope === "workspace" ? "workspace" : "personal";
  const view = sp.view === "month" ? "month" : "list";

  const [memberships, filters] = await Promise.all([
    prisma.membership.findMany({
      where: { userId: user.id },
      include: { workspace: true },
      orderBy: { workspace: { name: "asc" } },
    }),
    prisma.calendarWorkspaceFilter.findMany({
      where: { userId: user.id },
    }),
  ]);

  const selectedMembership =
    memberships.find((membership) => membership.workspaceId === sp.workspaceId) ??
    memberships[0] ??
    null;
  const scope =
    requestedScope === "workspace" && selectedMembership ? "workspace" : "personal";
  const workspaceId = scope === "workspace" ? selectedMembership?.workspaceId : null;
  const filterByWorkspace = new Map(
    filters.map((filter) => [filter.workspaceId, filter.enabled]),
  );
  const enabledWorkspaceIds = memberships
    .filter((membership) => filterByWorkspace.get(membership.workspaceId) !== false)
    .map((membership) => membership.workspaceId);

  const birthdayWorkspaceIds =
    scope === "workspace" && workspaceId ? [workspaceId] : enabledWorkspaceIds;

  const [personalEvents, workspaceEvents, taskEvents, birthdayShares, birthdays] =
    await Promise.all([
      scope === "personal"
        ? prisma.personalCalendarEvent.findMany({
            where: { userId: user.id, hidden: false },
            orderBy: { date: "asc" },
          })
        : [],
      scope === "workspace" && workspaceId
        ? prisma.workspaceCalendarEvent.findMany({
            where: { workspaceId },
            include: { createdBy: true },
            orderBy: { date: "asc" },
          })
        : [],
      scope === "personal" && enabledWorkspaceIds.length > 0
        ? prisma.calendarEvent.findMany({
            where: {
              userId: user.id,
              task: { workspaceId: { in: enabledWorkspaceIds } },
            },
            include: {
              task: {
                include: {
                  workspace: true,
                  folder: true,
                },
              },
            },
            orderBy: { dueDate: "asc" },
          })
        : [],
      scope === "personal" && user.showBirthdaysOnCalendar
        ? prisma.birthdayShare.findMany({
            where: { viewerId: user.id, status: "ACTIVE" },
            include: { owner: true },
          })
        : [],
      (scope === "workspace" || user.showBirthdaysOnCalendar) &&
      birthdayWorkspaceIds.length > 0
        ? prisma.workspaceBirthdayRequest.findMany({
            where: {
              workspaceId: { in: birthdayWorkspaceIds },
              status: "ACTIVE",
            },
            include: { subject: true, workspace: true },
          })
        : [],
    ]);

  const events: CalendarBoardEvent[] = [
    ...personalEvents.map((event) => ({
      id: `personal:${event.id}`,
      recordId: event.id,
      kind: "personal" as const,
      title: event.title,
      description: event.description,
      date: event.date.toISOString(),
      allDay: event.allDay,
      startAt: event.startAt?.toISOString() ?? null,
      endAt: event.endAt?.toISOString() ?? null,
      sourceLabel: "Personal event",
    })),
    ...workspaceEvents.map((event) => ({
      id: `workspace:${event.id}`,
      recordId: event.id,
      kind: "workspace" as const,
      title: event.title,
      description: event.description,
      date: event.date.toISOString(),
      allDay: event.allDay,
      startAt: event.startAt?.toISOString() ?? null,
      endAt: event.endAt?.toISOString() ?? null,
      sourceLabel: `Added by ${personLabel(event.createdBy)}`,
    })),
    ...taskEvents.map((event) => ({
      id: `task:${event.id}`,
      recordId: event.id,
      kind: "task" as const,
      title: event.title,
      description: event.task.description,
      date: event.dueDate.toISOString(),
      allDay: true,
      startAt: null,
      endAt: null,
      sourceLabel: `${event.task.workspace.name} · ${event.task.folder.name}`,
      href: `/app/w/${event.task.workspaceId}?folder=${event.task.folderId}`,
    })),
  ];

  const birthdayEvents = new Map<string, CalendarBoardEvent>();
  for (const share of birthdayShares) {
    if (!share.owner.birthday) continue;
    birthdayEvents.set(share.ownerId, {
      id: `birthday:${share.ownerId}`,
      recordId: share.id,
      kind: "birthday",
      title: `${personLabel(share.owner)}’s birthday`,
      description: "Shared with you",
      date: birthdayDate(share.owner.birthday).toISOString(),
      allDay: true,
      startAt: null,
      endAt: null,
      sourceLabel: "Friend birthday",
    });
  }
  for (const birthday of birthdays) {
    if (!birthday.subject.birthday) continue;
    const existing = birthdayEvents.get(birthday.subjectId);
    birthdayEvents.set(birthday.subjectId, {
      id: existing?.id ?? `birthday:${birthday.subjectId}`,
      recordId: birthday.id,
      kind: "birthday",
      title: `${personLabel(birthday.subject)}’s birthday`,
      description: "Approved workspace birthday",
      date: birthdayDate(birthday.subject.birthday).toISOString(),
      allDay: true,
      startAt: null,
      endAt: null,
      sourceLabel: existing
        ? `${existing.sourceLabel} · ${birthday.workspace.name}`
        : birthday.workspace.name,
    });
  }
  events.push(...birthdayEvents.values());
  events.sort((a, b) => a.date.localeCompare(b.date));

  return (
    <CalendarBoard
      events={events}
      initialScope={scope}
      initialView={view}
      selectedWorkspaceId={workspaceId}
      showBirthdays={user.showBirthdaysOnCalendar}
      workspaces={memberships.map((membership) => ({
        id: membership.workspaceId,
        name: membership.workspace.name,
        role: membership.role,
        canEdit: canEditContent(membership.role),
        filterEnabled: filterByWorkspace.get(membership.workspaceId) !== false,
      }))}
    />
  );
}
