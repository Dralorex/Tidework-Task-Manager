import type { TaskPriority } from "@/generated/prisma/client";

/** Manual priority (Base) + due-date pressure (Date) → Total sort score and edge color. */

/** Base weight ~1–10 for each named priority level. */
export const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  CRITICAL: 10,
  URGENT: 8,
  HIGH: 7,
  ELEVATED: 5,
  MEDIUM: 4,
  NORMAL: 3,
  LOW: 2,
  MINIMAL: 1,
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  CRITICAL: "Critical",
  URGENT: "Urgent",
  HIGH: "High",
  ELEVATED: "Elevated",
  MEDIUM: "Medium",
  NORMAL: "Normal",
  LOW: "Low",
  MINIMAL: "Minimal",
};

export const TASK_PRIORITIES = Object.keys(PRIORITY_WEIGHT) as TaskPriority[];

export function isTaskPriority(value: string): value is TaskPriority {
  return value in PRIORITY_WEIGHT;
}

export function priorityBase(priority: TaskPriority): number {
  return PRIORITY_WEIGHT[priority];
}

export function duePressure(dueDate: Date | null | undefined, now = new Date()): number {
  if (!dueDate) return 0;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const diffDays = Math.floor((dueDay.getTime() - startOfToday.getTime()) / 86_400_000);

  if (diffDays < 0) return 5;
  if (diffDays === 0) return 4;
  if (diffDays <= 2) return 3;
  if (diffDays <= 7) return 2;
  if (diffDays <= 14) return 1;
  return 0;
}

export function urgencyParts(
  priority: TaskPriority,
  dueDate: Date | null | undefined,
  now = new Date(),
) {
  const base = priorityBase(priority);
  const date = duePressure(dueDate, now);
  return { base, date, total: base + date };
}

export function urgencyScore(
  priority: TaskPriority,
  dueDate: Date | null | undefined,
  now = new Date(),
): number {
  return urgencyParts(priority, dueDate, now).total;
}

export type UrgencyLevel = "critical" | "high" | "medium" | "low" | "calm";

/** Map total score (≈1–15) onto visual urgency bands. */
export function urgencyLevel(score: number): UrgencyLevel {
  if (score >= 12) return "critical";
  if (score >= 9) return "high";
  if (score >= 6) return "medium";
  if (score >= 3) return "low";
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
