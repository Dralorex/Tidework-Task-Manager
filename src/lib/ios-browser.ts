/**
 * iPhone / iPad browser detection for Home Screen + notification help.
 * On iOS, only Safari-installed Home Screen apps can receive Web Push.
 */

export type IosBrowserId =
  | "safari"
  | "chrome"
  | "firefox"
  | "edge"
  | "opera"
  | "brave"
  | "duckduckgo"
  | "samsung"
  | "in-app"
  | "other";

export type IosBrowserProfile = {
  id: IosBrowserId;
  label: string;
  /** Can eventually get lock-screen Web Push (Safari Home Screen only). */
  canGetPushNotifications: boolean;
  /** This browser can create a Home Screen icon from its own UI. */
  canAddToHomeScreen: boolean;
  /** Steps to Add to Home Screen in THIS browser (empty if unsupported). */
  homeScreenSteps: string[];
  /** Steps for notification-capable install (Safari only). */
  notificationHomeScreenSteps: string[];
};

function ua(): string {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent || "";
}

export function detectIosBrowser(): IosBrowserProfile {
  const raw = ua();
  const lower = raw.toLowerCase();

  // In-app browsers first — they almost never support A2HS well.
  if (
    /fban|fbav|instagram|line\/|twitter|linkedinapp|gsa\//i.test(raw) ||
    (/wv\)|; wv/i.test(raw) && /iphone|ipad|ipod/i.test(raw))
  ) {
    return {
      id: "in-app",
      label: "this in-app browser",
      canGetPushNotifications: false,
      canAddToHomeScreen: false,
      homeScreenSteps: [],
      notificationHomeScreenSteps: [],
    };
  }

  if (/crios/i.test(raw)) {
    return {
      id: "chrome",
      label: "Chrome",
      canGetPushNotifications: false,
      canAddToHomeScreen: true,
      homeScreenSteps: [
        "Tap the Share button (square with an arrow) in Chrome.",
        "Scroll and tap “Add to Home Screen”.",
        "Tap Add. The icon opens Rowgon in Chrome (no lock-screen notifications on iPhone).",
      ],
      notificationHomeScreenSteps: [],
    };
  }

  if (/fxios/i.test(raw)) {
    return {
      id: "firefox",
      label: "Firefox",
      canGetPushNotifications: false,
      canAddToHomeScreen: true,
      homeScreenSteps: [
        "Tap the Share / menu button in Firefox.",
        "Choose “Add to Home Screen”.",
        "Tap Add. The icon opens Rowgon in Firefox (no lock-screen notifications on iPhone).",
      ],
      notificationHomeScreenSteps: [],
    };
  }

  if (/edgios/i.test(raw)) {
    return {
      id: "edge",
      label: "Edge",
      canGetPushNotifications: false,
      canAddToHomeScreen: true,
      homeScreenSteps: [
        "Tap the Share / … menu in Edge.",
        "Choose “Add to Home Screen”.",
        "Tap Add. The icon opens Rowgon in Edge (no lock-screen notifications on iPhone).",
      ],
      notificationHomeScreenSteps: [],
    };
  }

  if (/opios|opt\//i.test(raw)) {
    return {
      id: "opera",
      label: "Opera",
      canGetPushNotifications: false,
      canAddToHomeScreen: true,
      homeScreenSteps: [
        "Open the menu / Share sheet in Opera.",
        "Choose “Add to Home Screen” if listed.",
        "Tap Add. This icon will not get lock-screen notifications on iPhone.",
      ],
      notificationHomeScreenSteps: [],
    };
  }

  if (/duckduckgo|ddg/i.test(raw)) {
    return {
      id: "duckduckgo",
      label: "DuckDuckGo",
      canGetPushNotifications: false,
      canAddToHomeScreen: false,
      homeScreenSteps: [],
      notificationHomeScreenSteps: [],
    };
  }

  if (/samsungbrowser/i.test(raw)) {
    return {
      id: "samsung",
      label: "Samsung Internet",
      canGetPushNotifications: false,
      canAddToHomeScreen: false,
      homeScreenSteps: [],
      notificationHomeScreenSteps: [],
    };
  }

  // Brave on iOS often looks like Safari; check after other Chromium tokens.
  if (/brave/i.test(raw)) {
    return {
      id: "brave",
      label: "Brave",
      canGetPushNotifications: false,
      canAddToHomeScreen: true,
      homeScreenSteps: [
        "Tap Share in Brave.",
        "Choose “Add to Home Screen” if available.",
        "Tap Add. Lock-screen notifications still require Safari on iPhone.",
      ],
      notificationHomeScreenSteps: [],
    };
  }

  // Safari: has Safari, not another browser token.
  const isSafari =
    /safari/i.test(raw) &&
    !/crios|fxios|edgios|opios|opt\/|chrome|android/i.test(raw);

  if (isSafari || (/iphone|ipad|ipod/i.test(raw) && !/crios|fxios|edgios/i.test(raw))) {
    return {
      id: "safari",
      label: "Safari",
      canGetPushNotifications: true,
      canAddToHomeScreen: true,
      homeScreenSteps: [
        "Tap the Share button (square with an upward arrow) at the bottom of Safari.",
        "Scroll and tap “Add to Home Screen”.",
        "Tap Add. Open Rowgon from the new Home Screen icon anytime.",
      ],
      notificationHomeScreenSteps: [
        "Tap the Share button (square with an upward arrow) at the bottom of Safari.",
        "Scroll and tap “Add to Home Screen”, then tap Add.",
        "Close Safari and open Rowgon from the new Home Screen icon (not from a Safari tab).",
        "When Rowgon asks, tap Yes / Allow for notifications.",
      ],
    };
  }

  // Fallback unknown iOS browser
  void lower;
  return {
    id: "other",
    label: "this browser",
    canGetPushNotifications: false,
    canAddToHomeScreen: false,
    homeScreenSteps: [],
    notificationHomeScreenSteps: [],
  };
}

export const IOS_HELP_STORAGE_KEY = "rowgon_ios_homescreen_help_v2";
