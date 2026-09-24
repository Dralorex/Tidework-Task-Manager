"use client";

import { useEffect, useState } from "react";
import { fetchChatPresence } from "@/app/actions/social";
import {
  typingLabel,
  type ChatPresenceMember,
} from "@/lib/chat-presence";

function useChatPresence(
  groupId: string,
  memberUsernames: { userId: string; username: string }[],
) {
  const [presence, setPresence] = useState<ChatPresenceMember[]>(() =>
    memberUsernames.map((m) => ({
      ...m,
      online: false,
      typing: false,
    })),
  );

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const result = await fetchChatPresence(groupId);
      if (cancelled || !result.ok) return;
      setPresence(result.presence);
    }

    void poll();
    const id = window.setInterval(() => {
      void poll();
    }, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [groupId]);

  return presence.filter((p) =>
    memberUsernames.some((m) => m.userId === p.userId),
  );
}

/** Online dots under the chat title */
export function ChatPresenceStrip({
  groupId,
  memberUsernames,
}: {
  groupId: string;
  memberUsernames: { userId: string; username: string }[];
}) {
  const presence = useChatPresence(groupId, memberUsernames);
  const online = presence.filter((p) => p.online);

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#0A3D45]/55">
      {presence.map((m) => (
        <span key={m.userId} className="inline-flex items-center gap-1">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              m.online ? "bg-[#3DBEAB]" : "bg-[#0A3D45]/25"
            }`}
            aria-hidden
          />
          @{m.username}
        </span>
      ))}
      {online.length > 0 ? (
        <span className="text-[#0A3D45]/40">· {online.length} online</span>
      ) : null}
    </div>
  );
}

/** “X is typing…” line — place directly above the message box */
export function ChatTypingLine({
  groupId,
  memberUsernames,
}: {
  groupId: string;
  memberUsernames: { userId: string; username: string }[];
}) {
  const presence = useChatPresence(groupId, memberUsernames);
  const typing = presence.filter((p) => p.typing).map((p) => p.username);
  const label = typingLabel(typing);

  return (
    <p
      className={`min-h-4 text-left text-xs font-medium italic ${
        label ? "text-[#1a7a82]" : "text-transparent"
      }`}
      aria-live="polite"
    >
      {label ?? "."}
    </p>
  );
}
