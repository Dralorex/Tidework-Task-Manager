"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ONBOARDING_STEP_KEY,
  SETUP_DISMISS_KEY,
  deriveOnboardingStep,
  isSetupDismissed,
  parseStoredStep,
  readOnboardingPreference,
  skipToNextSection,
  writeOnboardingPreference,
  type OnboardingPreference,
  type OnboardingTrack,
  type WorkspaceOnboardingStep,
} from "@/lib/workspace-onboarding";

type Ctx = {
  active: boolean;
  /** Waiting for user to pick full / short / decline. */
  needsChooser: boolean;
  track: OnboardingTrack | null;
  step: WorkspaceOnboardingStep;
  setStep: (step: WorkspaceOnboardingStep) => void;
  chooseTrack: (track: OnboardingTrack) => void;
  decline: (kind: "hard" | "soft") => void;
  skipSection: () => void;
  completeOnboarding: () => void;
  dismiss: () => void;
  blink: (target: string) => boolean;
};

const OnboardingContext = createContext<Ctx | null>(null);

export function WorkspaceOnboardingProvider({
  workspaceId,
  forceShow,
  hasFolder,
  hasTask,
  inFolder,
  canEdit,
  children,
}: {
  workspaceId: string;
  forceShow: boolean;
  hasFolder: boolean;
  hasTask: boolean;
  inFolder: boolean;
  canEdit: boolean;
  children: React.ReactNode;
}) {
  const [pref, setPref] = useState<OnboardingPreference>({ status: "unset" });
  const [step, setStepState] = useState<WorkspaceOnboardingStep>("create-folder");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const storedPref = readOnboardingPreference();
    // Migrate legacy per-workspace dismiss → completed/declined
    if (storedPref.status === "unset" && isSetupDismissed(workspaceId)) {
      const migrated: OnboardingPreference = {
        status: "completed",
        declineKind: "soft",
      };
      writeOnboardingPreference(migrated);
      setPref(migrated);
    } else {
      setPref(storedPref);
    }

    let storedStep: WorkspaceOnboardingStep | null = null;
    try {
      storedStep = parseStoredStep(
        localStorage.getItem(ONBOARDING_STEP_KEY(workspaceId)),
      );
    } catch {
      /* ignore */
    }

    const track: OnboardingTrack =
      storedPref.status === "short" ? "short" : "full";
    const next = deriveOnboardingStep({
      hasFolder,
      hasTask,
      inFolder,
      stored: storedStep,
      track,
    });
    setStepState(next);
    setReady(true);
  }, [workspaceId, hasFolder, hasTask, inFolder]);

  useEffect(() => {
    if (!ready) return;
    if (pref.status !== "full" && pref.status !== "short") return;

    setStepState((prev) => {
      if (hasTask) return "done";
      if (!hasFolder) {
        // Stay inside folder-create micro-steps
        if (
          prev === "folder-name" ||
          prev === "folder-roles" ||
          prev === "folder-hide" ||
          prev === "folder-always" ||
          prev === "folder-submit" ||
          prev === "create-folder"
        ) {
          return prev;
        }
        return "create-folder";
      }
      if (!inFolder) {
        if (
          prev === "create-folder" ||
          prev === "folder-name" ||
          prev === "folder-roles" ||
          prev === "folder-hide" ||
          prev === "folder-always" ||
          prev === "folder-submit" ||
          prev === "open-folder" ||
          prev === "done"
        ) {
          return "open-folder";
        }
        return "open-folder";
      }
      if (
        prev === "create-folder" ||
        prev === "folder-name" ||
        prev === "folder-roles" ||
        prev === "folder-hide" ||
        prev === "folder-always" ||
        prev === "folder-submit" ||
        prev === "open-folder"
      ) {
        return "open-add-task";
      }
      return prev;
    });
  }, [ready, hasFolder, hasTask, inFolder, pref.status]);

  const setStep = useCallback(
    (next: WorkspaceOnboardingStep) => {
      setStepState(next);
      try {
        localStorage.setItem(ONBOARDING_STEP_KEY(workspaceId), next);
      } catch {
        /* ignore */
      }
    },
    [workspaceId],
  );

  const chooseTrack = useCallback(
    (track: OnboardingTrack) => {
      const next: OnboardingPreference = { status: track, track };
      writeOnboardingPreference(next);
      setPref(next);
      setStep(hasFolder ? (inFolder ? "open-add-task" : "open-folder") : "create-folder");
    },
    [hasFolder, inFolder, setStep],
  );

  const decline = useCallback(
    (kind: "hard" | "soft") => {
      const next: OnboardingPreference = {
        status: "declined",
        declineKind: kind,
      };
      writeOnboardingPreference(next);
      setPref(next);
      try {
        localStorage.setItem(SETUP_DISMISS_KEY(workspaceId), "1");
      } catch {
        /* ignore */
      }
      setStep("done");
    },
    [workspaceId, setStep],
  );

  const completeOnboarding = useCallback(() => {
    const next: OnboardingPreference = { status: "completed" };
    writeOnboardingPreference(next);
    setPref(next);
    try {
      localStorage.setItem(SETUP_DISMISS_KEY(workspaceId), "1");
    } catch {
      /* ignore */
    }
    setStep("done");
  }, [workspaceId, setStep]);

  const skipSection = useCallback(() => {
    if (pref.status === "short") {
      // Short track: skip jumps toward done faster
      if (!hasFolder) {
        setStep("open-folder");
        return;
      }
      if (!inFolder) {
        setStep("open-add-task");
        return;
      }
      if (step === "open-add-task" || step === "task-name") {
        setStep("submit");
        return;
      }
      completeOnboarding();
      return;
    }
    const next = skipToNextSection(step);
    if (next === "done") completeOnboarding();
    else setStep(next);
  }, [
    pref.status,
    hasFolder,
    inFolder,
    step,
    setStep,
    completeOnboarding,
  ]);

  const dismiss = completeOnboarding;

  const track: OnboardingTrack | null =
    pref.status === "full" || pref.status === "short" ? pref.status : null;

  const needsChooser =
    ready &&
    canEdit &&
    pref.status === "unset" &&
    !hasTask &&
    (forceShow || !hasFolder || !hasTask);

  const active =
    ready &&
    canEdit &&
    (pref.status === "full" || pref.status === "short") &&
    !hasTask &&
    step !== "done";

  const blink = useCallback(
    (target: string) => {
      if (!active || !track) return false;

      // Short track: only a subset blinks
      if (track === "short") {
        const shortMap: Record<string, WorkspaceOnboardingStep[]> = {
          "folders-header": ["create-folder"],
          "folder-name": ["folder-name"],
          "folder-submit": ["folder-submit"],
          "folder-bubble": ["open-folder"],
          "add-task-header": ["open-add-task"],
          "task-name": ["task-name"],
          submit: ["submit"],
        };
        return (shortMap[target] ?? []).includes(step);
      }

      const map: Record<string, WorkspaceOnboardingStep[]> = {
        "folders-header": ["create-folder"],
        "folder-name": ["folder-name"],
        "folder-roles": ["folder-roles"],
        "folder-hide": ["folder-hide"],
        "folder-always": ["folder-always"],
        "folder-submit": ["folder-submit"],
        "folder-bubble": ["open-folder"],
        "add-task-header": ["open-add-task"],
        "task-name": ["task-name"],
        priority: ["priority"],
        description: ["description"],
        "due-date": ["due-date"],
        "due-reset": ["due-reset"],
        "due-clear": ["due-clear"],
        "claim-pool": ["claim-pool"],
        tags: ["tags"],
        "one-off": ["one-off", "one-off-info"],
        daily: ["daily", "daily-info"],
        weekly: ["weekly", "weekly-info"],
        monthly: ["monthly", "monthly-info"],
        submit: ["submit"],
      };
      return (map[target] ?? []).includes(step);
    },
    [active, track, step],
  );

  const value = useMemo(
    () => ({
      active,
      needsChooser,
      track,
      step,
      setStep,
      chooseTrack,
      decline,
      skipSection,
      completeOnboarding,
      dismiss,
      blink,
    }),
    [
      active,
      needsChooser,
      track,
      step,
      setStep,
      chooseTrack,
      decline,
      skipSection,
      completeOnboarding,
      dismiss,
      blink,
    ],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useWorkspaceOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    return {
      active: false,
      needsChooser: false,
      track: null as OnboardingTrack | null,
      step: "done" as WorkspaceOnboardingStep,
      setStep: (_: WorkspaceOnboardingStep) => {},
      chooseTrack: (_: OnboardingTrack) => {},
      decline: (_: "hard" | "soft") => {},
      skipSection: () => {},
      completeOnboarding: () => {},
      dismiss: () => {},
      blink: (_: string) => false,
    };
  }
  return ctx;
}
