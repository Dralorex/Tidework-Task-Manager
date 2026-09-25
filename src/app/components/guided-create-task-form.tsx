"use client";

import { useEffect, useMemo, useState } from "react";
import { InlineActionForm } from "@/app/components/forms";
import { DueDateField } from "@/app/components/due-date-field";
import {
  OnboardingPrompt,
  OnboardingPromptBody,
} from "@/app/components/onboarding-prompt";
import { TagSuggestInput } from "@/app/components/tag-suggest-input";
import { useWorkspaceOnboarding } from "@/app/components/workspace-onboarding-context";
import { createTaskAction } from "@/app/actions/tasks";
import { PRIORITY_LABELS, TASK_PRIORITIES } from "@/lib/urgency";

function useIsPhoneLayout() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px), (pointer: coarse)");
    const sync = () => setPhone(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return phone;
}

const WEEKDAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

type Assignable = { id: string; username: string };

function blinkClass(on: boolean) {
  return on
    ? "animate-tide-blink-empty ring-2 ring-[#3b82f6]/45 ring-offset-1"
    : "";
}

/**
 * Create-task form with optional guided onboarding blinks + coach prompts.
 */
export function GuidedCreateTaskForm({
  workspaceId,
  folderId,
  publicTagOptions,
  assignableMembers,
}: {
  workspaceId: string;
  folderId: string;
  publicTagOptions: string[];
  assignableMembers: Assignable[];
}) {
  const { active, step, setStep, blink } = useWorkspaceOnboarding();
  const isPhone = useIsPhoneLayout();
  const [taskName, setTaskName] = useState("");
  const [nameClicked, setNameClicked] = useState(false);
  const [description, setDescription] = useState("");
  const [descClicked, setDescClicked] = useState(false);
  const [priority, setPriority] = useState("");
  const [duePickerOpen, setDuePickerOpen] = useState(false);
  const [cadence, setCadence] = useState<"" | "daily" | "weekly" | "monthly">(
    "",
  );
  const [weekDays, setWeekDays] = useState<number[]>([]);
  const [monthDays, setMonthDays] = useState<number[]>([]);
  const monthGrid = useMemo(
    () => Array.from({ length: 31 }, (_, i) => i + 1),
    [],
  );

  const promptLayer =
    isPhone || duePickerOpen ? ("foreground" as const) : ("inline" as const);

  const dueSheetPrompt =
    active && (step === "due-date" || duePickerOpen) ? (
      <OnboardingPromptBody
        title="Pick a due date"
        body="Optional — tap a day, or Clear / Done if you don’t need one. This tip stays on top of the calendar."
      />
    ) : null;

  function toggleWeek(day: number) {
    setWeekDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  }

  function toggleMonth(day: number) {
    setMonthDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort((a, b) => a - b),
    );
  }

  function pickCadence(value: "" | "daily" | "weekly" | "monthly") {
    setCadence(value);
    if (value === "daily") setWeekDays([0, 1, 2, 3, 4, 5, 6]);
    if (!active) return;
    if (value === "" && step === "one-off") setStep("one-off-info");
    if (value === "daily" && step === "daily") setStep("daily-info");
    if (value === "weekly" && step === "weekly") setStep("weekly-info");
    if (value === "monthly" && step === "monthly") setStep("monthly-info");
  }

  const showNameBlink = blink("task-name") && !nameClicked;
  const showDescBlink = blink("description") && !descClicked;

  return (
    <div className="space-y-3">
      <InlineActionForm
        className="grid min-w-0 gap-2 sm:grid-cols-2"
        action={createTaskAction}
        submitLabel="Add task"
        submitClassName={blinkClass(blink("submit"))}
      >
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <input type="hidden" name="folderId" value={folderId} />
        <input
          name="name"
          required
          placeholder="Task Name"
          className={`tide-input ${blinkClass(showNameBlink)}`}
          value={taskName}
          onFocus={() => setNameClicked(true)}
          onClick={() => setNameClicked(true)}
          onChange={(e) => {
            const v = e.target.value;
            setTaskName(v);
            if (active && step === "task-name" && v.trim().length > 0) {
              setStep("priority");
            }
          }}
        />

        <select
          name="priority"
          required
          value={priority}
          aria-label="Priority Level"
          className={`tide-input ${!priority ? "tide-input-hint" : ""} ${blinkClass(blink("priority"))}`}
          onFocus={() => {
            if (active && step === "priority") setStep("description");
          }}
          onClick={() => {
            if (active && step === "priority") setStep("description");
          }}
          onChange={(e) => {
            setPriority(e.target.value);
            if (active && step === "priority") setStep("description");
          }}
        >
          <option value="" disabled>
            Priority Level
          </option>
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>

        <input
          name="description"
          placeholder="Description"
          className={`tide-input sm:col-span-2 ${blinkClass(showDescBlink)}`}
          value={description}
          onFocus={() => setDescClicked(true)}
          onClick={() => setDescClicked(true)}
          onChange={(e) => {
            const v = e.target.value;
            setDescription(v);
            if (active && step === "description" && v.trim().length > 0) {
              setStep("due-date");
            }
          }}
        />

        <DueDateField
          name="dueDate"
          className="min-w-0"
          blink={blink("due-date")}
          blinkReset={blink("due-reset")}
          blinkClear={blink("due-clear")}
          sheetPrompt={dueSheetPrompt}
          onPickerOpenChange={(open) => {
            setDuePickerOpen(open);
            if (!open && active && step === "due-date" && isPhone) {
              setStep("due-reset");
            }
          }}
          onFieldActivate={() => {
            // Stay on due-date while the in-app calendar is open so the tip
            // remains the foreground coach; advance after close / Reset.
            if (active && step === "due-date" && !isPhone) {
              setStep("due-reset");
            }
          }}
          onReset={() => {
            if (active && (step === "due-reset" || step === "due-date")) {
              setStep("due-clear");
            }
          }}
          onClear={() => {
            if (active && (step === "due-clear" || step === "due-reset" || step === "due-date")) {
              setStep("claim-pool");
            }
          }}
        />

        <select
          name="assignTo"
          className={`tide-input ${blinkClass(blink("claim-pool"))}`}
          defaultValue=""
          onFocus={() => {
            if (active && step === "claim-pool") setStep("claim-pool-info");
          }}
          onClick={() => {
            if (active && step === "claim-pool") setStep("claim-pool-info");
          }}
        >
          <option value="">Claim pool (optional)</option>
          {assignableMembers.map((m) => (
            <option key={m.id} value={m.id}>
              Assign @{m.username}
            </option>
          ))}
        </select>

        <div
          className={`sm:col-span-2 rounded-xl ${blinkClass(blink("tags"))}`}
          onFocusCapture={() => {
            if (active && step === "tags") setStep("tags-info");
          }}
          onClick={() => {
            if (active && step === "tags") setStep("tags-info");
          }}
        >
          <TagSuggestInput
            name="tags"
            tags={publicTagOptions}
            placeholder="add tags: example, test, help"
            hint="Optional. Separate multiple tags with commas — same as Add Public Tag on a task."
            emptyMessage="No public tags in this folder yet — type a new one"
            allowMultiple
            keepOpenOnPick
          />
        </div>

        <div className="sm:col-span-2 space-y-3 rounded-xl border border-[#0A3D45]/10 bg-white/40 p-3">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["", "One-off", "one-off"],
                ["daily", "Daily", "daily"],
                ["weekly", "Weekly", "weekly"],
                ["monthly", "Monthly", "monthly"],
              ] as const
            ).map(([value, label, key]) => (
              <button
                key={label}
                type="button"
                onClick={() => pickCadence(value)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                  cadence === value
                    ? "bg-[#0A3D45] text-[#E8F7F6]"
                    : "bg-white/70 text-[#0A3D45]/70"
                } ${blinkClass(blink(key))}`}
              >
                {label}
              </button>
            ))}
          </div>
          <input type="hidden" name="recurrenceCadence" value={cadence} />
          <input
            type="hidden"
            name="recurrenceWeekDays"
            value={weekDays.join(",")}
          />
          <input
            type="hidden"
            name="recurrenceMonthDays"
            value={monthDays.join(",")}
          />

          {cadence === "weekly" ? (
            <div>
              <div className="mb-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="text-xs font-semibold text-[#1a7a82] underline-offset-2 hover:underline"
                  onClick={() => setWeekDays([0, 1, 2, 3, 4, 5, 6])}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="text-xs font-semibold text-[#1a7a82] underline-offset-2 hover:underline"
                  onClick={() => setWeekDays([])}
                >
                  Remove all
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((d) => {
                  const on = weekDays.includes(d.value);
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => toggleWeek(d.value)}
                      className={`min-h-10 min-w-10 rounded-lg px-2 text-sm font-semibold ${
                        on
                          ? "bg-[#3DBEAB] text-[#0A3D45]"
                          : "bg-white/70 text-[#0A3D45]/65"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {cadence === "monthly" ? (
            <div>
              <div className="mb-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="text-xs font-semibold text-[#1a7a82] underline-offset-2 hover:underline"
                  onClick={() => setMonthDays(monthGrid)}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="text-xs font-semibold text-[#1a7a82] underline-offset-2 hover:underline"
                  onClick={() => setMonthDays([])}
                >
                  Remove all
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthGrid.map((day) => {
                  const on = monthDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleMonth(day)}
                      className={`flex h-9 items-center justify-center rounded-md text-sm font-semibold ${
                        on
                          ? "bg-[#3DBEAB] text-[#0A3D45]"
                          : "bg-white/70 text-[#0A3D45]/65"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {cadence ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs font-semibold text-[#0A3D45]/70">
                Spawn next
                <select
                  name="recurrenceSpawnMode"
                  defaultValue="complete"
                  className="tide-input mt-1 min-h-11 text-sm"
                >
                  <option value="complete">On complete (approve)</option>
                  <option value="due">On due rollover</option>
                  <option value="both">Both</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-[#0A3D45]/70">
                Next assignee
                <select
                  name="recurrenceNextAssignee"
                  defaultValue="pool"
                  className="tide-input mt-1 min-h-11 text-sm"
                >
                  <option value="pool">Claim pool</option>
                  <option value="same">Same person</option>
                  <option value="clear">Cleared (no assignee)</option>
                </select>
              </label>
            </div>
          ) : null}
        </div>
      </InlineActionForm>

      {active && step === "due-date" && !duePickerOpen ? (
        <OnboardingPrompt
          title="Due date"
          body="Optional. Tap Due Date to open the calendar — the tip stays on top while you pick."
          layer={promptLayer}
        />
      ) : null}
      {active && step === "due-reset" && !duePickerOpen ? (
        <OnboardingPrompt
          title="Reset due date"
          body="This button will reset it to Today’s Date. Click Reset to continue, or Next."
          onNext={() => setStep("due-clear")}
          layer={promptLayer}
        />
      ) : null}
      {active && step === "due-clear" && !duePickerOpen ? (
        <OnboardingPrompt
          title="Clear due date"
          body="This button will clear any due date if you don’t want one. Click Clear to continue, or Next."
          onNext={() => setStep("claim-pool")}
          layer={promptLayer}
        />
      ) : null}
      {active && step === "claim-pool-info" ? (
        <OnboardingPrompt
          title="Claim pool"
          body="This is used to auto-assign any member to a task. Leave Claim pool (optional) unless you want a specific person."
          onNext={() => setStep("tags")}
          layer={promptLayer}
        />
      ) : null}
      {active && step === "tags-info" ? (
        <OnboardingPrompt
          title="Tags"
          body="Type a tag and pick from suggestions, or add several with commas. Later, use the Tag filter in search to find matching tasks."
          onNext={() => setStep("one-off")}
          layer={promptLayer}
        />
      ) : null}
      {active && step === "one-off-info" ? (
        <OnboardingPrompt
          title="One-off"
          body="A one-off task happens once — no automatic follow-up when it’s done."
          onNext={() => setStep("daily")}
          layer={promptLayer}
        />
      ) : null}
      {active && step === "daily-info" ? (
        <OnboardingPrompt
          title="Daily"
          body="Daily tasks spawn again on a schedule so recurring work doesn’t fall through the cracks."
          onNext={() => setStep("weekly")}
          layer={promptLayer}
        />
      ) : null}
      {active && step === "weekly-info" ? (
        <OnboardingPrompt
          title="Weekly"
          body="Weekly lets you pick which weekdays the task should repeat on."
          onNext={() => setStep("monthly")}
          layer={promptLayer}
        />
      ) : null}
      {active && step === "monthly-info" ? (
        <OnboardingPrompt
          title="Monthly"
          body="Monthly repeats on chosen days of the month — great for reports and check-ins."
          onNext={() => setStep("submit")}
          layer={promptLayer}
        />
      ) : null}
    </div>
  );
}
