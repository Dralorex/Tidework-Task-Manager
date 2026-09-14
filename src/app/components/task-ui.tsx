"use client";

import { useEffect, useState } from "react";
import {
  URGENCY_EDGE,
  urgencyLabel,
  urgencyLevel,
  urgencyScore,
  urgencyTag,
  type UrgencyLevel,
} from "@/lib/urgency";
import type { TaskPriority } from "@/generated/prisma/client";

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
  const labels: Record<TaskPriority, string> = {
    CRITICAL: "Critical",
    HIGH: "High",
    MEDIUM: "Medium",
    LOW: "Low",
  };
  return (
    <span className="rounded-md bg-[#0A3D45]/8 px-2 py-0.5 text-xs font-medium text-[#0A3D45]">
      {labels[priority]}
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
