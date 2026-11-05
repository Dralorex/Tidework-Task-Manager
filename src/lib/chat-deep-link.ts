/** Canonical in-app URLs for chat threads (web push + notification clicks). */

export function chatThreadHref(opts: {
  groupId: string;
  isDirect: boolean;
  workspaceId?: string | null;
}): string {
  const tab = opts.isDirect
    ? "dms"
    : opts.workspaceId
      ? "workspace-groups"
      : "groups";
  return `/app/chat?tab=${tab}&group=${encodeURIComponent(opts.groupId)}`;
}
