import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/db";

export type WebPushPayload = {
  title: string;
  body: string;
  /** Deep link opened when the notification is tapped. */
  url?: string;
  tag?: string;
};

let vapidReady = false;

export function isWebPushConfigured(): boolean {
  return Boolean(
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() &&
      process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim(),
  );
}

export function getWebPushPublicKey(): string | null {
  const key = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  return key || null;
}

function ensureVapid() {
  if (vapidReady) return true;
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return false;
  const subject =
    process.env.WEB_PUSH_VAPID_SUBJECT?.trim() ||
    process.env.EMAIL_REPLY_TO?.trim() ||
    "mailto:noreply@rowgon.com";
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidReady = true;
  return true;
}

/**
 * Send OS / lock-screen notifications to subscribed browsers.
 * Gone subscriptions (410/404) are deleted. Failures are swallowed.
 */
export async function sendWebPushToUsers(
  userIds: string[],
  payload: WebPushPayload,
): Promise<void> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0 || !ensureVapid()) return;

  const subs = await prisma.webPushSubscription.findMany({
    where: { userId: { in: unique } },
  });
  if (subs.length === 0) return;

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/app/notifications",
    tag: payload.tag,
  });

  const staleIds: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
          { TTL: 60 * 60 * 12, urgency: "normal" },
        );
      } catch (err) {
        const status =
          err && typeof err === "object" && "statusCode" in err
            ? Number((err as { statusCode?: number }).statusCode)
            : 0;
        if (status === 404 || status === 410) {
          staleIds.push(sub.id);
        } else {
          console.error("[web-push] send failed", sub.id, err);
        }
      }
    }),
  );

  if (staleIds.length > 0) {
    await prisma.webPushSubscription.deleteMany({
      where: { id: { in: staleIds } },
    });
  }
}

/** Per-user payloads (e.g. chat fan-out with different titles). */
export async function sendWebPushMessages(
  messages: { userId: string; payload: WebPushPayload }[],
): Promise<void> {
  if (messages.length === 0 || !ensureVapid()) return;

  // Same payload text → one fan-out batch; otherwise send per user.
  const byKey = new Map<string, { userIds: string[]; payload: WebPushPayload }>();
  for (const m of messages) {
    if (!m.userId) continue;
    const key = `${m.payload.title}\0${m.payload.body}\0${m.payload.url ?? ""}\0${m.payload.tag ?? ""}`;
    const entry = byKey.get(key);
    if (entry) entry.userIds.push(m.userId);
    else byKey.set(key, { userIds: [m.userId], payload: m.payload });
  }

  await Promise.all(
    [...byKey.values()].map(({ userIds, payload }) =>
      sendWebPushToUsers(userIds, payload),
    ),
  );
}
