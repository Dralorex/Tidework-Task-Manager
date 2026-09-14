"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { markChatNotificationsReadAction } from "@/app/actions/social";

/** Clears chat unread badges when a conversation is opened. */
export function MarkChatSeen({ groupId }: { groupId: string }) {
  const router = useRouter();
  const ranFor = useRef<string | null>(null);

  useEffect(() => {
    if (!groupId || ranFor.current === groupId) return;
    ranFor.current = groupId;
    void markChatNotificationsReadAction(groupId).then(() => router.refresh());
  }, [groupId, router]);

  return null;
}
