"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Polls /api/pulse and refreshes the RSC tree when notifications, chat, or
 * workspace tasks/folders change for this user.
 */
export function LiveRefresh({ intervalMs = 4000 }: { intervalMs?: number }) {
  const router = useRouter();
  const stampRef = useRef<string | null>(null);
  const readyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      try {
        const res = await fetch("/api/pulse", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { ok?: boolean; stamp?: string };
        if (!data.ok || !data.stamp || cancelled) return;

        if (!readyRef.current) {
          stampRef.current = data.stamp;
          readyRef.current = true;
          return;
        }

        if (stampRef.current !== data.stamp) {
          stampRef.current = data.stamp;
          router.refresh();
        }
      } catch {
        /* ignore transient network errors */
      } finally {
        if (!cancelled) {
          timer = setTimeout(tick, intervalMs);
        }
      }
    }

    const onFocus = () => {
      void tick();
    };
    const onVis = () => {
      if (document.visibilityState === "visible") void tick();
    };

    void tick();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [intervalMs, router]);

  return null;
}
