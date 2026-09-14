import type { Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

const ROLE_RANK: Record<Role, number> = {
  OWNER: 4,
  ADMIN: 3,
  EDITOR: 2,
  MEMBER: 1,
};

export function roleAtLeast(role: Role, minimum: Role) {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export async function getMembership(workspaceId: string, userId: string) {
  return prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
}

export async function requireMembership(workspaceId: string, userId: string) {
  const membership = await getMembership(workspaceId, userId);
  if (!membership) throw new Error("FORBIDDEN");
  return membership;
}

export function canManagePeople(role: Role) {
  return roleAtLeast(role, "ADMIN");
}

export function canEditContent(role: Role) {
  return roleAtLeast(role, "EDITOR");
}

export function canCreatePublicTags(role: Role) {
  return roleAtLeast(role, "EDITOR");
}

export function canCreateGroups(role: Role) {
  return roleAtLeast(role, "ADMIN");
}

export function isOwnerOnlyAction(role: Role) {
  return role === "OWNER";
}
