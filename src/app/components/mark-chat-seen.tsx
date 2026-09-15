"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  markChatNotificationsReadAction,
  pulseChatPresenceAction,
} from "@/app/actions/social";

/** Clears chat unread badges and heartbeats presence while this chat is open. */
export function MarkChatSeen({ groupId }: { groupId: string }) {
  const router = useRouter();
  const ranFor = useRef<string | null>(null);

  useEffect(() => {
    if (!groupId) return;
    if (ranFor.current !== groupId) {
      ranFor.current = groupId;
      void markChatNotificationsReadAction(groupId).then(() => router.refresh());
    }
    void pulseChatPresenceAction(groupId);
    const id = window.setInterval(() => {
      void pulseChatPresenceAction(groupId);
    }, 20_000);
    return () => window.clearInterval(id);
  }, [groupId, router]);

  return null;
}
