"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  THEME_COOKIE,
  LEGACY_THEME_COOKIE,
  isDisplayThemeId,
  type DisplayThemeId,
} from "@/lib/theme";
import type { ActionResult } from "@/app/actions/auth";

export async function setDisplayThemeAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const theme = String(formData.get("theme") ?? "");
  if (!isDisplayThemeId(theme)) {
    return { ok: false, error: "Unknown display mode." };
  }

  const cookieStore = await cookies();
  cookieStore.set(THEME_COOKIE, theme as DisplayThemeId, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 5,
  });
  cookieStore.delete(LEGACY_THEME_COOKIE);

  revalidatePath("/", "layout");
  return { ok: true };
}
