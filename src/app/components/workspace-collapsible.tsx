"use client";

import { useEffect, useState } from "react";
import {
  readFoldersOpenPreference,
  writeFoldersOpenPreference,
} from "@/lib/workspace-onboarding";

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
  persistKey,
  /** When set, overrides initial open (e.g. force closed during onboarding). */
  forceInitialOpen,
  open: openControlled,
  onOpenChange,
}: {
  id?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  /** Slow blue pulse on the header’s empty space (onboarding). */
  blinkEmpty?: boolean;
  className?: string;
  /** localStorage key suffix scope — pass workspaceId for Folders persistence. */
  persistKey?: string;
  forceInitialOpen?: boolean | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openInternal, setOpenInternal] = useState(defaultOpen);
  const controlled = openControlled !== undefined;
  const open = controlled ? openControlled : openInternal;

  useEffect(() => {
    if (controlled) return;
    if (forceInitialOpen != null) {
      setOpenInternal(forceInitialOpen);
      return;
    }
    if (persistKey) {
      const stored = readFoldersOpenPreference(persistKey);
      if (stored != null) setOpenInternal(stored);
    }
  }, [controlled, forceInitialOpen, persistKey]);

  function setOpen(next: boolean) {
    if (!controlled) setOpenInternal(next);
    onOpenChange?.(next);
    if (persistKey) writeFoldersOpenPreference(persistKey, next);
  }

  return (
    <div id={id} className={`tide-panel overflow-hidden ${className}`.trim()}>
      <button
        type="button"
        className="flex w-full items-stretch gap-2 px-5 py-4 text-left"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
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
