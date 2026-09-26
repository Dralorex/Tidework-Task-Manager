/** Guided first-session steps inside a workspace. */
export type WorkspaceOnboardingStep =
  | "create-folder"
  | "folder-name"
  | "folder-roles"
  | "folder-hide"
  | "folder-always"
  | "folder-submit"
  | "open-folder"
  | "open-add-task"
  | "task-name"
  | "priority"
  | "description"
  | "due-date"
  | "due-reset"
  | "due-clear"
  | "claim-pool"
  | "claim-pool-info"
  | "tags"
  | "tags-info"
  | "one-off"
  | "one-off-info"
  | "daily"
  | "daily-info"
  | "weekly"
  | "weekly-info"
  | "monthly"
  | "monthly-info"
  | "task-menu-info"
  | "submit"
  | "done";

/** High-level course choice after the welcome chooser. */
export type OnboardingTrack = "full" | "short";

export type OnboardingPrefStatus =
  | "unset"
  | "full"
  | "short"
  | "declined"
  | "completed";

export type OnboardingPreference = {
  status: OnboardingPrefStatus;
  /** Distinguish “No.” vs “I’m all set” when declined. */
  declineKind?: "hard" | "soft";
  track?: OnboardingTrack;
  updatedAt?: string;
};

export const SETUP_DISMISS_KEY = (workspaceId: string) =>
  `rowgon-setup-dismissed:${workspaceId}`;

export const FOLDERS_OPEN_KEY = (workspaceId: string) =>
  `rowgon-folders-open:${workspaceId}`;

export const ONBOARDING_STEP_KEY = (workspaceId: string) =>
  `rowgon-onboarding-step:${workspaceId}`;

/** User-scoped preference (survives workspace switches). */
export const ONBOARDING_PREF_KEY = "rowgon-onboarding-pref:v1";

const ALL_STEPS: WorkspaceOnboardingStep[] = [
  "create-folder",
  "folder-name",
  "folder-roles",
  "folder-hide",
  "folder-always",
  "folder-submit",
  "open-folder",
  "open-add-task",
  "task-name",
  "priority",
  "description",
  "due-date",
  "due-reset",
  "due-clear",
  "claim-pool",
  "claim-pool-info",
  "tags",
  "tags-info",
  "one-off",
  "one-off-info",
  "daily",
  "daily-info",
  "weekly",
  "weekly-info",
  "monthly",
  "monthly-info",
  "task-menu-info",
  "submit",
  "done",
];

const FOLDER_CREATE_STEPS: WorkspaceOnboardingStep[] = [
  "create-folder",
  "folder-name",
  "folder-roles",
  "folder-hide",
  "folder-always",
  "folder-submit",
];

/** Short track: fewer micro-steps, still blinks. */
export const SHORT_TRACK_STEPS: WorkspaceOnboardingStep[] = [
  "create-folder",
  "folder-name",
  "folder-submit",
  "open-folder",
  "open-add-task",
  "task-name",
  "task-menu-info",
  "submit",
  "done",
];

export function readFoldersOpenPreference(
  workspaceId: string,
): boolean | null {
  try {
    const raw = localStorage.getItem(FOLDERS_OPEN_KEY(workspaceId));
    if (raw === "1") return true;
    if (raw === "0") return false;
  } catch {
    /* private mode */
  }
  return null;
}

