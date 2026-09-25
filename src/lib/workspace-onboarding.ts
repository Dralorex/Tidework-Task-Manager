/** Guided first-session steps inside a workspace. */
export type WorkspaceOnboardingStep =
  | "create-folder"
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
  | "submit"
  | "done";

export const SETUP_DISMISS_KEY = (workspaceId: string) =>
  `tidework-setup-dismissed:${workspaceId}`;

export const FOLDERS_OPEN_KEY = (workspaceId: string) =>
  `tidework-folders-open:${workspaceId}`;

export const ONBOARDING_STEP_KEY = (workspaceId: string) =>
  `tidework-onboarding-step:${workspaceId}`;

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

export function deriveOnboardingStep(args: {
  hasFolder: boolean;
  hasTask: boolean;
  inFolder: boolean;
  stored: WorkspaceOnboardingStep | null;
}): WorkspaceOnboardingStep {
  if (args.hasTask) return "done";
  if (!args.hasFolder) return "create-folder";
  if (!args.inFolder) return "open-folder";
  // Inside a folder without a task — resume stored micro-step if past open-folder
  if (
    args.stored &&
    args.stored !== "create-folder" &&
    args.stored !== "open-folder" &&
    args.stored !== "done"
  ) {
    return args.stored;
  }
  return "open-add-task";
}

export function parseStoredStep(raw: string | null): WorkspaceOnboardingStep | null {
  if (!raw) return null;
  const allowed: WorkspaceOnboardingStep[] = [
    "create-folder",
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
    "submit",
    "done",
  ];
  return allowed.includes(raw as WorkspaceOnboardingStep)
    ? (raw as WorkspaceOnboardingStep)
    : null;
}
