"use client";

import { useEffect, useState } from "react";
import { sendTestWebPushAction } from "@/app/actions/notifications";
import {
  canOfferWebPushPrompt,
  isIosDevice,
  isStandaloneDisplay,
  subscribeWebPush,
  unsubscribeWebPush,
  writePushPromptPref,
} from "@/lib/web-push-client";

type Status = "loading" | "unsupported" | "ios-tab" | "off" | "on" | "denied";

export function WebPushSettings() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        setStatus("unsupported");
        return;
      }
      if (isIosDevice() && !isStandaloneDisplay()) {
        setStatus("ios-tab");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.getRegistration("/");
        const sub = await reg?.pushManager.getSubscription();
        setStatus(sub && Notification.permission === "granted" ? "on" : "off");
      } catch {
        setStatus("off");
      }
    })();
  }, []);

  async function enable() {
    setBusy(true);
    setMessage(null);
    setError(null);
    const result = await subscribeWebPush();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      if (Notification.permission === "denied") setStatus("denied");
      return;
    }
    setStatus("on");
    setMessage(
      "Phone notifications are on for this device. Use “Send test” to confirm.",
    );
  }

  async function disable() {
    setBusy(true);
    setMessage(null);
    setError(null);
    await unsubscribeWebPush();
    setBusy(false);
    setStatus("off");
    setMessage("Phone notifications turned off on this device.");
  }

  async function sendTest() {
    setBusy(true);
    setMessage(null);
    setError(null);
    // Re-save subscription first in case the browser had permission but the
    // server never stored the endpoint.
    const sub = await subscribeWebPush();
    if (!sub.ok) {
      setBusy(false);
      setError(sub.error);
      return;
    }
    setStatus("on");
    const result = await sendTestWebPushAction();
    setBusy(false);
    if (!result?.ok) {
      setError(result?.error ?? "Test send failed.");
      return;
    }
    setMessage(
      "Test sent. Lock the phone or leave Rowgon — you should see “Rowgon test” within a few seconds.",
    );
  }

  function resetPrompt() {
    writePushPromptPref(null);
    setMessage("We’ll ask again next time you’re eligible.");
    setError(null);
  }

  return (
    <details className="tide-panel p-5" open>
      <summary className="cursor-pointer font-semibold text-[color:var(--tide-deep)]">
        Phone notifications
      </summary>
      <div className="mt-4 space-y-3 text-sm text-[color:var(--tide-deep)]/75">
        {status === "loading" ? <p>Checking this device…</p> : null}

        {status === "unsupported" ? (
          <p>This browser doesn’t support web push notifications.</p>
        ) : null}

        {status === "ios-tab" ? (
          <p>
            On iPhone, open Rowgon from your <strong>Home Screen</strong> (Share →
            Add to Home Screen), then come back here to enable notifications.
          </p>
        ) : null}

        {status === "denied" ? (
          <p>
            Notifications are blocked in browser settings. Enable them for this
            site, then try again.
          </p>
        ) : null}

        {status === "off" || status === "on" ? (
          <>
            <p>
              {status === "on"
                ? "This device will get lock-screen alerts for chats, tasks, and invites."
                : "Enable to get lock-screen alerts even when Rowgon is closed."}
            </p>
            <p className="text-[color:var(--tide-deep)]/55">
              Tip: chat alerts are skipped if that conversation was open in the
              last ~2 minutes. Use “Send test” to verify the phone pipe.
            </p>
            {!canOfferWebPushPrompt() && status === "off" ? (
              <p className="text-[color:var(--tide-deep)]/55">
                Push isn’t available in this browsing mode.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {status === "off" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void enable()}
                  className="tide-btn-primary disabled:opacity-60"
                >
                  {busy ? "Enabling…" : "Enable notifications"}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void sendTest()}
                    className="tide-btn-primary disabled:opacity-60"
                  >
                    {busy ? "Working…" : "Send test notification"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void enable()}
                    className="tide-btn-secondary disabled:opacity-60"
                  >
                    Re-save this device
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void disable()}
                    className="tide-btn-secondary disabled:opacity-60"
                  >
                    Turn off on this device
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={resetPrompt}
                className="text-sm text-[color:var(--tide-deep)]/55 underline-offset-2 hover:underline"
              >
                Reset “don’t ask” / snooze
              </button>
            </div>
          </>
        ) : null}

        {message ? (
          <p className="rounded-lg bg-[#3DBEAB]/15 px-3 py-2 text-[color:var(--tide-deep)]">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-lg bg-[#E85D4C]/12 px-3 py-2 text-[#9b2f22]">
            {error}
          </p>
        ) : null}
      </div>
    </details>
  );
}
