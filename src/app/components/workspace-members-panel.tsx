"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendFriendRequestAction } from "@/app/actions/social";

export type WorkspaceMemberRow = {
  userId: string;
  username: string;
  label: string;
  role: string;
  isSelf: boolean;
  isFriend: boolean;
  requestPending: boolean;
};

/** Everyone in the workspace can browse members and friend non-friends. */
export function WorkspaceMembersPanel({
  workspaceId,
  members,
}: {
  workspaceId: string;
  members: WorkspaceMemberRow[];
}) {
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const sorted = useMemo(
    () =>
      [...members].sort((a, b) => {
        if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
        return a.label.localeCompare(b.label);
      }),
    [members],
  );

  function addFriend(username: string, userId: string) {
    setError(null);
    setPendingId(userId);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("username", username);
      const result = await sendFriendRequestAction(null, fd);
      setPendingId(null);
      if (result && !result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="tide-panel p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <h2 className="font-[family-name:var(--font-display)] text-lg text-[#0A3D45]">
          Members ({members.length})
        </h2>
        <span className="text-[#0A3D45]/60" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? (
        <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
          {sorted.map((member) => (
            <li
              key={member.userId}
              className="flex items-center justify-between gap-2 text-sm text-[#0A3D45]"
            >
              <span className="min-w-0 truncate">
                <span className="font-medium">{member.label}</span>
                <span className="ml-1 text-xs capitalize text-[#0A3D45]/55">
                  · {member.role.toLowerCase()}
                  {member.isSelf ? " · you" : ""}
                </span>
              </span>
              {!member.isSelf && !member.isFriend ? (
                <button
                  type="button"
                  disabled={pending || member.requestPending}
                  className="shrink-0 text-xs font-semibold text-[#0A3D45] underline-offset-2 hover:underline disabled:opacity-50"
                  onClick={() => addFriend(member.username, member.userId)}
                >
                  {member.requestPending
                    ? "Pending"
                    : pendingId === member.userId
                      ? "Sending…"
                      : "Add friend"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="mt-2 text-xs text-[#9b2f22]">{error}</p> : null}
      {/* Keep workspaceId referenced for future role actions */}
      <input type="hidden" value={workspaceId} readOnly aria-hidden className="hidden" />
    </div>
  );
}
