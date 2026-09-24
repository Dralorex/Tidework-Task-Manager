"use client";

import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { InlineActionForm } from "@/app/components/forms";
import {
  createPersonalEventAction,
  createWorkspaceEventAction,
  deletePersonalEventAction,
  deleteWorkspaceEventAction,
  setBirthdayAction,
  setCalendarWorkspaceFilterAction,
  setShowBirthdaysAction,
} from "@/app/actions/calendar";

export type CalendarKind = "personal" | "task" | "workspace" | "birthday";

export type CalendarBoardEvent = {
  id: string;
  recordId: string;
  kind: CalendarKind;
  title: string;
  description: string;
  date: string;
  sourceLabel: string;
  href?: string;
  canDelete?: boolean;
};

type WorkspaceOption = {
  id: string;
  name: string;
  canEdit: boolean;
  filterEnabled: boolean;
};

const KIND_META: Record<
  CalendarKind,
  { label: string; chip: string; bar: string }
> = {
  personal: {
    label: "Personal",
    chip: "bg-[#3DBEAB]/20 text-[#0A3D45]",
    bar: "bg-[#3DBEAB]",
  },
  task: {
    label: "Task",
    chip: "bg-[#E85D4C]/18 text-[#9b2f22]",
    bar: "bg-[#E85D4C]",
  },
  workspace: {
    label: "Workspace",
    chip: "bg-[#0A3D45]/12 text-[#0A3D45]",
    bar: "bg-[#0A3D45]",
  },
  birthday: {
    label: "Birthday",
    chip: "bg-[#e0b56a]/35 text-[#6b4a12]",
    bar: "bg-[#c8944a]",
  },
};

const ALL_KINDS: CalendarKind[] = ["personal", "task", "workspace", "birthday"];

function toggleKind(current: CalendarKind[], kind: CalendarKind) {
  if (current.includes(kind)) {
    const next = current.filter((k) => k !== kind);
    return next.length ? next : current;
  }
  return [...current, kind];
}

