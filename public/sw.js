/* Rowgon Web Push service worker — kept vanilla JS for broad browser support. */

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * Chrome Android treats a site as installable only if a controlling SW has a
 * fetch handler. Pass-through — no offline cache yet; needed for Install /
 * Add to Home Screen (and for Web Push scope).
 */
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

self.addEventListener("push", (event) => {
  let data = {
    title: "Rowgon",
    body: "You have a new update.",
    url: "/app/notifications",
    tag: undefined,
  };
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch {
    try {
      const text = event.data?.text();
      if (text) data.body = text;
    } catch {
      /* ignore */
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Rowgon", {
      body: data.body || "",
      icon: "/brand/rowgon-512.png",
      badge: "/brand/favicon-32.png",
      tag: data.tag || "rowgon",
      data: { url: data.url || "/app/notifications" },
      renotify: Boolean(data.tag),
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/app/notifications";
  const url = new URL(target, self.location.origin).href;
  const pathWithQuery = `${new URL(url).pathname}${new URL(url).search}${new URL(url).hash}`;

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Prefer an already-open Rowgon window (app open) and deep-link into the thread.
      for (const client of all) {
        if (!client.url.startsWith(self.location.origin)) continue;
        if (!("focus" in client)) continue;
        await client.focus();
        try {
          if ("navigate" in client) {
            await client.navigate(url);
            return;
          }
        } catch {
          /* fall through to postMessage */
        }
        try {
          client.postMessage({ type: "rowgon-navigate", url: pathWithQuery });
          return;
        } catch {
          /* try next client */
        }
      }

      // App closed / no window — open the deep link fresh.
      if (self.clients.openWindow) {
        await self.clients.openWindow(url);
      }
    })(),
  );
});
