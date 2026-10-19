"use server";

import { revalidatePath } from "next/cache";

import { eq } from "drizzle-orm";

import { fail, ok, VALIDATION_ERROR, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/guard";
import { getDb, getSqlite } from "@/lib/db/client";
import { settings, THEMES, type Theme } from "@/lib/db/schema";
import { readSettings } from "@/lib/settings";
import { recomputeAllTrades } from "@/lib/trades/recompute";
import { appearanceSettingsSchema, fieldErrors, generalSettingsSchema, sessionsSettingsSchema } from "@/lib/validation";

function revalidate() {
  revalidatePath("/", "layout");
}

export async function updateGeneralSettings(input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = generalSettingsSchema.safeParse(input);
  if (!parsed.success) return fail(VALIDATION_ERROR, fieldErrors(parsed.error));
  const previous = readSettings();
  getDb().update(settings).set(parsed.data).where(eq(settings.id, 1)).run();
  // Results depend on the BE threshold and sessions on the display time zone.
  if (previous.beThreshold !== parsed.data.beThreshold || previous.displayTimezone !== parsed.data.displayTimezone) {
    recomputeAllTrades();
  }
  revalidate();
  return ok();
}

export async function updateAppearanceSettings(input: unknown): Promise<ActionResult> {
  await requireUser();
  const parsed = appearanceSettingsSchema.safeParse(input);
  if (!parsed.success) return fail(VALIDATION_ERROR, fieldErrors(parsed.error));
  getDb().update(settings).set(parsed.data).where(eq(settings.id, 1)).run();
  revalidate();
  return ok();
}

export async function updateTheme(theme: Theme): Promise<ActionResult> {
  await requireUser();
  if (!THEMES.includes(theme)) return fail(VALIDATION_ERROR);
  getDb().update(settings).set({ theme }).where(eq(settings.id, 1)).run();
  return ok();
}

export async function updateSessionSettings(input: unknown): Promise<ActionResult<{ recomputed: number }>> {
  await requireUser();
  const parsed = sessionsSettingsSchema.safeParse(input);
  if (!parsed.success) return fail(VALIDATION_ERROR, fieldErrors(parsed.error));
  getDb()
    .update(settings)
    .set({ sessionsJson: JSON.stringify(parsed.data) })
    .where(eq(settings.id, 1))
    .run();
  const recomputed = recomputeAllTrades();
  revalidate();
  return ok({ recomputed });
}

/** "Datenbank optimieren": VACUUM + ANALYZE. */
export async function optimizeDatabase(): Promise<ActionResult> {
  await requireUser();
  const sqlite = getSqlite();
  sqlite.exec("VACUUM");
  sqlite.exec("ANALYZE");
  sqlite.pragma("wal_checkpoint(TRUNCATE)");
  revalidatePath("/settings");
  return ok();
}
