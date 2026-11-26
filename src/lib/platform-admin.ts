import "server-only";

/** Site-wide Admin+ for avatar moderation (not workspace Admin). */
export function isPlatformAdmin(user: {
  username: string;
  platformRole?: string | null;
}): boolean {
  const role = (user.platformRole ?? "member").toLowerCase();
  if (role === "admin" || role === "owner") return true;

  const raw = process.env.PLATFORM_ADMIN_USERNAMES?.trim();
  if (!raw) return false;
  const allowed = new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  return allowed.has(user.username.toLowerCase());
}
