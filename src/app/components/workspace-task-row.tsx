"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { InlineActionForm } from "@/app/components/forms";
import { MenuSurface, menuItemClass } from "@/app/components/menu-surface";
import { PriorityBadge, TaskUrgencyEdge } from "@/app/components/task-ui";
import { UnclaimTaskControl } from "@/app/components/unclaim-task-control";
import {
  addPrivateTagAction,
  addPublicTagAction,
  claimTaskAction,
  completeTaskAction,
  forceUnclaimTaskAction,
  reviewTaskAction,
  updateTaskAction,
} from "@/app/actions/tasks";
import { personLabel } from "@/lib/utils";
import type { TaskPriority, TaskStatus } from "@/generated/prisma/client";

type Person = {
  id: string;
  username: string;
  nickname: string | null;
};

type TagLink = {
  tagId: string;
  tag: { name: string; isPublic: boolean };
};

export type WorkspaceTaskData = {
  id: string;
  name: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: Date | null;
  folderId: string;
  assigneeId: string | null;
  completionComment: string | null;
  lastUnclaimReason: string | null;
  lastUnclaimWorkNote: string | null;
  assignee: Person | null;
  lastUnclaimedBy: Person | null;
  folder: { id: string; name: string } | null;
  tags: TagLink[];
};

function dueInputValue(due: Date | null) {
  if (!due) return "";
  return format(due, "yyyy-MM-dd");
}

