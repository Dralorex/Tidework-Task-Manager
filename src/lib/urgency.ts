import type { TaskPriority } from "@/generated/prisma/client";

/** Manual priority weight + due-date pressure → sort score and edge color. */

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export function duePressure(dueDate: Date | null | undefined, now = new Date()): number {
  if (!dueDate) return 0;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const diffDays = Math.floor((dueDay.getTime() - startOfToday.getTime()) / 86_400_000);

  if (diffDays < 0) return 4;
  if (diffDays === 0) return 3;
  if (diffDays <= 2) return 2;
  if (diffDays <= 7) return 1;
  return 0;
}

/** When no due date is set, urgency mirrors the chosen priority level. */
const PRIORITY_AS_URGENCY: Record<TaskPriority, number> = {
  CRITICAL: 7,
  HIGH: 5,
  MEDIUM: 3,
  LOW: 1,
};

export function urgencyScore(
  priority: TaskPriority,
  dueDate: Date | null | undefined,
  now = new Date(),
): number {
  if (!dueDate) return PRIORITY_AS_URGENCY[priority];
  return PRIORITY_WEIGHT[priority] + duePressure(dueDate, now);
}

export type UrgencyLevel = "critical" | "high" | "medium" | "low" | "calm";

export function urgencyLevel(score: number): UrgencyLevel {
  if (score >= 7) return "critical";
  if (score >= 5) return "high";
  if (score >= 3) return "medium";
  if (score >= 1) return "low";
  return "calm";
}

export const URGENCY_EDGE: Record<UrgencyLevel, string> = {
  critical: "#E85D4C",
  high: "#F0A202",
  medium: "#3DBEAB",
  low: "#4A90A4",
  calm: "#9BB5BC",
};

export function urgencyLabel(level: UrgencyLevel): string {
  switch (level) {
    case "critical":
      return "Rising hard";
    case "high":
      return "Coming in fast";
    case "medium":
      return "On the tide";
    case "low":
      return "Gentle swell";
    default:
      return "Calm waters";
  }
}

/** Short badge copy for collapsed task rows (updates as due pressure rises). */
export function urgencyTag(level: UrgencyLevel): string {
  switch (level) {
    case "critical":
      return "Critical";
    case "high":
      return "High";
    case "medium":
      return "Med";
    case "low":
      return "Low";
    default:
      return "Calm";
  }
}

export function compareTasksByUrgency<
  T extends { priority: TaskPriority; dueDate: Date | null; createdAt: Date },
>(a: T, b: T, now = new Date()): number {
  const scoreDiff = urgencyScore(b.priority, b.dueDate, now) - urgencyScore(a.priority, a.dueDate, now);
  if (scoreDiff !== 0) return scoreDiff;
  if (a.dueDate && b.dueDate) {
    const dueDiff = a.dueDate.getTime() - b.dueDate.getTime();
    if (dueDiff !== 0) return dueDiff;
  } else if (a.dueDate) return -1;
  else if (b.dueDate) return 1;
  return b.createdAt.getTime() - a.createdAt.getTime();
}
