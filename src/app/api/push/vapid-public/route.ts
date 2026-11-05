import { NextResponse } from "next/server";
import {
  getWebPushPublicKey,
  getWebPushVapidStatus,
} from "@/lib/web-push-server";

export const dynamic = "force-dynamic";

/** Public VAPID key for PushManager.subscribe (safe to expose). */
export async function GET() {
  const status = await getWebPushVapidStatus();
  if (!status.configured || !status.pairValid) {
    return NextResponse.json({
      configured: false,
      publicKey: null,
      pairValid: status.pairValid,
    });
  }
  return NextResponse.json({
    configured: true,
    publicKey: await getWebPushPublicKey(),
    pairValid: true,
  });
}
