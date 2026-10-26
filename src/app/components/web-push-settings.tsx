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

type ServerPushStatus = {
  configured: boolean;
  subscriptionCount: number;
};

export function WebPushSettings({
  initialServerSubscriptionCount = 0,
}: {
  initialServerSubscriptionCount?: number;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [server, setServer] = useState<ServerPushStatus>({
    configured: true,
    subscriptionCount: initialServerSubscriptionCount,
  });

  async function refreshServerStatus() {
    try {
      const res = await fetch("/api/push/status", { credentials: "same-origin" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        configured?: boolean;
        subscriptionCount?: number;
      };
      setServer({
        configured: Boolean(data.configured),
        subscriptionCount: Number(data.subscriptionCount ?? 0),
      });
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void (async () => {
      void refreshServerStatus();
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
    await refreshServerStatus();
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
    await refreshServerStatus();
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
      await refreshServerStatus();
      return;
    }
    setStatus("on");
    const result = await sendTestWebPushAction();
    await refreshServerStatus();
    setBusy(false);
    if (!result?.ok) {
      setError(result?.error ?? "Test send failed.");
      return;
    }
    setMessage(
      `Test sent to ${result.sent} of ${result.attempted} device(s) (server has ${result.subscriptionCount} saved). Lock the phone or leave Rowgon — you should see “Rowgon test” within a few seconds.`,
    );
  }

  function resetPrompt() {
    writePushPromptPref(null);
    setMessage("We’ll ask again next time you’re eligible.");
    setError(null);
  }

  const browserOnServerOff =
    status === "on" && server.configured && server.subscriptionCount === 0;

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
              Server:{" "}
              {!server.configured
                ? "push not configured (missing VAPID keys)."
                : server.subscriptionCount === 0
                  ? "no devices saved for your account yet."
                  : `${server.subscriptionCount} device${server.subscriptionCount === 1 ? "" : "s"} saved for your account.`}
            </p>
            {browserOnServerOff ? (
              <p className="rounded-lg bg-[#E85D4C]/12 px-3 py-2 text-[#9b2f22]">
                This browser looks “on”, but the server has no subscription saved —
                chat pushes can’t reach you. Tap <strong>Re-save this device</strong>{" "}
                or <strong>Send test</strong>.
              </p>
            ) : null}
            <p className="text-[color:var(--tide-deep)]/55">
              Tip: open Rowgon from the Home Screen app on iPhone (not Safari or
              Chrome tabs). Use “Send test” first — if that fails, chat pushes
              won’t work either.
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
