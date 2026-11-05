import "server-only";
import { createECDH } from "crypto";
import webpush from "web-push";
import { prisma } from "@/lib/db";

export type WebPushPayload = {
  title: string;
  body: string;
  /** Deep link opened when the notification is tapped. */
  url?: string;
  tag?: string;
  /** Default high — chat alerts should wake the device. */
  urgency?: "very-low" | "low" | "normal" | "high";
};

export type WebPushVapidStatus = {
  configured: boolean;
  /** Public/private form a valid ECDH pair (required for sends). */
  pairValid: boolean;
  /** Credentials come from DB override vs process env. */
  source: "database" | "env" | "none";
  publicKey: string | null;
  publicKeyPrefix: string | null;
};

type VapidCreds = {
  publicKey: string;
  privateKey: string;
  subject: string;
  source: "database" | "env";
};

let appliedFingerprint: string | null = null;

function urlBase64ToBuffer(base64String: string): Buffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64");
}

/** True when private key derives to the given public key (uncompressed P-256). */
export function vapidKeysMatch(publicKey: string, privateKey: string): boolean {
  try {
    const pub = urlBase64ToBuffer(publicKey.trim());
    const priv = urlBase64ToBuffer(privateKey.trim());
    if (pub.length !== 65 || pub[0] !== 0x04 || priv.length !== 32) return false;
    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(priv);
    return ecdh.getPublicKey(null, "uncompressed").equals(pub);
  } catch {
    return false;
  }
}

function envCreds(): VapidCreds | null {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  const subject =
    process.env.WEB_PUSH_VAPID_SUBJECT?.trim() ||
    process.env.EMAIL_REPLY_TO?.trim() ||
    "mailto:noreply@rowgon.com";
  return { publicKey, privateKey, subject, source: "env" };
}

async function dbCreds(): Promise<VapidCreds | null> {
  try {
    const row = await prisma.webPushVapidConfig.findUnique({
      where: { id: "default" },
    });
    if (!row?.publicKey?.trim() || !row?.privateKey?.trim()) return null;
    return {
      publicKey: row.publicKey.trim(),
      privateKey: row.privateKey.trim(),
      subject: row.subject?.trim() || "mailto:noreply@rowgon.com",
      source: "database",
    };
  } catch (err) {
    // Table may not exist until migrate finishes on a fresh deploy.
    console.warn("[web-push] could not read VAPID config table", err);
    return null;
  }
}

/**
 * Prefer a valid DB override, then a valid env pair, then any configured pair
 * (so status can still report mismatch).
 */
async function resolveVapidCreds(): Promise<VapidCreds | null> {
  const fromDb = await dbCreds();
  if (fromDb && vapidKeysMatch(fromDb.publicKey, fromDb.privateKey)) {
    return fromDb;
  }
  const fromEnv = envCreds();
  if (fromEnv && vapidKeysMatch(fromEnv.publicKey, fromEnv.privateKey)) {
    return fromEnv;
  }
  // Prefer DB even if invalid (operator just saved) for clear error paths.
  if (fromDb) return fromDb;
  return fromEnv;
}

function applyVapid(creds: VapidCreds) {
  const fingerprint = `${creds.source}:${creds.publicKey}:${creds.privateKey}:${creds.subject}`;
  if (appliedFingerprint === fingerprint) return;
  webpush.setVapidDetails(creds.subject, creds.publicKey, creds.privateKey);
  appliedFingerprint = fingerprint;
}

/** Clear cached web-push library state after saving new keys. */
export function resetWebPushVapidCache() {
  appliedFingerprint = null;
}

export async function getWebPushVapidStatus(): Promise<WebPushVapidStatus> {
  const creds = await resolveVapidCreds();
  if (!creds) {
    return {
      configured: false,
      pairValid: false,
      source: "none",
      publicKey: null,
      publicKeyPrefix: null,
    };
  }
  const pairValid = vapidKeysMatch(creds.publicKey, creds.privateKey);
  return {
    configured: true,
    pairValid,
    source: creds.source,
    publicKey: creds.publicKey,
    publicKeyPrefix: creds.publicKey.slice(0, 12),
  };
}

export async function isWebPushConfigured(): Promise<boolean> {
  const status = await getWebPushVapidStatus();
  return status.configured && status.pairValid;
}

