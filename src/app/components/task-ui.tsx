import {
  URGENCY_EDGE,
  urgencyLabel,
  urgencyLevel,
  urgencyScore,
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
