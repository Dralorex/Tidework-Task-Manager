"use client";

import { useState } from "react";

/**
 * Workspace main-panel collapsible: whole header is clickable
 * (title, empty space, and arrow). Optional blue blink on the
 * empty stretch teaches first-time open behavior.
 */
export function WorkspaceCollapsible({
  id,
  title,
  description,
  children,
  defaultOpen = false,
  blinkEmpty = false,
  className = "",
}: {
  id?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  /** Slow blue pulse on the header’s empty space (onboarding). */
  blinkEmpty?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div id={id} className={`tide-panel overflow-hidden ${className}`.trim()}>
      <button
        type="button"
        className="flex w-full items-stretch gap-2 px-5 py-4 text-left"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="shrink-0 self-center font-[family-name:var(--font-display)] text-xl text-[#0A3D45]">
          {title}
        </span>
        {/* Clickable empty stretch — onboarding can blink this */}
        <span
          className={`min-h-8 min-w-[2.5rem] flex-1 self-stretch rounded-lg ${
            blinkEmpty ? "animate-tide-blink-empty" : ""
          }`}
          aria-hidden
        />
        <span
          className="shrink-0 self-center text-sm text-[#0A3D45]/55"
          aria-hidden
        >
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? (
        <div className="border-t border-[#0A3D45]/10 px-5 pb-5 pt-4">
          {description ? (
            <p className="mb-4 text-sm text-[#0A3D45]/60">{description}</p>
          ) : null}
          {children}
        </div>
      ) : null}
    </div>
  );
}
