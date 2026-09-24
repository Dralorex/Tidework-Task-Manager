"use client";

import { useState } from "react";
import { format } from "date-fns";
import { InlineActionForm } from "@/app/components/forms";
import { PriorityBadge, TaskUrgencyEdge } from "@/app/components/task-ui";
import {
  addChecklistItemAction,
  addPrivateTagAction,
  addPublicTagAction,
  assignTaskAction,
  claimTaskAction,
  completeTaskAction,
  reviewTaskAction,
  toggleChecklistItemForm,
  unclaimTaskAction,
} from "@/app/actions/tasks";
import type { TaskPriority, TaskStatus } from "@/generated/prisma/client";

export type WorkspaceTaskRowData = {
  id: string;
  name: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  completionComment: string | null;
  assigneeId: string | null;
  assigneeUsername: string | null;
  folderId: string;
  folderName: string;
  recurrenceCadence: string | null;
  tags: { tagId: string; name: string; isPublic: boolean }[];
  checklist: { id: string; label: string; done: boolean }[];
  activities: { id: string; message: string; createdAt: string; type: string }[];
};

export type AssignableMember = {
  id: string;
  username: string;
};

export function WorkspaceTaskRow({
  task,
  workspaceId,
  userId,
  canEdit,
  showFolder,
  assignableMembers = [],
}: {
  task: WorkspaceTaskRowData;
  workspaceId: string;
  userId: string;
  canEdit: boolean;
  showFolder?: boolean;
  assignableMembers?: AssignableMember[];
}) {
  const [approveOpen, setApproveOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const isAssignee = task.assigneeId === userId;
  const isOpenAssigned = task.status === "OPEN" && Boolean(task.assigneeId);
  const assignedToOther =
    task.status === "OPEN" &&
    Boolean(task.assigneeId) &&
    task.assigneeId !== userId;
  const canClaim =
    !assignedToOther &&
    (task.status === "OPEN" || (task.status === "CLAIMED" && !task.assigneeId));
  const canComplete =
    isAssignee && (task.status === "CLAIMED" || task.status === "OPEN");
  const canChecklist = isAssignee && task.status === "CLAIMED";
  const dueLabel = task.dueDate
    ? `Due ${format(new Date(task.dueDate), "MMM d, yyyy")}`
    : "No due date";

  const claimLabel = isOpenAssigned && isAssignee ? "Claim assignment" : "Claim";
  const ownerLine = isOpenAssigned
    ? `Assigned to @${task.assigneeUsername}`
    : task.assigneeUsername
      ? `claimed by @${task.assigneeUsername}`
      : "unclaimed";

  return (
    <li className="tide-panel relative overflow-hidden p-4 pl-5 sm:p-5 sm:pl-6">
      <TaskUrgencyEdge priority={task.priority} dueDate={task.dueDate ? new Date(task.dueDate) : null} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold leading-snug text-[#0A3D45] sm:text-xl">
              {task.name}
            </h3>
            <PriorityBadge priority={task.priority} />
            <span className="rounded-md bg-[#0A3D45]/8 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#0A3D45]/65">
              {task.status.replace("_", " ")}
            </span>
            {showFolder ? (
              <span className="text-xs text-[#0A3D45]/55">{task.folderName}</span>
            ) : null}
            {task.recurrenceCadence ? (
              <span className="rounded-md bg-[#1a7a82]/12 px-2 py-0.5 text-[11px] font-semibold capitalize text-[#0A3D45]">
                Repeats {task.recurrenceCadence}
              </span>
            ) : null}
          </div>

          {task.description ? (
            <p className="mt-1 text-sm text-[#0A3D45]/70">{task.description}</p>
          ) : null}

          <p className="mt-2 text-xs text-[#0A3D45]/55 sm:text-sm">
            {dueLabel}
            {" · "}
            <span className={isOpenAssigned ? "font-semibold text-[#0A3D45]" : ""}>
              {ownerLine}
            </span>
          </p>

          {task.completionComment ? (
            <p className="mt-1 text-xs italic text-[#0A3D45]/65 sm:text-sm">
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
                  #{tt.name}
                  {!tt.isPublic ? " (private)" : ""}
                </span>
              ))}
            </div>
          ) : null}

          {(canChecklist || task.checklist.length > 0) && (
            <div className="mt-3 rounded-xl border border-[#0A3D45]/10 bg-white/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#0A3D45]/55">
                Checklist
              </p>
              <ul className="mt-2 space-y-2">
                {task.checklist.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 text-sm text-[#0A3D45]">
                    {canChecklist ? (
                      <form action={toggleChecklistItemForm} className="flex min-w-0 flex-1 items-center gap-2">
                        <input type="hidden" name="workspaceId" value={workspaceId} />
                        <input type="hidden" name="taskId" value={task.id} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <button
                          type="submit"
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-sm ${
                            item.done
                              ? "border-[#3DBEAB] bg-[#3DBEAB]/25 text-[#0A3D45]"
                              : "border-[#0A3D45]/25 bg-white/70 text-transparent"
                          }`}
                          aria-label={item.done ? "Mark incomplete" : "Mark complete"}
                        >
                          ✓
                        </button>
                        <span
                          className={
                            item.done
                              ? "min-w-0 text-[#0A3D45]/45 line-through"
                              : "min-w-0 text-[#0A3D45]"
                          }
                        >
                          {item.label}
                        </span>
                      </form>
                    ) : (
                      <span
                        className={
                          item.done ? "text-[#0A3D45]/45 line-through" : "text-[#0A3D45]"
                        }
                      >
                        {item.done ? "✓ " : "○ "}
                        {item.label}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {canChecklist ? (
                <InlineActionForm
                  className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center"
                  action={addChecklistItemAction}
                  submitLabel="Add item"
                  submitClassName="w-full sm:w-auto"
                >
                  <input type="hidden" name="workspaceId" value={workspaceId} />
                  <input type="hidden" name="taskId" value={task.id} />
                  <input
                    name="label"
                    required
                    placeholder="Checklist step"
                    className="tide-input text-sm"
                  />
                </InlineActionForm>
              ) : null}
              <p className="mt-2 text-[11px] text-[#0A3D45]/45">
                Checkmarks stay local — no admin ping until you send for review.
              </p>
            </div>
          )}

          <div className="mt-3">
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              className="text-xs font-semibold text-[#0A3D45]/65 underline-offset-2 hover:underline sm:text-sm"
            >
              {historyOpen ? "Hide history" : "History"}
              {task.activities.length > 0 ? ` (${task.activities.length})` : ""}
            </button>
            {historyOpen ? (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-[#0A3D45]/10 bg-white/50 p-3">
                {task.activities.length === 0 ? (
                  <p className="text-xs text-[#0A3D45]/55">No history yet.</p>
                ) : (
                  <ul className="space-y-2 text-xs text-[#0A3D45]/75">
                    {task.activities.map((a) => (
                      <li key={a.id} className="border-b border-[#0A3D45]/6 pb-2 last:border-0 last:pb-0">
                        <p>{a.message}</p>
                        <p className="mt-0.5 text-[10px] text-[#0A3D45]/45">
                          {format(new Date(a.createdAt), "MMM d, yyyy · h:mm a")}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 lg:w-56 lg:shrink-0">
          {canClaim ? (
            <InlineActionForm
              action={claimTaskAction}
              submitLabel={claimLabel}
              submitVariant="primary"
              submitClassName="w-full min-h-11"
              className="flex flex-col gap-2"
            >
              <input type="hidden" name="workspaceId" value={workspaceId} />
              <input type="hidden" name="taskId" value={task.id} />
            </InlineActionForm>
          ) : null}

          {assignedToOther ? (
            <p className="rounded-xl bg-[#0A3D45]/6 px-3 py-2 text-center text-xs font-semibold text-[#0A3D45]/70">
              Assigned to @{task.assigneeUsername} — claim locked
            </p>
          ) : null}

          {canEdit && task.status === "OPEN" && assignableMembers.length > 0 ? (
            <InlineActionForm
              action={assignTaskAction}
              submitLabel={task.assigneeId ? "Update assign" : "Auto-assign"}
              submitClassName="w-full min-h-11"
              className="flex flex-col gap-2"
            >
              <input type="hidden" name="workspaceId" value={workspaceId} />
              <input type="hidden" name="taskId" value={task.id} />
              <select
                name="assignTo"
                className="tide-input min-h-11 text-sm"
                defaultValue={task.assigneeId ?? ""}
              >
                <option value="">Claim pool (anyone)</option>
                {assignableMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    @{m.username}
                  </option>
                ))}
              </select>
            </InlineActionForm>
          ) : null}

          {canComplete ? (
            <InlineActionForm
              action={completeTaskAction}
              submitLabel="Ready for review"
              submitVariant="primary"
              submitClassName="w-full min-h-11"
              className="flex flex-col gap-2"
            >
              <input type="hidden" name="workspaceId" value={workspaceId} />
              <input type="hidden" name="taskId" value={task.id} />
              <textarea
                name="comment"
                required
                rows={3}
                placeholder="What did you complete?"
                className="tide-input min-h-[5.5rem] text-sm"
              />
            </InlineActionForm>
          ) : null}

          {isAssignee && task.status === "CLAIMED" ? (
            <InlineActionForm
              action={unclaimTaskAction}
              submitLabel="Unclaim"
              submitClassName="w-full min-h-11"
            >
              <input type="hidden" name="workspaceId" value={workspaceId} />
              <input type="hidden" name="taskId" value={task.id} />
            </InlineActionForm>
          ) : null}

          {task.status === "IN_REVIEW" && canEdit ? (
            <div className="flex flex-col gap-2">
              {!approveOpen ? (
                <button
                  type="button"
                  onClick={() => setApproveOpen(true)}
                  className="tide-btn-primary min-h-11 w-full text-sm"
                >
                  Approve
                </button>
              ) : (
                <InlineActionForm
                  action={reviewTaskAction}
                  submitLabel="Confirm approve"
                  submitVariant="primary"
                  submitClassName="w-full min-h-11"
                  className="flex flex-col gap-2 rounded-xl border border-[#3DBEAB]/35 bg-[#3DBEAB]/10 p-3"
                >
                  <input type="hidden" name="workspaceId" value={workspaceId} />
                  <input type="hidden" name="taskId" value={task.id} />
                  <input type="hidden" name="decision" value="approve" />
                  <label className="text-xs font-medium text-[#0A3D45]/70">
                    Optional comment
                    <textarea
                      name="approveComment"
                      rows={2}
                      placeholder="Nice work…"
                      className="tide-input mt-1 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setApproveOpen(false)}
                    className="text-xs text-[#0A3D45]/60 underline-offset-2 hover:underline"
                  >
                    Cancel
                  </button>
                </InlineActionForm>
              )}

              <InlineActionForm
                action={reviewTaskAction}
                submitLabel="Send back"
                submitClassName="w-full min-h-11"
                className="flex flex-col gap-2"
              >
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="taskId" value={task.id} />
                <input type="hidden" name="decision" value="reopen" />
                <textarea
                  name="reason"
                  required
                  rows={2}
                  placeholder="Why send back?"
                  className="tide-input text-sm"
                />
              </InlineActionForm>
            </div>
          ) : null}

          {isAssignee ? (
            <details className="rounded-xl border border-[#0A3D45]/10 bg-white/30 p-2">
              <summary className="cursor-pointer text-xs font-semibold text-[#0A3D45]/60">
                Private tag
              </summary>
              <InlineActionForm
                className="mt-2 flex flex-col gap-2"
                action={addPrivateTagAction}
                submitLabel="Add"
                submitClassName="w-full min-h-10"
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
            </details>
          ) : null}

          {canEdit ? (
            <details className="rounded-xl border border-[#0A3D45]/10 bg-white/30 p-2">
              <summary className="cursor-pointer text-xs font-semibold text-[#0A3D45]/60">
                Public tag
              </summary>
              <InlineActionForm
                className="mt-2 flex flex-col gap-2"
                action={addPublicTagAction}
                submitLabel="Add"
                submitClassName="w-full min-h-10"
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
            </details>
          ) : null}
        </div>
      </div>
    </li>
  );
}
