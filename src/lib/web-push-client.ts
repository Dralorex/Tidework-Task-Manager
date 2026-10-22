/** Client-only helpers for Web Push subscribe / iOS Home Screen gating. */

const PROMPT_KEY = "rowgon_web_push_prompt_v1";

export type PushPromptPref =
  | { status: "never" }
  | { status: "snooze"; until: number }
  | { status: "dismissed_once" };

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS reports as MacIntel with touch
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const iosStandalone = Boolean(
    (navigator as Navigator & { standalone?: boolean }).standalone,
  );
  return Boolean(mq || iosStandalone);
}

/** iPhone/iPad Safari tab: never auto-prompt. Home Screen PWA: OK. */
export function canOfferWebPushPrompt(): boolean {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return false;
  }
  if (isIosDevice() && !isStandaloneDisplay()) return false;
  return true;
}

export function readPushPromptPref(): PushPromptPref | null {
  try {
    const raw = localStorage.getItem(PROMPT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PushPromptPref;
  } catch {
    return null;
  }
}

export function writePushPromptPref(pref: PushPromptPref | null) {
  try {
    if (!pref) localStorage.removeItem(PROMPT_KEY);
    else localStorage.setItem(PROMPT_KEY, JSON.stringify(pref));
  } catch {
    /* private mode */
  }
}

export function shouldAutoAskPush(): boolean {
  if (!canOfferWebPushPrompt()) return false;
  if (Notification.permission !== "default") return false;
  const pref = readPushPromptPref();
  if (!pref) return true;
  if (pref.status === "never") return false;
  if (pref.status === "snooze") return Date.now() >= pref.until;
  if (pref.status === "dismissed_once") return false;
  return true;
}

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (err) {
    console.error("[web-push] SW register failed", err);
    return null;
  }
}

export async function subscribeWebPush(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  if (!("PushManager" in window) || !("Notification" in window)) {
    return { ok: false, error: "This browser doesn’t support push notifications." };
  }

  const vapidRes = await fetch("/api/push/vapid-public", { credentials: "same-origin" });
  const vapid = (await vapidRes.json()) as {
    configured?: boolean;
    publicKey?: string | null;
  };
  if (!vapid.configured || !vapid.publicKey) {
    return { ok: false, error: "Push notifications aren’t set up on the server yet." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, error: "Notification permission was not granted." };
  }

  const reg = await registerPushServiceWorker();
  if (!reg) return { ok: false, error: "Couldn’t register the notification worker." };

  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
    });
  }

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
  if (!res.ok) {
    return { ok: false, error: "Couldn’t save this device’s push subscription." };
  }
  writePushPromptPref(null);
  return { ok: true };
}

export async function unsubscribeWebPush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    const endpoint = sub.endpoint;
    await sub.unsubscribe().catch(() => {});
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint }),
    }).catch(() => {});
  } else {
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      credentials: "same-origin",
    }).catch(() => {});
  }
}
