"use client";

import { useEffect, useRef } from "react";
import {
  clearChatPresenceAction,
  markChatNotificationsReadAction,
  pulseChatPresenceAction,
} from "@/app/actions/social";
import { useActivePolling } from "@/lib/use-active-polling";

/**
 * Marks the thread read while mounted.
 * When `countsAsOpenThread` is true (full Chat page only), also heartbeats
 * lastActiveAt so web push is suppressed for that conversation.
 * Floating chat must pass countsAsOpenThread={false} so Workspaces / other
 * tabs still get lock-screen notifications.
 */
export function MarkChatSeen({
  groupId,
  countsAsOpenThread = true,
}: {
  groupId: string;
  /** When false, clear unread only — do not suppress web push. */
  countsAsOpenThread?: boolean;
}) {
  const ranFor = useRef<string | null>(null);
  const active = useActivePolling();

  useEffect(() => {
    if (!groupId) return;
    if (ranFor.current !== groupId) {
      ranFor.current = groupId;
      void markChatNotificationsReadAction(groupId);
    }
  }, [groupId]);

  useEffect(() => {
    if (!groupId || !countsAsOpenThread) return;

    const clearNow = () => {
      void clearChatPresenceAction(groupId);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") clearNow();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", clearNow);
    window.addEventListener("freeze", clearNow);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", clearNow);
      window.removeEventListener("freeze", clearNow);
      clearNow();
    };
  }, [groupId, countsAsOpenThread]);

  useEffect(() => {
    if (!countsAsOpenThread || !groupId) return;
    if (!active) {
      void clearChatPresenceAction(groupId);
      return;
    }
    void pulseChatPresenceAction(groupId);
    const id = window.setInterval(() => {
      void pulseChatPresenceAction(groupId);
    }, 45_000);
    return () => {
      window.clearInterval(id);
    };
  }, [groupId, active, countsAsOpenThread]);

  return null;
}
