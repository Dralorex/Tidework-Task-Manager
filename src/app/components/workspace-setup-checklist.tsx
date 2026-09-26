"use client";

import Link from "next/link";
import { OnboardingPrompt } from "@/app/components/onboarding-prompt";
import { useWorkspaceOnboarding } from "@/app/components/workspace-onboarding-context";

export function WorkspaceSetupChecklist({
  workspaceId,
  hasFolder,
  hasTask,
  hasInvite,
  canInvite,
  firstFolderId,
  inFolder,
}: {
  workspaceId: string;
  hasFolder: boolean;
  hasTask: boolean;
  hasInvite: boolean;
  canInvite: boolean;
  firstFolderId: string | null;
  inFolder: boolean;
}) {
  const {
    active,
    track,
    step,
    skipSection,
    completeOnboarding,
  } = useWorkspaceOnboarding();

  if (!active) return null;

  const steps = [
    {
      done: hasFolder,
      label: "Create a folder",
      hint:
        track === "short"
          ? "Open Folders, name it, and add it"
          : "Open Folders, then follow the blinking fields through Add folder",
    },
    {
      done: hasFolder && inFolder,
      label: "Open a folder",
      hint: "Click a folder card — if you made several, they’ll all blink until you pick one",
    },
    {
      done: hasTask,
      label: "Add a task",
      hint:
        track === "short"
          ? "Open Add Task, type a name, and submit"
          : "Expand Add Task and follow the guided highlights",
    },
    ...(canInvite
      ? [
          {
            done: hasInvite,
            label: "Invite someone (optional)",
            hint: "Share the invite link from the Invite panel — you can assign roles there too",
          },
        ]
      : []),
  ];

  return (
    <div className="rowgon-panel mt-6 border border-[#1a7a82]/25 p-5 animate-rowgon-rise">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[#0A3D45]">
            {track === "short" ? "Quick start" : "Get your workspace going"}
          </h2>
          <p className="mt-1 text-sm text-[#0A3D45]/70">
            {track === "short"
              ? "A few blinks — folder, open it, add a task."
              : "One folder, one task, and you’re in the claim → review loop."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={skipSection}
            className="text-sm font-medium text-[#1a7a82] underline-offset-2 hover:underline"
          >
            Skip this part
          </button>
          <button
            type="button"
            onClick={completeOnboarding}
            className="text-sm text-[#0A3D45]/55 hover:text-[#0A3D45] hover:underline"
          >
            I’ve already done onboarding
          </button>
        </div>
      </div>
      <ol className="mt-4 space-y-3">
        {steps.map((s) => (
          <li key={s.label} className="flex gap-3 text-sm">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                s.done
                  ? "bg-[#3DBEAB] text-[#0A3D45]"
                  : "bg-[#0A3D45]/10 text-[#0A3D45]/50"
              }`}
              aria-hidden
            >
              {s.done ? "✓" : ""}
            </span>
            <div>
              <p
                className={
                  s.done
                    ? "font-medium text-[#0A3D45]/55 line-through"
                    : "font-medium text-[#0A3D45]"
                }
              >
                {s.label}
              </p>
              <p className="text-[#0A3D45]/60">{s.hint}</p>
            </div>
          </li>
        ))}
      </ol>

      {step === "create-folder" ? (
        <OnboardingPrompt
          title="Tip: open a dropdown"
          body="Click the ▸ arrow or any empty space on the Folders header (the blue-blinking bar) to open it."
        />
      ) : null}

      {step === "folder-name" ? (
        <OnboardingPrompt
          title="Name your folder"
          body="The Folder Name field is blinking — click it and type something like “General”, then follow the next highlights."
        />
      ) : null}

      {step === "folder-roles" ? (
        <OnboardingPrompt
          title="Who can see this folder?"
          body="Roles is optional — leave empty for everyone, or pick roles to restrict access. Click the field (or skip past it) to continue."
        />
      ) : null}

      {step === "folder-hide" ? (
        <OnboardingPrompt
          title="Hide from unauthorized"
          body="Optional: hide locked folders from people without access. Toggle it or click past to keep going."
        />
      ) : null}

      {step === "folder-always" ? (
        <OnboardingPrompt
          title="Always show"
          body="Optional: keep the folder visible even when restricted. Toggle it or click past to continue."
        />
      ) : null}

      {step === "folder-accessible" ? (
        <OnboardingPrompt
          title="Always accessible"
          body="Optional: let anyone open this folder even when roles are set. Then hit Add folder."
        />
      ) : null}

      {step === "folder-submit" ? (
        <OnboardingPrompt
          title="Add the folder"
          body="The Add folder button is blinking — click it to create your first folder."
        />
      ) : null}

      {step === "open-folder" ? (
        <p className="mt-4 text-xs text-[#0A3D45]/55">
          Click a blinking folder card
          {firstFolderId ? (
            <>
              {" "}
              (or jump to{" "}
              <Link
                href={`/app/w/${workspaceId}?folder=${firstFolderId}`}
                className="font-medium underline underline-offset-2"
              >
                your first folder
              </Link>
              )
            </>
          ) : null}
          .
        </p>
      ) : null}

      {step === "open-add-task" ? (
        <OnboardingPrompt
          title="Open Add Task"
          body="Click the ▸ arrow or the blinking empty space on the Add Task bar to expand it."
        />
      ) : null}
    </div>
  );
}
