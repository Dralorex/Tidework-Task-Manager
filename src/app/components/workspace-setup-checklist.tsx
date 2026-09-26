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
    setStep,
    skipSection,
    completeOnboarding,
    canManageRoles,
    hasRole,
  } = useWorkspaceOnboarding();

  if (!active) return null;

  const showRolesTour = track === "full" && canManageRoles;

  const steps = [
    ...(showRolesTour
      ? [
          {
            done: hasRole,
            label: "Create a role",
            hint: "Open Roles in the sidebar, name one, create it — then you’ll attach it to a folder next",
          },
        ]
      : []),
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
              : showRolesTour
                ? "Roles first (so folders can use them), then a folder, a task, and the claim → review loop."
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

      {step === "roles-open" ? (
        <OnboardingPrompt
          title="Start with Roles"
          body="Custom roles decide who can open which folders. Click the blinking Roles header in the left sidebar (▸) to open it."
        />
      ) : null}

      {step === "roles-intro" ? (
        <OnboardingPrompt
          title="What roles are for"
          body="A role is a label like Design or Finance. You’ll attach roles to folders to lock them, and later to people so they can open those folders. Built-in privileges (Owner / Admin / Editor / Member) stay separate."
          onNext={() => setStep("roles-name")}
        />
      ) : null}

      {step === "roles-name" ? (
        <OnboardingPrompt
          title="Name a role"
          body="The New role name field is blinking — type something short like “Design”, “Ops”, or “Client”. You’ll use this name when restricting a folder."
        />
      ) : null}

      {step === "roles-create" ? (
        <OnboardingPrompt
          title="Create the role"
          body="Create role is blinking — click it to save. Nothing is restricted yet; you’re just defining the label."
        />
      ) : null}

      {step === "roles-list" ? (
        <OnboardingPrompt
          title="Your role is ready"
          body="It shows in the list with a member count. Next we’ll cover the optional “Hide folders with this role” switch."
          onNext={() => setStep("roles-hide")}
        />
      ) : null}

      {step === "roles-hide" ? (
        <OnboardingPrompt
          title="Hide folders with this role"
          body="Optional. When checked, people without this role won’t even see folders that require it (instead of seeing a locked folder). Toggle it or hit Next."
          onNext={() => setStep("roles-hide-info")}
        />
      ) : null}

      {step === "roles-hide-info" ? (
        <OnboardingPrompt
          title="When to hide"
          body="Use hide for private areas (HR, client-only). Leave it off if you want everyone to see the folder name but only role-holders can open it. You can change this anytime."
          onNext={() => setStep("roles-assign-info")}
        />
      ) : null}

      {step === "roles-assign-info" ? (
        <OnboardingPrompt
          title="Giving people a role"
          body="Open a member’s ··· menu → Custom roles to check this role for them. When you invite someone, you can also assign roles later the same way. Without the role, restricted folders stay locked (or hidden)."
          onNext={() => setStep("roles-folder-bridge")}
        />
      ) : null}

      {step === "roles-folder-bridge" ? (
        <OnboardingPrompt
          title="Next: put the role on a folder"
          body="We’ll create a folder next. On the Roles field, pick the role you just made to restrict that folder — or leave it empty for everyone."
          onNext={() => setStep("create-folder")}
        />
      ) : null}

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
          body={
            hasRole
              ? "Pick the role you created (or leave empty for everyone). This is how folder access uses the Roles panel. Click the field or continue past it."
              : "Roles is optional — leave empty for everyone, or pick roles to restrict access. Click the field (or skip past it) to continue."
          }
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

      {step === "claim-pool" ? (
        <OnboardingPrompt
          title="Claim pool"
          body="Claim Pool (optional) is blinking in Add Task. Open it if you want to assign someone now, or Next to learn what it does."
          onNext={() => setStep("claim-pool-info")}
        />
      ) : null}

      {step === "claim-pool-info" ? (
        <OnboardingPrompt
          title="What Claim pool does"
          body="Leave it on Claim Pool (optional) so anyone can claim the task. Pick a person only when you want it auto-assigned. Then Next to continue to tags."
          onNext={() => setStep("tags")}
        />
      ) : null}
    </div>
  );
}
