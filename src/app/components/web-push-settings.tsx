"use client";

import { useEffect, useState, useTransition } from "react";
import {
  saveWebPushVapidAction,
  sendTestWebPushAction,
} from "@/app/actions/notifications";
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
  pairValid: boolean;
  source: "database" | "env" | "none";
  publicKeyPrefix: string | null;
  subscriptionCount: number;
};

export function WebPushSettings({
  initialServerSubscriptionCount = 0,
  initialPairValid = true,
  initialConfigured = true,
  initialPublicKey = "",
  initialSource = "env" as const,
}: {
  initialServerSubscriptionCount?: number;
  initialPairValid?: boolean;
  initialConfigured?: boolean;
  initialPublicKey?: string;
  initialSource?: "database" | "env" | "none";
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [server, setServer] = useState<ServerPushStatus>({
    configured: initialConfigured,
    pairValid: initialPairValid,
    source: initialSource,
    publicKeyPrefix: initialPublicKey.slice(0, 12) || null,
    subscriptionCount: initialServerSubscriptionCount,
  });
  const [publicKey, setPublicKey] = useState(initialPublicKey);
  const [privateKey, setPrivateKey] = useState("");
  const [pending, startTransition] = useTransition();

  async function refreshServerStatus() {
    try {
      const res = await fetch("/api/push/status", { credentials: "same-origin" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        configured?: boolean;
        pairValid?: boolean;
        source?: "database" | "env" | "none";
        publicKeyPrefix?: string | null;
        subscriptionCount?: number;
      };
      setServer({
        configured: Boolean(data.configured),
        pairValid: data.pairValid !== false,
        source: data.source ?? "none",
        publicKeyPrefix: data.publicKeyPrefix ?? null,
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

  function onSaveVapid(formData: FormData) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await saveWebPushVapidAction(null, formData);
      await refreshServerStatus();
      if (!result?.ok) {
        setError(result?.error ?? "Couldn’t save VAPID keys.");
        return;
      }
      setPrivateKey("");
      setMessage(
        "Matching VAPID keys saved. Tap Re-save on each device, then Send test.",
      );
    });
  }

  const browserOnServerOff =
    status === "on" &&
    server.configured &&
    server.pairValid &&
    server.subscriptionCount === 0;
  const pairBroken = server.configured && !server.pairValid;
  const needsRepair = !server.configured || pairBroken;

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

        {pairBroken ? (
          <p className="rounded-lg bg-[#E85D4C]/12 px-3 py-2 text-[#9b2f22]">
            Server VAPID keys don’t match — push providers reject every send
            (phone and computer). Paste a matching public/private pair under
            Repair push keys, then Re-save this device and Send test.
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
                : !server.pairValid
                  ? "keys present but public/private don’t match — sends will fail."
                  : server.subscriptionCount === 0
                    ? `keys OK (${server.source}); no devices saved for your account yet.`
                    : `keys OK (${server.source}); ${server.subscriptionCount} device${server.subscriptionCount === 1 ? "" : "s"} saved.`}
            </p>
            {browserOnServerOff ? (
              <p className="rounded-lg bg-[#E85D4C]/12 px-3 py-2 text-[#9b2f22]">
                This browser looks “on”, but the server has no subscription saved —
                chat pushes can’t reach you. Tap <strong>Re-save this device</strong>{" "}
                or <strong>Send test</strong>.
              </p>
            ) : null}
            <p className="text-[color:var(--tide-deep)]/55">
              Tip: on iPhone use the Home Screen app (not Safari/Chrome tabs). Use
              “Send test” first — if that fails, chat pushes won’t work either.
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
                  disabled={busy || pairBroken}
                  onClick={() => void enable()}
                  className="tide-btn-primary disabled:opacity-60"
                >
                  {busy ? "Enabling…" : "Enable notifications"}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={busy || pairBroken}
                    onClick={() => void sendTest()}
                    className="tide-btn-primary disabled:opacity-60"
                  >
                    {busy ? "Working…" : "Send test notification"}
                  </button>
                  <button
                    type="button"
                    disabled={busy || pairBroken}
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

        <details className="rounded-lg border border-[#0A3D45]/12 p-3" open={needsRepair}>
          <summary className="cursor-pointer font-medium text-[color:var(--tide-deep)]">
            Repair push keys
          </summary>
          <form action={onSaveVapid} className="mt-3 space-y-3">
            <p className="text-[color:var(--tide-deep)]/55">
              Keys must be a matching pair from{" "}
              <code className="text-xs">npx web-push generate-vapid-keys</code>.
              Saving here overrides broken Vercel env until you fix Production
              there too.
            </p>
            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--tide-deep)]/55">
                Public key
              </span>
              <textarea
                name="publicKey"
                required
                rows={2}
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
                className="tide-input w-full font-mono text-xs"
                spellCheck={false}
                autoComplete="off"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--tide-deep)]/55">
                Private key
              </span>
              <textarea
                name="privateKey"
                required
                rows={2}
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                className="tide-input w-full font-mono text-xs"
                spellCheck={false}
                autoComplete="off"
              />
            </label>
            <input
              type="hidden"
              name="subject"
              value="mailto:noreply@rowgon.com"
            />
            <button
              type="submit"
              disabled={pending}
              className="tide-btn-secondary disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save matching keys"}
            </button>
          </form>
        </details>

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
