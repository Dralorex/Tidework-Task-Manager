"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  ONBOARDING_PREF_KEY,
  type OnboardingPreference,
} from "@/lib/workspace-onboarding";

function readPref(): OnboardingPreference {
  try {
    const raw = localStorage.getItem(ONBOARDING_PREF_KEY);
    if (!raw) return { status: "unset" };
    const parsed = JSON.parse(raw) as OnboardingPreference;
    if (
      parsed &&
      (parsed.status === "unset" ||
        parsed.status === "full" ||
        parsed.status === "short" ||
        parsed.status === "declined" ||
        parsed.status === "completed")
    ) {
      return parsed;
    }
  } catch {
    /* private mode / bad JSON */
  }
  return { status: "unset" };
}

/**
 * Wraps the Start here bubble with a circling blue glow while first-time
 * setup is active. Turns off once onboarding is completed or declined.
 */
export function StartHereWorkspaceGlow({
  active,
  children,
  className,
}: {
  /** True when the Start here empty state is showing (no workspaces yet). */
  active: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [glow, setGlow] = useState(false);

  useEffect(() => {
    if (!active) {
      setGlow(false);
      return;
    }
    function sync() {
      const pref = readPref();
      setGlow(pref.status !== "completed" && pref.status !== "declined");
    }
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, [active]);

  return (
    <div
      className={`w-full ${className ?? ""} ${glow ? "rowgon-glow-orbit" : ""}`.trim()}
    >
      {children}
    </div>
  );
}
