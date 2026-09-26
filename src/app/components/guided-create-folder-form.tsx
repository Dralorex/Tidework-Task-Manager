"use client";

import { useState } from "react";
import { InlineActionForm } from "@/app/components/forms";
import { TagSuggestInput } from "@/app/components/tag-suggest-input";
import { useWorkspaceOnboarding } from "@/app/components/workspace-onboarding-context";
import { createFolderAction } from "@/app/actions/tasks";
import { nextFolderCreateStep } from "@/lib/workspace-onboarding";

function blinkClass(on: boolean) {
  return on
    ? "animate-rowgon-blink-empty ring-2 ring-inset ring-[#3b82f6]/55"
    : "";
}

/** Remount when blink ends so Safari can’t leave a frozen blue fill. */
function blinkKey(on: boolean, id: string) {
  return on ? `${id}-blink` : id;
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
        type="text"
        inputMode="text"
        enterKeyHint="next"
        autoCapitalize="sentences"
        name="name"
        data-onboarding="folder-name"
        required
        placeholder="Folder Name"
        className={`rowgon-input text-sm ${blinkClass(showNameBlink)}`}
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
        <p className="text-[11px] text-[color:var(--rowgon-deep)]/55">
          Nesting under “{parentName}”
        </p>
      ) : null}

      {canSetAccess && track !== "short" ? (
        <>
          <div
            onInputCapture={() => {
              // Advance after the user types/picks a role — not on bare focus
              // from the “Pick Roles” info-prompt action.
              if (active && step === "folder-roles") advanceFrom("folder-roles");
            }}
          >
            <TagSuggestInput
              name="roles"
              tags={roleNames}
              placeholder="Roles (optional)"
              allowMultiple
              keepOpenOnPick
              dataOnboarding="folder-roles"
              inputClassName={`rowgon-input text-sm ${blinkClass(blink("folder-roles"))}`}
              emptyMessage={
                roleNames.length === 0
                  ? "No roles yet — create one in Roles first"
                  : "No matching roles"
              }
              hint={
                active
                  ? undefined
                  : "Leave empty for all members. Pick roles to restrict access."
              }
            />
          </div>
          <label
            className="flex cursor-pointer items-start gap-2 rounded-lg px-1 py-1 text-xs text-[color:var(--rowgon-deep)]"
            onClick={() => {
              if (active && step === "folder-hide") advanceFrom("folder-hide");
            }}
          >
            <span
              key={blinkKey(blink("folder-hide"), "folder-hide")}
              className={`mt-0.5 inline-flex shrink-0 rounded-md p-0.5 ${
                blink("folder-hide") ? "animate-rowgon-blink-ring" : ""
              }`}
            >
              <input
                type="checkbox"
                name="hideFromUnauthorized"
                value="1"
                className="mt-0"
                onChange={() => {
                  if (active && step === "folder-hide")
                    advanceFrom("folder-hide");
                }}
              />
            </span>
            <span>
              Hide from unauthorized
              <span className="mt-0.5 block text-[11px] font-normal text-[color:var(--rowgon-deep)]/50">
                Don’t show a locked folder to people without access.
              </span>
            </span>
          </label>
          <label
            className="flex cursor-pointer items-start gap-2 rounded-lg px-1 py-1 text-xs text-[color:var(--rowgon-deep)]"
            onClick={() => {
              if (active && step === "folder-always")
                advanceFrom("folder-always");
            }}
          >
            <span
              key={blinkKey(blink("folder-always"), "folder-always")}
              className={`mt-0.5 inline-flex shrink-0 rounded-md p-0.5 ${
                blink("folder-always") ? "animate-rowgon-blink-ring" : ""
              }`}
            >
              <input
                type="checkbox"
                name="alwaysVisible"
                value="1"
                className="mt-0"
                onChange={() => {
                  if (active && step === "folder-always")
                    advanceFrom("folder-always");
                }}
              />
            </span>
            <span>
              Always show
              <span className="mt-0.5 block text-[11px] font-normal text-[color:var(--rowgon-deep)]/50">
                Overrides hide rules — always visible (still locked without
                access).
              </span>
            </span>
          </label>
          <label
            className="flex cursor-pointer items-start gap-2 rounded-lg px-1 py-1 text-xs text-[color:var(--rowgon-deep)]"
            onClick={() => {
              if (active && step === "folder-accessible")
                advanceFrom("folder-accessible");
            }}
          >
            <span
              key={blinkKey(blink("folder-accessible"), "folder-accessible")}
              className={`mt-0.5 inline-flex shrink-0 rounded-md p-0.5 ${
                blink("folder-accessible") ? "animate-rowgon-blink-ring" : ""
              }`}
            >
              <input
                type="checkbox"
                name="alwaysAccessible"
                value="1"
                className="mt-0"
                onChange={() => {
                  if (active && step === "folder-accessible")
                    advanceFrom("folder-accessible");
                }}
              />
            </span>
            <span>
              Always accessible
              <span className="mt-0.5 block text-[11px] font-normal text-[color:var(--rowgon-deep)]/50">
                Anyone can open this folder even when roles are set.
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
