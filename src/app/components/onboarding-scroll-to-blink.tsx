"use client";

import { useEffect } from "react";
import { useWorkspaceOnboarding } from "@/app/components/workspace-onboarding-context";

/**
 * On phone, keep the current onboarding blink target in view under the sticky nav.
 */
export function OnboardingScrollToBlink() {
  const { active, step } = useWorkspaceOnboarding();

  useEffect(() => {
    if (!active || step === "done") return;
    if (typeof window === "undefined") return;
    const narrow = window.matchMedia("(max-width: 640px)").matches;
    if (!narrow) return;

    const selectorForStep: Partial<Record<typeof step, string>> = {
      "create-folder": "#workspace-folders",
      "folder-name": '#workspace-folders input[name="name"]',
      "folder-roles": "#workspace-folders",
      "folder-hide": "#workspace-folders",
      "folder-always": "#workspace-folders",
      "folder-submit": '#workspace-folders button[type="submit"]',
      "open-folder": "#workspace-folders",
      "open-add-task": "#workspace-add-task",
      "task-name": '#workspace-add-task input[name="name"]',
      priority: '#workspace-add-task select[name="priority"]',
      description: '#workspace-add-task input[name="description"]',
      "due-date": '#workspace-add-task input[name="dueDate"]',
      "due-reset": "#workspace-add-task",
      "due-clear": "#workspace-add-task",
      "claim-pool": '#workspace-add-task select[name="assignTo"]',
      tags: "#workspace-add-task",
      "one-off": "#workspace-add-task",
      daily: "#workspace-add-task",
      weekly: "#workspace-add-task",
      monthly: "#workspace-add-task",
      submit: '#workspace-add-task button[type="submit"]',
    };

    const sel = selectorForStep[step];
    if (!sel) return;

    const t = window.setTimeout(() => {
      const el = document.querySelector(sel);
      if (!(el instanceof HTMLElement)) return;
      const nav = document.querySelector("header");
      const offset = (nav?.getBoundingClientRect().height ?? 56) + 12;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }, 120);

    return () => window.clearTimeout(t);
  }, [active, step]);

  return null;
}