export function writeFoldersOpenPreference(
  workspaceId: string,
  open: boolean,
) {
  try {
    localStorage.setItem(FOLDERS_OPEN_KEY(workspaceId), open ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function isSetupDismissed(workspaceId: string) {
  try {
    return Boolean(localStorage.getItem(SETUP_DISMISS_KEY(workspaceId)));
  } catch {
    return false;
  }
}

export function readOnboardingPreference(): OnboardingPreference {
  try {
    const raw = localStorage.getItem(ONBOARDING_PREF_KEY);
    if (!raw) return { status: "unset" };
    const parsed = JSON.parse(raw) as OnboardingPreference;
    if (!parsed?.status) return { status: "unset" };
    return parsed;
  } catch {
    return { status: "unset" };
  }
}

export function writeOnboardingPreference(pref: OnboardingPreference) {
  try {
    localStorage.setItem(
      ONBOARDING_PREF_KEY,
      JSON.stringify({ ...pref, updatedAt: new Date().toISOString() }),
    );
  } catch {
    /* ignore */
  }
}

export function readStoredOnboardingStep(
  workspaceId: string,
): WorkspaceOnboardingStep | null {
  try {
    return parseStoredStep(
      localStorage.getItem(ONBOARDING_STEP_KEY(workspaceId)),
    );
  } catch {
    return null;
  }
}

export function writeStoredOnboardingStep(
  workspaceId: string,
  step: WorkspaceOnboardingStep,
) {
  try {
    localStorage.setItem(ONBOARDING_STEP_KEY(workspaceId), step);
  } catch {
    /* ignore */
  }
}

export function dismissSetup(workspaceId: string) {
  try {
    localStorage.setItem(SETUP_DISMISS_KEY(workspaceId), "1");
  } catch {
    /* ignore */
  }
}

export function deriveOnboardingStep(args: {
  hasFolder: boolean;
  hasTask: boolean;
  inFolder: boolean;
  stored: WorkspaceOnboardingStep | null;
  track: OnboardingTrack;
}): WorkspaceOnboardingStep {
  if (args.hasTask) return "done";
  if (!args.hasFolder) {
    if (args.stored && FOLDER_CREATE_STEPS.includes(args.stored)) {
      return args.stored;
    }
    return "create-folder";
  }
  if (!args.inFolder) return "open-folder";
  if (
    args.stored &&
    args.stored !== "create-folder" &&
    !FOLDER_CREATE_STEPS.includes(args.stored) &&
    args.stored !== "open-folder" &&
    args.stored !== "done"
  ) {
    return args.stored;
  }
  return "open-add-task";
}

export function parseStoredStep(raw: string | null): WorkspaceOnboardingStep | null {
  if (!raw) return null;
  return ALL_STEPS.includes(raw as WorkspaceOnboardingStep)
    ? (raw as WorkspaceOnboardingStep)
    : null;
}

export function nextFolderCreateStep(
  current: WorkspaceOnboardingStep,
  canSetAccess: boolean,
): WorkspaceOnboardingStep {
  if (current === "create-folder") return "folder-name";
  if (current === "folder-name") {
    return canSetAccess ? "folder-roles" : "folder-submit";
  }
  if (current === "folder-roles") return "folder-hide";
  if (current === "folder-hide") return "folder-always";
  if (current === "folder-always") return "folder-submit";
  return current;
}

/** After skipping a section, land on the next section start. */
export function skipToNextSection(
  step: WorkspaceOnboardingStep,
): WorkspaceOnboardingStep {
  if (FOLDER_CREATE_STEPS.includes(step)) return "open-folder";
  if (step === "open-folder") return "open-add-task";
  if (step === "open-add-task" || step === "task-name") return "priority";
  if (
    step === "priority" ||
    step === "description" ||
    step === "due-date" ||
    step === "due-reset" ||
    step === "due-clear"
  ) {
    return "claim-pool";
  }
  if (
    step === "claim-pool" ||
    step === "claim-pool-info" ||
    step === "tags" ||
    step === "tags-info"
  ) {
    return "one-off";
  }
  if (
    step === "one-off" ||
    step === "one-off-info" ||
    step === "daily" ||
    step === "daily-info" ||
    step === "weekly" ||
    step === "weekly-info" ||
    step === "monthly" ||
    step === "monthly-info"
  ) {
    return "task-menu-info";
  }
  if (step === "task-menu-info" || step === "submit") {
    return "done";
  }
  return "done";
}
