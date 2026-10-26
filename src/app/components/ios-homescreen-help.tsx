"use client";

import { useEffect, useMemo, useState } from "react";
import {
  detectIosBrowser,
  IOS_HELP_STORAGE_KEY,
  type IosBrowserProfile,
} from "@/lib/ios-browser";
import { isIosDevice, isStandaloneDisplay } from "@/lib/web-push-client";

type Step =
  | "ask"
  | "push-safari-howto"
  | "push-must-safari"
  | "homescreen-howto"
  | "homescreen-unsupported";

/**
 * iPhone-only signed-in help: notifications vs Home Screen app, with
 * per-browser instructions (Safari can get push; Chrome/etc. cannot).
 */
export function IosHomescreenHelp() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("ask");
  const [browser, setBrowser] = useState<IosBrowserProfile | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isIosDevice()) return;
    // Already a Home Screen app — normal push prompt handles notifications.
    if (isStandaloneDisplay()) return;
    try {
      if (localStorage.getItem(IOS_HELP_STORAGE_KEY)) return;
    } catch {
      /* private mode — still show once per session */
    }
    setBrowser(detectIosBrowser());
    const t = window.setTimeout(() => setOpen(true), 900);
    return () => window.clearTimeout(t);
  }, []);

  const profile = useMemo(() => browser ?? detectIosBrowser(), [browser]);

  function dismiss() {
    try {
      localStorage.setItem(IOS_HELP_STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  function onWantNotifications() {
    if (profile.canGetPushNotifications) {
      setStep("push-safari-howto");
    } else {
      setStep("push-must-safari");
    }
  }

  function onJustWebApp() {
    if (profile.canAddToHomeScreen && profile.homeScreenSteps.length > 0) {
      setStep("homescreen-howto");
    } else {
      setStep("homescreen-unsupported");
    }
  }

  if (!open || !browser) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0A3D45]/35 p-3 sm:items-center">
      <div
        className="tide-panel w-full max-w-md border border-[#0A3D45]/15 p-5 shadow-lg animate-tide-rise"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ios-help-title"
      >
        {step === "ask" ? (
          <>
            <h2
              id="ios-help-title"
              className="font-[family-name:var(--font-display)] text-xl text-[#0A3D45]"
            >
              Do you want app notifications?
            </h2>
            <p className="mt-2 text-sm text-[#0A3D45]/70">
              You’re on <span className="font-semibold">{profile.label}</span> on
              iPhone. Lock-screen alerts need a Home Screen app
              {profile.canGetPushNotifications
                ? " from Safari."
                : " — and on this browser, iOS only allows them from Safari."}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={onWantNotifications}
                className="tide-btn-primary w-full"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={onJustWebApp}
                className="tide-btn-secondary w-full"
              >
                I’m fine with just the Home Screen app
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="w-full py-2 text-sm text-[#0A3D45]/55 underline-offset-2 hover:underline"
              >
                No thanks
              </button>
            </div>
          </>
        ) : null}

        {step === "push-safari-howto" ? (
          <>
            <h2
              id="ios-help-title"
              className="font-[family-name:var(--font-display)] text-xl text-[#0A3D45]"
            >
              Add Rowgon for notifications
            </h2>
            <p className="mt-2 text-sm text-[#0A3D45]/70">
              Follow these steps in Safari, then open Rowgon from your Home
              Screen to allow notifications.
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[#0A3D45]/80">
              {profile.notificationHomeScreenSteps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <button
              type="button"
              onClick={dismiss}
              className="tide-btn-primary mt-4 w-full"
            >
              OK
            </button>
          </>
        ) : null}

        {step === "push-must-safari" ? (
          <>
            <h2
              id="ios-help-title"
              className="font-[family-name:var(--font-display)] text-xl text-[#0A3D45]"
            >
              Switch to Safari for notifications
            </h2>
            <p className="mt-2 text-sm text-[#0A3D45]/70">
              iPhone doesn’t allow lock-screen notifications from{" "}
              <span className="font-semibold">{profile.label}</span>. Apple only
              supports them for websites added to the Home Screen from{" "}
              <span className="font-semibold">Safari</span>.
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[#0A3D45]/80">
              <li>Copy this site’s address, or tap the address bar and copy the URL.</li>
              <li>Open Safari and paste the Rowgon link.</li>
              <li>Sign in if needed.</li>
              <li>Tap Share → “Add to Home Screen” → Add.</li>
              <li>Open Rowgon from the Home Screen icon and allow notifications.</li>
            </ol>
            <button
              type="button"
              onClick={dismiss}
              className="tide-btn-primary mt-4 w-full"
            >
              OK
            </button>
          </>
        ) : null}

        {step === "homescreen-howto" ? (
          <>
            <h2
              id="ios-help-title"
              className="font-[family-name:var(--font-display)] text-xl text-[#0A3D45]"
            >
              Add the Home Screen app in {profile.label}
            </h2>
            <p className="mt-2 text-sm text-[#0A3D45]/70">
              {profile.canGetPushNotifications
                ? "This adds a Home Screen icon. For lock-screen alerts, open that icon and allow notifications when asked."
                : `This adds a shortcut that opens in ${profile.label}. It will not get lock-screen notifications on iPhone — use Safari’s Home Screen app for that.`}
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[#0A3D45]/80">
              {profile.homeScreenSteps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <button
              type="button"
              onClick={dismiss}
              className="tide-btn-primary mt-4 w-full"
            >
              OK
            </button>
          </>
        ) : null}

        {step === "homescreen-unsupported" ? (
          <>
            <h2
              id="ios-help-title"
              className="font-[family-name:var(--font-display)] text-xl text-[#0A3D45]"
            >
              Use Safari to add a Home Screen app
            </h2>
            <p className="mt-2 text-sm text-[#0A3D45]/70">
              <span className="font-semibold">{profile.label}</span> on iPhone
              doesn’t support creating a Home Screen app for Rowgon. Open this
              site in <span className="font-semibold">Safari</span>, then use
              Share → Add to Home Screen.
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[#0A3D45]/80">
              <li>Open Safari and go to the same Rowgon URL.</li>
              <li>Sign in if needed.</li>
              <li>Tap Share → “Add to Home Screen” → Add.</li>
            </ol>
            <button
              type="button"
              onClick={dismiss}
              className="tide-btn-primary mt-4 w-full"
            >
              OK
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
