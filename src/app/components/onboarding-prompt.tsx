"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Coach prompt for guided onboarding.
 *
 * Default `layer="foreground"`: fixed to the bottom of the viewport (with a
 * small gap / safe-area), portaled to `document.body` so it stays visible
 * while the page scrolls and never nests inside a panel bubble.
 * Use this for ALL info prompts — including new ones.
 *
 * Prefer an action button (`onAction` / `actionLabel`) when the user should
 * enter a field (e.g. “Add Title”, “Add Tag”) — that focuses the control.
 * Use `onNext` / `nextLabel` (“Next”) for informational steps.
 *
 * `embedded` — rare: compact content inside another sheet (no outer chrome).
 * `inline` — opt-in only when a tip must live in document flow.
 */
export function OnboardingPrompt({
  title,
  body,
  onNext,
  nextLabel = "Next",
  onAction,
  actionLabel,
  layer = "foreground",
}: {
  title: string;
  body: string;
  onNext?: () => void;
  nextLabel?: string;
  /** Primary field/action CTA (e.g. focus a text box). */
  onAction?: () => void;
  actionLabel?: string;
  layer?: "inline" | "foreground" | "embedded";
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const showAction = Boolean(onAction && actionLabel);
  const showNext = Boolean(onNext);

  const inner = (
    <>
      <p className="font-semibold text-[#0A3D45]">{title}</p>
      <p className="mt-1 text-[#0A3D45]/75">{body}</p>
      {showAction || showNext ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {showAction ? (
            <button
              type="button"
              onClick={onAction}
              className="rowgon-btn-primary !min-h-9 !px-4 !py-1.5 text-sm"
            >
              {actionLabel}
            </button>
          ) : null}
          {showNext ? (
            <button
              type="button"
              onClick={onNext}
              className={
                showAction
                  ? "rounded-full px-3 py-1.5 text-sm font-semibold text-[#1a7a82] underline-offset-2 hover:underline"
                  : "rowgon-btn-primary !min-h-9 !px-4 !py-1.5 text-sm"
              }
            >
              {nextLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );

  if (layer === "embedded") {
    return (
      <div role="status" className="text-sm text-[#0A3D45]">
        {inner}
      </div>
    );
  }

  const card = (
    <div
      role="status"
      className={`rounded-xl border border-[#93c5fd] bg-[#E8F1FF] px-3 py-3 text-sm text-[#0A3D45] shadow-md ${
        layer === "inline" ? "mt-3" : ""
      }`}
    >
      {inner}
    </div>
  );

  if (layer === "inline") {
    return card;
  }

  // foreground (default): locked to the bottom of the screen
  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex justify-center px-3"
      style={{
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
      }}
      data-onboarding-prompt="foreground"
    >
      <div className="pointer-events-auto w-full max-w-lg shadow-lg">{card}</div>
    </div>,
    document.body,
  );
}

export function blinkRing(active: boolean) {
  return active
    ? "animate-rowgon-blink-empty ring-2 ring-inset ring-[#3b82f6]/55"
    : "";
}

/** Compact tip content for calendar sheet header (no nested card chrome). */
export function OnboardingPromptBody({
  title,
  body,
}: {
  title: string;
  body: ReactNode;
}) {
  return (
    <div role="status" className="text-sm text-[#0A3D45]">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-[#0A3D45]/75">{body}</p>
    </div>
  );
}
