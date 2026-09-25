"use client";

/** Floating coach prompt with optional Next for guided onboarding. */
export function OnboardingPrompt({
  title,
  body,
  onNext,
  nextLabel = "Next",
}: {
  title: string;
  body: string;
  onNext?: () => void;
  nextLabel?: string;
}) {
  return (
    <div
      role="status"
      className="mt-3 rounded-xl border border-[#3b82f6]/35 bg-[#3b82f6]/10 px-3 py-3 text-sm text-[#0A3D45] shadow-sm"
    >
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
    </div>
  );
}

export function blinkRing(active: boolean) {
  return active
    ? "animate-tide-blink-empty ring-2 ring-[#3b82f6]/50 ring-offset-2 ring-offset-white/40"
    : "";
}