function TaskEditorMenu({
  workspaceId,
  task,
}: {
  workspaceId: string;
  task: WorkspaceTaskData;
}) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"menu" | "edit" | "forceUnclaim">("menu");
  const [name, setName] = useState(task.name);
  const [description, setDescription] = useState(task.description);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [dueDate, setDueDate] = useState(dueInputValue(task.dueDate));
  const [reason, setReason] = useState("");
  const [workNote, setWorkNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    setName(task.name);
    setDescription(task.description);
    setPriority(task.priority);
    setDueDate(dueInputValue(task.dueDate));
  }, [task.name, task.description, task.priority, task.dueDate]);

  function close() {
    setOpen(false);
    setPanel("menu");
    setError(null);
    setReason("");
    setWorkNote("");
  }

  function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("workspaceId", workspaceId);
      fd.set("taskId", task.id);
      fd.set("name", name.trim());
      fd.set("description", description.trim());
      fd.set("priority", priority);
      fd.set("dueDate", dueDate);
      const result = await updateTaskAction(null, fd);
      if (result && !result.ok) {
        setError(result.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  function forceUnclaim(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("workspaceId", workspaceId);
      fd.set("taskId", task.id);
      fd.set("reason", reason.trim());
      fd.set("workNote", workNote.trim());
      const result = await forceUnclaimTaskAction(null, fd);
      if (result && !result.ok) {
        setError(result.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <MenuSurface
      open={open}
      onClose={close}
      widthClass="w-72"
      trigger={({ ref }) => (
        <button
          ref={ref}
          type="button"
          aria-label="Task options"
          aria-expanded={open}
          className="rounded-md px-1.5 py-0.5 text-[#0A3D45]/70 transition hover:bg-[#0A3D45]/8 hover:text-[#0A3D45]"
          onClick={() => {
            setOpen((v) => !v);
            setPanel("menu");
            setError(null);
          }}
        >
          ···
        </button>
      )}
    >
      {panel === "menu" ? (
        <>
          <button
            type="button"
            role="menuitem"
            className={menuItemClass()}
            onClick={() => setPanel("edit")}
          >
            Rename / modify
          </button>
          {task.assigneeId && task.status !== "DONE" ? (
            <button
              type="button"
              role="menuitem"
              className={menuItemClass(true)}
              onClick={() => setPanel("forceUnclaim")}
            >
              Force unclaim
            </button>
          ) : null}
        </>
      ) : null}

      {panel === "edit" ? (
        <form className="space-y-2 px-3 py-2" onSubmit={saveEdit}>
          <p className="text-xs font-semibold text-[#0A3D45]">Edit task</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="tide-input w-full text-sm"
            placeholder="Task name"
            required
            autoFocus
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="tide-input min-h-[4rem] w-full text-sm"
            placeholder="Description"
          />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            className="tide-input w-full text-sm"
          >
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="tide-input w-full text-sm"
          />
          {error ? <p className="text-xs text-[#9b2f22]">{error}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              className="text-xs text-[#0A3D45]/60"
              onClick={() => setPanel("menu")}
            >
              Back
            </button>
            <button
              type="submit"
              disabled={pending}
              className="text-xs font-semibold text-[#0A3D45]"
            >
              Save
            </button>
          </div>
        </form>
      ) : null}

      {panel === "forceUnclaim" ? (
        <form className="space-y-2 px-3 py-2" onSubmit={forceUnclaim}>
          <p className="text-xs font-semibold text-[#0A3D45]">Force unclaim</p>
          <p className="text-[11px] text-[#0A3D45]/60">
            Removes{" "}
            {task.assignee ? personLabel(task.assignee) : "the assignee"} and
            returns the task to open.
          </p>
          <input
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="tide-input w-full text-sm"
            placeholder="Reason"
            autoFocus
          />
          <textarea
            value={workNote}
            onChange={(e) => setWorkNote(e.target.value)}
            className="tide-input min-h-[3.5rem] w-full text-sm"
            placeholder="Optional notes for the next person"
          />
          {error ? <p className="text-xs text-[#9b2f22]">{error}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              className="text-xs text-[#0A3D45]/60"
              onClick={() => setPanel("menu")}
            >
              Back
            </button>
            <button
              type="submit"
              disabled={pending}
              className="text-xs font-semibold text-[#9b2f22]"
            >
              Confirm
            </button>
          </div>
        </form>
      ) : null}
    </MenuSurface>
  );
}

export function WorkspaceTaskRow({
  workspaceId,
  task,
  userId,
  canEdit,
  isRoot,
}: {
  workspaceId: string;
  task: WorkspaceTaskData;
  userId: string;
  canEdit: boolean;
  isRoot: boolean;
}) {
  const isClaimed = Boolean(task.assigneeId);
  const [expanded, setExpanded] = useState(!isClaimed);

  useEffect(() => {
    setExpanded(!isClaimed);
  }, [isClaimed, task.id]);

  return (
    <li className="tide-panel relative overflow-hidden p-4 pl-5">
      <TaskUrgencyEdge priority={task.priority} dueDate={task.dueDate} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {isClaimed ? (
              <button
                type="button"
                aria-expanded={expanded}
                aria-label={expanded ? "Hide task details" : "Show task details"}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#0A3D45]/70 transition hover:bg-[#0A3D45]/8"
                onClick={() => setExpanded((v) => !v)}
              >
                <span className="text-sm leading-none" aria-hidden>
                  {expanded ? "▾" : "▸"}
                </span>
              </button>
            ) : null}
            <h3 className="text-lg font-semibold text-[#0A3D45]">{task.name}</h3>
            {isClaimed && !expanded ? (
              <span className="text-xs text-[#0A3D45]/60">
                claimed by{" "}
                {task.assignee ? personLabel(task.assignee) : "someone"}
              </span>
            ) : (
              <>
                <PriorityBadge priority={task.priority} />
                <span className="text-xs uppercase tracking-wide text-[#0A3D45]/50">
                  {task.status.replace("_", " ")}
                </span>
              </>
            )}
          </div>

          {expanded ? (
            <>
              {isRoot && task.folder ? (
                <p className="mt-1 text-xs text-[#0A3D45]/55">
                  In{" "}
                  <Link
                    href={`/app/w/${workspaceId}?folder=${task.folderId}`}
                    className="font-semibold underline-offset-2 hover:underline"
                  >
                    {task.folder.name}
                  </Link>
                </p>
              ) : null}
              {task.description ? (
                <p className="mt-1 text-sm text-[#0A3D45]/70">{task.description}</p>
              ) : null}
              <p className="mt-2 text-xs text-[#0A3D45]/55">
                {task.dueDate
                  ? `Due ${format(task.dueDate, "MMM d, yyyy")}`
                  : "No due date"}
                {task.assignee
                  ? ` · claimed by ${personLabel(task.assignee)}`
                  : " · unclaimed"}
              </p>
              {!task.assignee && task.lastUnclaimReason ? (
                <div className="mt-2 rounded-md bg-[#0A3D45]/[0.04] px-2.5 py-2 text-xs text-[#0A3D45]/75">
                  <p>
                    <span className="font-semibold">Unclaim reason:</span>{" "}
                    {task.lastUnclaimReason}
                    {task.lastUnclaimedBy
                      ? ` — ${personLabel(task.lastUnclaimedBy)}`
                      : ""}
                  </p>
                  {task.lastUnclaimWorkNote ? (
                    <p className="mt-1">
                      <span className="font-semibold">Work notes:</span>{" "}
                      {task.lastUnclaimWorkNote}
                    </p>
                  ) : null}
                </div>
              ) : null}
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
            </>
          ) : null}
        </div>

        <div className="flex shrink-0 items-start gap-2">
          {canEdit ? (
            <TaskEditorMenu workspaceId={workspaceId} task={task} />
          ) : null}
        </div>
      </div>

      {expanded ? (
        <>
          <div className="mt-3 flex flex-col items-stretch gap-2 sm:items-end">
            {task.status === "OPEN" ||
            (task.status === "CLAIMED" && !task.assigneeId) ? (
              <InlineActionForm action={claimTaskAction} submitLabel="Pick up">
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="taskId" value={task.id} />
              </InlineActionForm>
            ) : null}

            {task.assigneeId === userId &&
            (task.status === "CLAIMED" || task.status === "OPEN") ? (
              <InlineActionForm
                action={completeTaskAction}
                submitLabel="Ready for review"
              >
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="taskId" value={task.id} />
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
                <InlineActionForm
                  action={reviewTaskAction}
                  submitLabel="Approve"
                >
                  <input type="hidden" name="workspaceId" value={workspaceId} />
                  <input type="hidden" name="taskId" value={task.id} />
                  <input type="hidden" name="decision" value="approve" />
                </InlineActionForm>
                <InlineActionForm
                  action={reviewTaskAction}
                  submitLabel="Send back"
                >
                  <input type="hidden" name="workspaceId" value={workspaceId} />
                  <input type="hidden" name="taskId" value={task.id} />
                  <input type="hidden" name="decision" value="reopen" />
                </InlineActionForm>
              </div>
            ) : null}

            {task.assigneeId === userId ? (
              <InlineActionForm
                action={addPrivateTagAction}
                submitLabel="Private tag"
              >
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="taskId" value={task.id} />
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
                action={addPublicTagAction}
                submitLabel="Public tag"
              >
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="taskId" value={task.id} />
                <input
                  name="name"
                  required
                  placeholder="design"
                  className="tide-input text-sm"
                />
              </InlineActionForm>
            ) : null}
          </div>

          {task.assigneeId === userId &&
          (task.status === "CLAIMED" || task.status === "OPEN") ? (
            <div className="mt-3 flex justify-start">
              <UnclaimTaskControl workspaceId={workspaceId} taskId={task.id} />
            </div>
          ) : null}
        </>
      ) : null}
    </li>
  );
}
