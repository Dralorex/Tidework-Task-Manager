"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  THEME_COOKIE,
  LEGACY_THEME_COOKIE,
  THEME_MIGRATION_COOKIE,
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
  const cookieOpts = {
    httpOnly: false,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 5,
  };

  cookieStore.set(THEME_COOKIE, theme as DisplayThemeId, cookieOpts);
  // After first explicit save, `burn` means dark-ember Burn (not legacy soft).
  cookieStore.set(THEME_MIGRATION_COOKIE, "1", cookieOpts);
  cookieStore.delete(LEGACY_THEME_COOKIE);

  revalidatePath("/", "layout");
  return { ok: true };
}
