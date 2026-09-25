"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Floating coach prompt with optional Next for guided onboarding. */
export function OnboardingPrompt({
  title,
  body,
  onNext,
  nextLabel = "Next",
  /**
   * `inline` — in document flow (default).
   * `foreground` — fixed high-z portal so tips stay above sheets/pickers on phone.
   * `embedded` — compact block for inside a sheet (no outer chrome duplication).
   */
  layer = "inline",
}: {
  title: string;
  body: string;
  onNext?: () => void;
  nextLabel?: string;
  layer?: "inline" | "foreground" | "embedded";
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const inner = (
    <>
      <p className="font-semibold text-[#0A3D45]">{title}</p>
      <p className="mt-1 text-[#0A3D45]/75">{body}</p>
      {onNext ? (
        <button
          type="button"
          onClick={onNext}
          className="tide-btn-primary mt-3 !min-h-9 !px-4 !py-1.5 text-sm"
        >
          {nextLabel}
        </button>
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
        layer === "foreground" ? "" : "mt-3"
      }`}
    >
      {inner}
    </div>
  );

  if (layer === "foreground" && mounted && typeof document !== "undefined") {
    return createPortal(
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:bottom-4">
        <div className="pointer-events-auto w-full max-w-lg rounded-xl bg-[#E8F1FF] shadow-lg">
          {card}
        </div>
      </div>,
      document.body,
    );
  }

  return card;
}

export function blinkRing(active: boolean) {
  return active
    ? "animate-tide-blink-empty ring-2 ring-inset ring-[#3b82f6]/55"
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