export async function getWebPushPublicKey(): Promise<string | null> {
  const status = await getWebPushVapidStatus();
  return status.publicKey;
}

async function ensureVapid(): Promise<boolean> {
  const creds = await resolveVapidCreds();
  if (!creds) return false;
  if (!vapidKeysMatch(creds.publicKey, creds.privateKey)) {
    console.error(
      "[web-push] VAPID public/private keys do not match — all sends will fail (403). Fix Vercel env or save a matching pair in Settings.",
    );
    return false;
  }
  applyVapid(creds);
  return true;
}

export type WebPushSendResult = {
  attempted: number;
  sent: number;
  stale: number;
  failed: number;
  lastError?: string;
};

/**
 * Send OS / lock-screen notifications to subscribed browsers.
 * Gone subscriptions (410/404) are deleted.
 */
export async function sendWebPushToUsers(
  userIds: string[],
  payload: WebPushPayload,
): Promise<WebPushSendResult> {
  const empty: WebPushSendResult = {
    attempted: 0,
    sent: 0,
    stale: 0,
    failed: 0,
  };
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return empty;
  if (!(await ensureVapid())) {
    console.error("[web-push] not configured or VAPID pair invalid");
    return {
      ...empty,
      lastError:
        "Web push not configured or VAPID public/private keys don’t match.",
    };
  }

  const subs = await prisma.webPushSubscription.findMany({
    where: { userId: { in: unique } },
  });
  if (subs.length === 0) {
    console.warn(
      "[web-push] no subscriptions for users",
      unique.length,
      unique.slice(0, 3),
    );
    return empty;
  }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/app/notifications",
    tag: payload.tag,
  });

  const staleIds: string[] = [];
  let sent = 0;
  let failed = 0;
  let lastError: string | undefined;
  const urgency = payload.urgency ?? "high";

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
          { TTL: 60 * 60 * 12, urgency },
        );
        sent += 1;
      } catch (err) {
        const status =
          err && typeof err === "object" && "statusCode" in err
            ? Number((err as { statusCode?: number }).statusCode)
            : 0;
        if (status === 404 || status === 410) {
          staleIds.push(sub.id);
        } else {
          failed += 1;
          const hint =
            status === 403
              ? " (HTTP 403 — usually VAPID public/private mismatch)"
              : status
                ? ` (HTTP ${status})`
                : "";
          lastError =
            (err instanceof Error ? err.message : "unknown send error") + hint;
          console.error("[web-push] send failed", sub.id, status || "", err);
        }
      }
    }),
  );

  if (staleIds.length > 0) {
    await prisma.webPushSubscription.deleteMany({
      where: { id: { in: staleIds } },
    });
  }

  return {
    attempted: subs.length,
    sent,
    stale: staleIds.length,
    failed,
    lastError,
  };
}

/** Per-user payloads (e.g. chat fan-out with different titles). */
export async function sendWebPushMessages(
  messages: { userId: string; payload: WebPushPayload }[],
): Promise<void> {
  if (messages.length === 0) return;
  if (!(await ensureVapid())) return;

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

/** Persist a matching VAPID pair (DB override). */
export async function saveWebPushVapidConfig(input: {
  publicKey: string;
  privateKey: string;
  subject?: string;
  updatedById?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const publicKey = input.publicKey.trim();
  const privateKey = input.privateKey.trim();
  const subject =
    input.subject?.trim() ||
    process.env.WEB_PUSH_VAPID_SUBJECT?.trim() ||
    "mailto:noreply@rowgon.com";

  if (!publicKey || !privateKey) {
    return { ok: false, error: "Public and private keys are required." };
  }
  if (!vapidKeysMatch(publicKey, privateKey)) {
    return {
      ok: false,
      error:
        "Those keys don’t match each other. Paste a public/private pair from the same `npx web-push generate-vapid-keys` run.",
    };
  }

  await prisma.webPushVapidConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      publicKey,
      privateKey,
      subject,
      updatedById: input.updatedById ?? null,
    },
    update: {
      publicKey,
      privateKey,
      subject,
      updatedById: input.updatedById ?? null,
    },
  });
  resetWebPushVapidCache();
  return { ok: true };
}
