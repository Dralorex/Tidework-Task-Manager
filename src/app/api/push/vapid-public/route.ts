import { NextResponse } from "next/server";
import { getWebPushPublicKey, isWebPushConfigured } from "@/lib/web-push-server";

export const dynamic = "force-dynamic";

/** Public VAPID key for PushManager.subscribe (safe to expose). */
export async function GET() {
  if (!isWebPushConfigured()) {
    return NextResponse.json({ configured: false, publicKey: null });
  }
  return NextResponse.json({
    configured: true,
    publicKey: getWebPushPublicKey(),
  });
}
