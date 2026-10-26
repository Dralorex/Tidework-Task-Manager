import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getWebPushPublicKey,
  isWebPushConfigured,
} from "@/lib/web-push-server";

export const dynamic = "force-dynamic";

/**
 * Server-side push health for Settings.
 * Browser "on" ≠ saved subscription — this is the source of truth for sends.
 */
export async function GET() {
  const configured = isWebPushConfigured();
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({
      configured,
      publicKeyPrefix: configured
        ? (getWebPushPublicKey()?.slice(0, 12) ?? null)
        : null,
      authenticated: false,
      subscriptionCount: 0,
    });
  }

  const subscriptionCount = await prisma.webPushSubscription.count({
    where: { userId: user.id },
  });

  return NextResponse.json({
    configured,
    publicKeyPrefix: configured
      ? (getWebPushPublicKey()?.slice(0, 12) ?? null)
      : null,
    authenticated: true,
    subscriptionCount,
  });
}
