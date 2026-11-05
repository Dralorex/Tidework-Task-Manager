import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isWebPushConfigured } from "@/lib/web-push-server";

export const dynamic = "force-dynamic";

type Body = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

export async function POST(request: Request) {
  if (!(await isWebPushConfigured())) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Web push isn’t configured (missing or mismatched VAPID keys). Fix keys in Settings or Vercel.",
      },
      { status: 503 },
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const endpoint = String(body.endpoint ?? "").trim();
  const p256dh = String(body.keys?.p256dh ?? "").trim();
  const auth = String(body.keys?.auth ?? "").trim();
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { ok: false, error: "Missing subscription fields." },
      { status: 400 },
    );
  }

  const userAgent = request.headers.get("user-agent")?.slice(0, 240) ?? null;

  await prisma.webPushSubscription.upsert({
    where: { endpoint },
    create: {
      userId: user.id,
      endpoint,
      p256dh,
      auth,
      userAgent,
    },
    update: {
      userId: user.id,
      p256dh,
      auth,
      userAgent,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let endpoint = "";
  try {
    const body = (await request.json()) as { endpoint?: string };
    endpoint = String(body.endpoint ?? "").trim();
  } catch {
    /* optional body — delete all for user */
  }

  if (endpoint) {
    await prisma.webPushSubscription.deleteMany({
      where: { userId: user.id, endpoint },
    });
  } else {
    await prisma.webPushSubscription.deleteMany({
      where: { userId: user.id },
    });
  }

  return NextResponse.json({ ok: true });
}
