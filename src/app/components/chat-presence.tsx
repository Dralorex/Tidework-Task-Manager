"use client";

import { useEffect, useState } from "react";
import { fetchChatPresence } from "@/app/actions/social";
import {
  typingLabel,
  type ChatPresenceMember,
} from "@/lib/chat-presence";

export function ChatPresenceStrip({
  groupId,
  memberUsernames,
}: {
  groupId: string;
  /** Fallback labels before first poll */
  memberUsernames: { userId: string; username: string }[];
}) {
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

  const others = presence.filter((p) =>
    memberUsernames.some((m) => m.userId === p.userId),
  );
  const online = others.filter((p) => p.online);
  const typing = others.filter((p) => p.typing).map((p) => p.username);
  const label = typingLabel(typing);

  return (
    <div className="mt-1 space-y-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#0A3D45]/55">
        {others.map((m) => (
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
          <span className="text-[#0A3D45]/40">
            · {online.length} online
          </span>
        ) : null}
      </div>
      {label ? (
        <p className="text-xs font-medium italic text-[#1a7a82]">{label}</p>
      ) : (
        <p className="h-4 text-xs text-transparent" aria-hidden>
          .
        </p>
      )}
    </div>
  );
}
