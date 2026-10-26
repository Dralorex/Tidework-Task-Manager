"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * When a web-push notification is clicked while Rowgon is already open,
 * the service worker focuses this window and postMessages a navigate target.
 * Also handles client.navigate() full loads via the URL itself.
 */
export function PushNavigateListener() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | null;
      if (!data || data.type !== "rowgon-navigate" || !data.url) return;
      try {
        const next = new URL(data.url, window.location.origin);
        if (next.origin !== window.location.origin) return;
        if (!next.pathname.startsWith("/app")) return;
        router.push(`${next.pathname}${next.search}${next.hash}`);
      } catch {
        /* ignore bad urls */
      }
    };

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, [router]);

  return null;
}
