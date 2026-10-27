import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getWebPushVapidStatus } from "@/lib/web-push-server";

export const dynamic = "force-dynamic";

/**
 * Server-side push health for Settings.
 * Browser "on" ≠ saved subscription — this is the source of truth for sends.
 */
export async function GET() {
  const vapid = await getWebPushVapidStatus();
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({
      configured: vapid.configured,
      pairValid: vapid.pairValid,
      source: vapid.source,
      publicKeyPrefix: vapid.publicKeyPrefix,
      authenticated: false,
      subscriptionCount: 0,
    });
  }

  const subscriptionCount = await prisma.webPushSubscription.count({
    where: { userId: user.id },
  });

  return NextResponse.json({
    configured: vapid.configured,
    pairValid: vapid.pairValid,
    source: vapid.source,
    publicKeyPrefix: vapid.publicKeyPrefix,
    authenticated: true,
    subscriptionCount,
  });
}
