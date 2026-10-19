"use server";

import { revalidatePath } from "next/cache";

import { fail, ok, VALIDATION_ERROR, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/guard";
import { getDb } from "@/lib/db/client";
import { journalDays } from "@/lib/db/schema";
import { fieldErrors, journalDaySchema } from "@/lib/validation";

/** Upsert by date (autosave from the journal day page). */
export async function saveJournalDay(input: unknown): Promise<ActionResult<{ updatedAt: number }>> {
  await requireUser();
  const parsed = journalDaySchema.safeParse(input);
  if (!parsed.success) return fail(VALIDATION_ERROR, fieldErrors(parsed.error));
  const { date, ...values } = parsed.data;
  const updatedAt = Date.now();
  getDb()
    .insert(journalDays)
    .values({ date, ...values, updatedAt })
    .onConflictDoUpdate({ target: journalDays.date, set: { ...values, updatedAt } })
    .run();
  revalidatePath("/journal");
  revalidatePath("/calendar");
  revalidatePath("/");
  return ok({ updatedAt });
}