export function CalendarBoard({
  events,
  workspaces,
  showBirthdays,
  birthdayValue,
}: {
  events: CalendarBoardEvent[];
  workspaces: WorkspaceOption[];
  showBirthdays: boolean;
  birthdayValue: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [composer, setComposer] = useState<"personal" | "workspace" | null>(null);

  const kindsParam = searchParams.get("kinds");
  const activeKinds: CalendarKind[] = kindsParam
    ? (kindsParam.split(",").filter((k) =>
        ALL_KINDS.includes(k as CalendarKind),
      ) as CalendarKind[])
    : ALL_KINDS;

  const view = searchParams.get("view") === "month" ? "month" : "list";

  function setQuery(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    router.push(`${pathname}?${next.toString()}`);
  }

  const filtered = useMemo(
    () => events.filter((e) => activeKinds.includes(e.kind)),
    [events, activeKinds],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarBoardEvent[]>();
    for (const event of filtered) {
      const key = format(parseISO(event.date), "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthCursor));
    const end = endOfWeek(endOfMonth(monthCursor));
    return eachDayOfInterval({ start, end });
  }, [monthCursor]);

  const editableWorkspaces = workspaces.filter((w) => w.canEdit);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {ALL_KINDS.map((kind) => {
          const on = activeKinds.includes(kind);
          return (
            <button
              key={kind}
              type="button"
              onClick={() => {
                const next = toggleKind(activeKinds, kind);
                setQuery({
                  kinds: next.length === ALL_KINDS.length ? null : next.join(","),
                });
              }}
              className={`inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold transition ${
                on
                  ? "bg-[#0A3D45] text-[#E8F7F6]"
                  : "bg-white/55 text-[#0A3D45]/65 hover:bg-white/80"
              }`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${KIND_META[kind].bar}`} />
              {KIND_META[kind].label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setQuery({ view: "list" })}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
            view === "list"
              ? "bg-[#0A3D45] text-[#E8F7F6]"
              : "bg-white/55 text-[#0A3D45]/70"
          }`}
        >
          List
        </button>
        <button
          type="button"
          onClick={() => setQuery({ view: "month" })}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
            view === "month"
              ? "bg-[#0A3D45] text-[#E8F7F6]"
              : "bg-white/55 text-[#0A3D45]/70"
          }`}
        >
          Month
        </button>
      </div>

      <div className="tide-panel space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl text-[#0A3D45]">
              Add to calendar
            </h2>
            <p className="text-xs text-[#0A3D45]/55">
              Personal stays private. Workspace events need Editor+.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setComposer(composer === "personal" ? null : "personal")}
              className="tide-btn-secondary min-h-10 text-sm"
            >
              Personal event
            </button>
            {editableWorkspaces.length > 0 ? (
              <button
                type="button"
                onClick={() =>
                  setComposer(composer === "workspace" ? null : "workspace")
                }
                className="tide-btn-secondary min-h-10 text-sm"
              >
                Workspace event
              </button>
            ) : null}
          </div>
        </div>

        {composer === "personal" ? (
          <InlineActionForm
            action={createPersonalEventAction}
            submitLabel="Add personal event"
            submitVariant="primary"
            className="grid gap-2 sm:grid-cols-2"
            submitClassName="min-h-11 sm:col-span-2 sm:justify-self-start"
          >
            <input name="title" required placeholder="Title" className="tide-input min-h-11" />
            <input name="date" type="date" required className="tide-input min-h-11" />
            <input
              name="description"
              placeholder="Notes (optional)"
              className="tide-input min-h-11 sm:col-span-2"
            />
          </InlineActionForm>
        ) : null}

        {composer === "workspace" ? (
          <InlineActionForm
            action={createWorkspaceEventAction}
            submitLabel="Add workspace event"
            submitVariant="primary"
            className="grid gap-2 sm:grid-cols-2"
            submitClassName="min-h-11 sm:col-span-2 sm:justify-self-start"
          >
            <select name="workspaceId" required className="tide-input min-h-11" defaultValue="">
              <option value="" disabled>
                Workspace…
              </option>
              {editableWorkspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <input name="date" type="date" required className="tide-input min-h-11" />
            <input
              name="title"
              required
              placeholder="Title"
              className="tide-input min-h-11 sm:col-span-2"
            />
            <input
              name="description"
              placeholder="Notes (optional)"
              className="tide-input min-h-11 sm:col-span-2"
            />
          </InlineActionForm>
        ) : null}
      </div>

      {workspaces.length > 0 ? (
        <div className="tide-panel p-4 sm:p-5">
          <h2 className="font-[family-name:var(--font-display)] text-lg text-[#0A3D45]">
            Task sources
          </h2>
          <p className="mt-1 text-xs text-[#0A3D45]/55">
            Which workspaces’ claimed due dates show under Task.
          </p>
          <ul className="mt-3 space-y-2">
            {workspaces.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[#0A3D45]">{w.name}</span>
                <InlineActionForm
                  action={setCalendarWorkspaceFilterAction}
                  submitLabel={w.filterEnabled ? "On" : "Off"}
                  submitClassName="!min-h-9 !px-3 text-xs"
                  className="flex items-center"
                >
                  <input type="hidden" name="workspaceId" value={w.id} />
                  <input
                    type="hidden"
                    name="enabled"
                    value={w.filterEnabled ? "false" : "true"}
                  />
                </InlineActionForm>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="tide-panel p-4 sm:p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg text-[#0A3D45]">
          Birthdays
        </h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <InlineActionForm
            action={setBirthdayAction}
            submitLabel="Save birthday"
            className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end"
            submitClassName="min-h-11"
          >
            <label className="flex-1 text-sm text-[#0A3D45]">
              Your birthday (month/day)
              <input
                name="birthday"
                type="date"
                defaultValue={birthdayValue}
                className="tide-input mt-1 min-h-11"
              />
            </label>
          </InlineActionForm>
          <InlineActionForm
            action={setShowBirthdaysAction}
            submitLabel={showBirthdays ? "Showing" : "Hidden"}
            submitClassName="min-h-11"
          >
            <input type="hidden" name="show" value={showBirthdays ? "false" : "true"} />
          </InlineActionForm>
        </div>
        <p className="mt-2 text-xs text-[#0A3D45]/55">
          Own birthday plus accepted friends who set theirs. Toggle to hide from this view.
        </p>
      </div>

      {view === "list" ? (
        <section className="space-y-4">
          {byDay.length === 0 ? (
            <p className="tide-panel p-4 text-sm text-[#0A3D45]/60">
              Nothing in the selected kinds yet.
            </p>
          ) : (
            byDay.map(([day, dayEvents]) => (
              <div key={day}>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#0A3D45]/55">
                  {format(parseISO(day), "EEEE · MMM d, yyyy")}
                </h3>
                <ul className="space-y-2">
                  {dayEvents.map((event) => (
                    <EventRow key={event.id} event={event} />
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      ) : (
        <section className="tide-panel p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              className="tide-btn-secondary !min-h-9 text-sm"
              onClick={() => setMonthCursor((m) => subMonths(m, 1))}
            >
              Prev
            </button>
            <h3 className="font-[family-name:var(--font-display)] text-xl text-[#0A3D45]">
              {format(monthCursor, "MMMM yyyy")}
            </h3>
            <button
              type="button"
              className="tide-btn-secondary !min-h-9 text-sm"
              onClick={() => setMonthCursor((m) => addMonths(m, 1))}
            >
              Next
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[#0A3D45]/45 sm:text-xs">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {monthDays.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayEvents = filtered.filter((e) =>
                isSameDay(parseISO(e.date), day),
              );
              const inMonth = isSameMonth(day, monthCursor);
              return (
                <div
                  key={key}
                  className={`min-h-[4.5rem] rounded-lg border border-[#0A3D45]/8 p-1 sm:min-h-[5.5rem] sm:p-1.5 ${
                    inMonth ? "bg-white/50" : "bg-white/20 opacity-50"
                  }`}
                >
                  <p className="text-[11px] font-semibold text-[#0A3D45]/70">
                    {format(day, "d")}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, 3).map((event) => (
                      <li
                        key={event.id}
                        className={`truncate rounded px-1 py-0.5 text-[10px] font-semibold leading-tight ${KIND_META[event.kind].chip}`}
                        title={`${KIND_META[event.kind].label} · ${event.sourceLabel} · ${event.title}`}
                      >
                        {event.title}
                      </li>
                    ))}
                    {dayEvents.length > 3 ? (
                      <li className="text-[10px] text-[#0A3D45]/45">
                        +{dayEvents.length - 3}
                      </li>
                    ) : null}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function EventRow({ event }: { event: CalendarBoardEvent }) {
  const meta = KIND_META[event.kind];
  return (
    <li className="tide-panel relative overflow-hidden p-4 pl-5">
      <span
        className={`absolute inset-y-0 left-0 w-1 ${meta.bar}`}
        aria-hidden
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${meta.chip}`}
            >
              {meta.label}
            </span>
            <span className="text-xs text-[#0A3D45]/55">{event.sourceLabel}</span>
          </div>
          <p className="mt-1 font-semibold text-[#0A3D45]">{event.title}</p>
          {event.description ? (
            <p className="mt-1 text-sm text-[#0A3D45]/65">{event.description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {event.href ? (
            <Link href={event.href} className="tide-btn-secondary min-h-10 text-sm">
              Open
            </Link>
          ) : null}
          {event.canDelete && event.kind === "personal" ? (
            <InlineActionForm
              action={deletePersonalEventAction}
              submitLabel="Delete"
              submitClassName="min-h-10"
            >
              <input type="hidden" name="eventId" value={event.recordId} />
            </InlineActionForm>
          ) : null}
          {event.canDelete && event.kind === "workspace" ? (
            <InlineActionForm
              action={deleteWorkspaceEventAction}
              submitLabel="Delete"
              submitClassName="min-h-10"
            >
              <input type="hidden" name="eventId" value={event.recordId} />
            </InlineActionForm>
          ) : null}
        </div>
      </div>
    </li>
  );
}
