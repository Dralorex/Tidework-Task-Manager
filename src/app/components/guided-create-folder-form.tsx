"use client";

import { useState } from "react";
import { InlineActionForm } from "@/app/components/forms";
import { TagSuggestInput } from "@/app/components/tag-suggest-input";
import { useWorkspaceOnboarding } from "@/app/components/workspace-onboarding-context";
import { createFolderAction } from "@/app/actions/tasks";
import { nextFolderCreateStep } from "@/lib/workspace-onboarding";

function blinkClass(on: boolean) {
  return on
    ? "animate-tide-blink-empty ring-2 ring-inset ring-[#3b82f6]/55"
    : "";
}

/** Create-folder form with guided onboarding blinks (mirrors Add Task tour). */
export function GuidedCreateFolderForm({
  workspaceId,
  parentId,
  parentName,
  roleNames,
  canSetAccess,
}: {
  workspaceId: string;
  parentId?: string | null;
  parentName?: string | null;
  roleNames: string[];
  canSetAccess: boolean;
}) {
  const { active, step, setStep, blink, track } = useWorkspaceOnboarding();
  const [name, setName] = useState("");
  const [nameClicked, setNameClicked] = useState(false);

  function advanceFrom(current: typeof step) {
    if (!active) return;
    if (track === "short") {
      if (current === "folder-name") setStep("folder-submit");
      return;
    }
    setStep(nextFolderCreateStep(current, canSetAccess));
  }

  const showNameBlink = blink("folder-name") && !nameClicked;

  return (
    <InlineActionForm
      className="flex flex-col gap-2"
      action={createFolderAction}
      submitLabel="Add folder"
      submitClassName={blinkClass(blink("folder-submit"))}
    >
      <input type="hidden" name="workspaceId" value={workspaceId} />
      {parentId ? <input type="hidden" name="parentId" value={parentId} /> : null}
      <input
        name="name"
        required
        placeholder="Folder Name"
        className={`tide-input text-sm ${blinkClass(showNameBlink)}`}
        value={name}
        onFocus={() => setNameClicked(true)}
        onClick={() => setNameClicked(true)}
        onChange={(e) => {
          const v = e.target.value;
          setName(v);
          if (active && step === "folder-name" && v.trim().length > 0) {
            advanceFrom("folder-name");
          }
        }}
      />
      {parentName ? (
        <p className="text-[11px] text-[color:var(--tide-deep)]/55">
          Nesting under “{parentName}”
        </p>
      ) : null}

      {canSetAccess && track !== "short" ? (
        <>
          <div
            className={`rounded-xl ${blinkClass(blink("folder-roles"))}`}
            onFocusCapture={() => {
              if (active && step === "folder-roles") advanceFrom("folder-roles");
            }}
            onClick={() => {
              if (active && step === "folder-roles") advanceFrom("folder-roles");
            }}
          >
            <TagSuggestInput
              name="roles"
              tags={roleNames}
              placeholder="Roles (optional)"
              allowMultiple
              keepOpenOnPick
              emptyMessage={
                roleNames.length === 0
                  ? "No roles yet — create one in Roles first"
                  : "No matching roles"
              }
              hint="Leave empty for all members. Pick roles to restrict access."
            />
          </div>
          <label
            className={`flex cursor-pointer items-start gap-2 rounded-lg px-1 py-1 text-xs text-[color:var(--tide-deep)] ${blinkClass(blink("folder-hide"))}`}
            onClick={() => {
              if (active && step === "folder-hide") advanceFrom("folder-hide");
            }}
          >
            <input
              type="checkbox"
              name="hideFromUnauthorized"
              value="1"
              className="mt-0.5"
              onChange={() => {
                if (active && step === "folder-hide") advanceFrom("folder-hide");
              }}
            />
            <span>
              Hide from unauthorized
              <span className="mt-0.5 block text-[11px] font-normal text-[color:var(--tide-deep)]/50">
                Don’t show a locked folder to people without access.
              </span>
            </span>
          </label>
          <label
            className={`flex cursor-pointer items-start gap-2 rounded-lg px-1 py-1 text-xs text-[color:var(--tide-deep)] ${blinkClass(blink("folder-always"))}`}
            onClick={() => {
              if (active && step === "folder-always")
                advanceFrom("folder-always");
            }}
          >
            <input
              type="checkbox"
              name="alwaysVisible"
              value="1"
              className="mt-0.5"
              onChange={() => {
                if (active && step === "folder-always")
                  advanceFrom("folder-always");
              }}
            />
            <span>
              Always show
              <span className="mt-0.5 block text-[11px] font-normal text-[color:var(--tide-deep)]/50">
                Overrides hide rules — always visible (still locked without
                access).
              </span>
            </span>
          </label>
        </>
      ) : canSetAccess ? (
        // Short track: still submit roles fields as empty / unused
        null
      ) : null}
    </InlineActionForm>
  );
}
