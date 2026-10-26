"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { clearAllOpenChatPresenceAction } from "@/app/actions/social";

/**
 * Whenever the user is outside `/app/chat`, clear any leftover lastActiveAt
 * so web push is not stuck suppressed after visiting a thread earlier.
 */
export function ClearChatOpenOutsideChat() {
  const pathname = usePathname();
  const lastCleared = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    const onChatPage = pathname.startsWith("/app/chat");
    if (onChatPage) {
      lastCleared.current = null;
      return;
    }
    // Dedupe Strict Mode double-invoke for the same path.
    if (lastCleared.current === pathname) return;
    lastCleared.current = pathname;
    void clearAllOpenChatPresenceAction();
  }, [pathname]);

  return null;
}
