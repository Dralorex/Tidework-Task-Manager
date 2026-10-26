"use client";

import { useEffect, useState } from "react";
import { IosHomescreenHelp } from "@/app/components/ios-homescreen-help";
import {
  canOfferWebPushPrompt,
  isIosDevice,
  isStandaloneDisplay,
  registerPushServiceWorker,
  shouldAutoAskPush,
  subscribeWebPush,
  writePushPromptPref,
} from "@/lib/web-push-client";

/**
 * Soft prompt for Web Push (Android / desktop / iOS Home Screen app).
 * On iPhone browser tabs, shows IosHomescreenHelp instead.
 */
export function WebPushPrompt() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iosBrowserHelp, setIosBrowserHelp] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    void registerPushServiceWorker();

    // iPhone / iPad Safari (or other) tab — guided Home Screen / notif help.
    if (isIosDevice() && !isStandaloneDisplay()) {
      setIosBrowserHelp(true);
      return;
    }

    if (!canOfferWebPushPrompt()) return;
    if (!shouldAutoAskPush()) return;

    const t = window.setTimeout(() => setOpen(true), 1200);
    return () => window.clearTimeout(t);
  }, []);

  async function onAllow() {
    setBusy(true);
    setError(null);
    const result = await subscribeWebPush();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
  }

  function onSnooze() {
    writePushPromptPref({
      status: "snooze",
      until: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    setOpen(false);
  }

  function onNever() {
    writePushPromptPref({ status: "never" });
    setOpen(false);
  }

  if (iosBrowserHelp) {
    return <IosHomescreenHelp />;
  }

  if (!open) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md animate-tide-rise sm:inset-x-auto sm:right-4 sm:bottom-4">
      <div className="tide-panel border border-[#0A3D45]/15 p-4 shadow-lg">
        <p className="font-semibold text-[#0A3D45]">Turn on notifications?</p>
        <p className="mt-1 text-sm text-[#0A3D45]/70">
          Get alerts for chats, tasks, and invites even when Rowgon is closed.
        </p>
        {error ? (
          <p className="mt-2 rounded-lg bg-[#E85D4C]/12 px-3 py-2 text-sm text-[#9b2f22]">
            {error}
          </p>
        ) : null}
        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onAllow()}
            className="tide-btn-primary w-full disabled:opacity-60"
          >
            {busy ? "Enabling…" : "Yes, notify me"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onSnooze}
            className="tide-btn-secondary w-full"
          >
            Ask again in 7 days
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onNever}
            className="text-sm text-[#0A3D45]/55 underline-offset-2 hover:underline"
          >
            Don’t ask again
          </button>
        </div>
      </div>
    </div>
  );
}
