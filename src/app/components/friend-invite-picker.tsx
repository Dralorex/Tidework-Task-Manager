"use client";

import { useMemo, useState } from "react";

export type InviteFriendOption = {
  id: string;
  username: string;
  label: string;
};

/**
 * Quick invite: list friends and filter as the user types a username/email.
 * Choosing a friend fills the invite target field.
 */
export function FriendInvitePicker({
  friends,
  targetName = "target",
}: {
  friends: InviteFriendOption[];
  targetName?: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(
      (friend) =>
        friend.username.toLowerCase().includes(q) ||
        friend.label.toLowerCase().includes(q),
    );
  }, [friends, query]);

  return (
    <div className="space-y-2">
      <input
        name={targetName}
        required
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Friend username or email"
        autoComplete="off"
        className="tide-input text-sm"
      />
      {friends.length > 0 ? (
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-[#0A3D45]/12 bg-white/70 p-2">
          {filtered.length > 0 ? (
            filtered.map((friend) => (
              <li key={friend.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-[#0A3D45] transition hover:bg-[#0A3D45]/8"
                  onClick={() => setQuery(friend.username)}
                >
                  <span className="truncate font-medium">{friend.label}</span>
                  <span className="ml-2 shrink-0 text-xs text-[#0A3D45]/55">
                    @{friend.username}
                  </span>
                </button>
              </li>
            ))
          ) : (
            <li className="px-2 py-1.5 text-xs text-[#0A3D45]/55">
              No friends match “{query.trim()}”.
            </li>
          )}
        </ul>
      ) : (
        <p className="text-xs text-[#0A3D45]/55">
          No friends yet — type a username or email above.
        </p>
      )}
    </div>
  );
}
