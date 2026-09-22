"use client";

import { useEffect, useState } from "react";
import {
  PRIORITY_LABELS,
  URGENCY_EDGE,
  urgencyLabel,
  urgencyLevel,
  urgencyParts,
  urgencyScore,
  urgencyTag,
  type UrgencyLevel,
} from "@/lib/urgency";
import type { TaskPriority } from "@/generated/prisma/client";

export type UrgencyChipPrefs = {
  showBase?: boolean;
  showDate?: boolean;
  showTotal?: boolean;
};

export function TaskUrgencyEdge({
  priority,
  dueDate,
}: {
  priority: TaskPriority;
  dueDate: Date | null;
}) {
  const score = urgencyScore(priority, dueDate);
  const level = urgencyLevel(score);
  return (
    <span
      className="absolute inset-y-0 left-0 w-[4px] rounded-l-md"
      style={{ backgroundColor: URGENCY_EDGE[level] }}
      title={`${urgencyLabel(level)} · score ${score}`}
      aria-hidden
    />
  );
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span className="rounded-md bg-[#0A3D45]/8 px-2 py-0.5 text-xs font-medium text-[#0A3D45]">
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

const TAG_STYLES: Record<UrgencyLevel, string> = {
  critical: "bg-[#E85D4C]/15 text-[#9b2f22]",
  high: "bg-[#F0A202]/18 text-[#8a5a00]",
  medium: "bg-[#3DBEAB]/15 text-[#0A3D45]",
  low: "bg-[#4A90A4]/15 text-[#0A3D45]",
  calm: "bg-[#0A3D45]/8 text-[#0A3D45]/65",
};

const CHIP_NEUTRAL =
  "rounded-md bg-[#0A3D45]/8 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#0A3D45]/75";

/** Live urgency chip (Low / Med / High / Critical) — recomputes as time passes. */
export function UrgencyTag({
  priority,
  dueDate,
}: {
  priority: TaskPriority;
  dueDate: Date | null;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const score = urgencyScore(priority, dueDate, now);
  const level = urgencyLevel(score);
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${TAG_STYLES[level]}`}
      title={`${urgencyLabel(level)} · score ${score}`}
    >
      {urgencyTag(level)}
    </span>
  );
}

/**
 * Base / Date / Total chips. Defaults to Total only when prefs omit flags.
 * Recomputes as due pressure rises over time.
 */
export function UrgencyChips({
  priority,
  dueDate,
  prefs,
}: {
  priority: TaskPriority;
  dueDate: Date | null;
  prefs?: UrgencyChipPrefs;
}) {
  const showBase = prefs?.showBase ?? false;
  const showDate = prefs?.showDate ?? false;
  const showTotal = prefs?.showTotal ?? true;

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!showBase && !showDate && !showTotal) return;
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, [showBase, showDate, showTotal]);

  if (!showBase && !showDate && !showTotal) return null;

  const { base, date, total } = urgencyParts(priority, dueDate, now);
  const level = urgencyLevel(total);

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {showBase ? (
        <span
          className={CHIP_NEUTRAL}
          title={`${PRIORITY_LABELS[priority]} · base ${base}`}
        >
          Base {base}
        </span>
      ) : null}
      {showDate ? (
        <span className={CHIP_NEUTRAL} title={`Due pressure · date ${date}`}>
          Date {date}
        </span>
      ) : null}
      {showTotal ? (
        <span
          className={`rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${TAG_STYLES[level]}`}
          title={`${urgencyLabel(level)} · total ${total}`}
        >
          {urgencyTag(level)}
          <span className="ml-1 font-medium normal-case tracking-normal opacity-70">
            {total}
          </span>
        </span>
      ) : null}
    </span>
  );
}
