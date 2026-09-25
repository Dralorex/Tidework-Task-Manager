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
  type WorkspaceOnboardingStep,
} from "@/lib/workspace-onboarding";

type Ctx = {
  active: boolean;
  step: WorkspaceOnboardingStep;
  setStep: (step: WorkspaceOnboardingStep) => void;
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
  const [dismissed, setDismissed] = useState(false);
  const [step, setStepState] = useState<WorkspaceOnboardingStep>("create-folder");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const wasDismissed = isSetupDismissed(workspaceId);
    setDismissed(wasDismissed);
    let stored: WorkspaceOnboardingStep | null = null;
    try {
      stored = parseStoredStep(
        localStorage.getItem(ONBOARDING_STEP_KEY(workspaceId)),
      );
    } catch {
      /* ignore */
    }
    const next = deriveOnboardingStep({
      hasFolder,
      hasTask,
      inFolder,
      stored,
    });
    setStepState(next);
    setReady(true);
  }, [workspaceId, hasFolder, hasTask, inFolder]);

  // Keep step coherent when server props change (folder created, navigated in)
  useEffect(() => {
    if (!ready) return;
    setStepState((prev) => {
      if (hasTask) return "done";
      if (!hasFolder) return "create-folder";
      if (!inFolder) {
        // Don't regress past open-folder if they somehow leave mid-form
        if (
          prev === "create-folder" ||
          prev === "open-folder" ||
          prev === "done"
        ) {
          return "open-folder";
        }
        return "open-folder";
      }
      if (prev === "create-folder" || prev === "open-folder") {
        return "open-add-task";
      }
      return prev;
    });
  }, [ready, hasFolder, hasTask, inFolder]);

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

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(SETUP_DISMISS_KEY(workspaceId), "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
    setStep("done");
  }, [workspaceId, setStep]);

  const active =
    ready &&
    canEdit &&
    !dismissed &&
    !hasTask &&
    (forceShow || !hasFolder || !hasTask) &&
    step !== "done";

  const blink = useCallback(
    (target: string) => {
      if (!active) return false;
      const map: Record<string, WorkspaceOnboardingStep[]> = {
        "folders-header": ["create-folder"],
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
        "one-off": ["one-off"],
        daily: ["daily"],
        weekly: ["weekly"],
        monthly: ["monthly"],
        submit: ["submit"],
      };
      return (map[target] ?? []).includes(step);
    },
    [active, step],
  );

  const value = useMemo(
    () => ({ active, step, setStep, dismiss, blink }),
    [active, step, setStep, dismiss, blink],
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
      step: "done" as WorkspaceOnboardingStep,
      setStep: (_: WorkspaceOnboardingStep) => {},
      dismiss: () => {},
      blink: (_: string) => false,
    };
  }
  return ctx;
}
