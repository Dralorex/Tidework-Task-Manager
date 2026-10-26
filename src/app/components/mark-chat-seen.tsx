"use client";

import { useEffect, useRef } from "react";
import {
  clearChatPresenceAction,
  markChatNotificationsReadAction,
  pulseChatPresenceAction,
} from "@/app/actions/social";
import { useActivePolling } from "@/lib/use-active-polling";

/**
 * While this exact thread is open and visible: heartbeat presence + clear unread.
 * Leaving the thread, switching Chat tabs, backgrounding, or swipe-away clears
 * lastActiveAt immediately so web push can fire for that chat again.
 * (Being elsewhere in the app — Settings, Workspaces, chat list — does not
 * suppress pushes for a thread you’re not viewing.)
 */
export function MarkChatSeen({ groupId }: { groupId: string }) {
  const ranFor = useRef<string | null>(null);
  const active = useActivePolling();

  useEffect(() => {
    if (!groupId) return;
    if (ranFor.current !== groupId) {
      ranFor.current = groupId;
      // Badge push happens server-side; no full router.refresh.
      void markChatNotificationsReadAction(groupId);
    }
  }, [groupId]);

  // Instant clear when the app is backgrounded or swiped away — do not wait
  // for the 60s hidden-pause used by polling. Uses sendBeacon-friendly action.
  useEffect(() => {
    if (!groupId) return;

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
  }, [groupId]);

  useEffect(() => {
    if (!groupId || !active) {
      if (groupId && !active) void clearChatPresenceAction(groupId);
      return;
    }
    void pulseChatPresenceAction(groupId);
    const id = window.setInterval(() => {
      void pulseChatPresenceAction(groupId);
    }, 45_000);
    return () => {
      window.clearInterval(id);
    };
  }, [groupId, active]);

  return null;
}
